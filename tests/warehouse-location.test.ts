import { describe, expect, it, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus, { ElSelectV2 } from 'element-plus'
import Select from '@/components/erp/ErpWarehouseLocationSelect.vue'
import { warehouseLocationOptions } from '@/utils/warehouse-location'
import {
  getErpWarehouseLocationCatalog,
  type WarehouseLocationCatalog,
} from '@/api/core/erp-internal'

vi.mock('@/api/core/erp-internal', () => ({ getErpWarehouseLocationCatalog: vi.fn() }))
const catalog: WarehouseLocationCatalog = {
  version: '2026',
  nodes: [
    { code: '420000', name: '湖北省', level: 'PROVINCE', parentCode: null },
    { code: '420100', name: '武汉市', level: 'PREFECTURE', parentCode: '420000' },
    { code: '420102', name: '江岸区', level: 'COUNTY', parentCode: '420100' },
  ],
}
afterEach(() => vi.clearAllMocks())

describe('仓库所在地与业务归属独立维护', () => {
  it('仅可选择目录中的完整区县路径，保留省市区名称和编码便于搜索', () => {
    expect(warehouseLocationOptions(catalog)).toEqual([
      { value: '420102', label: '湖北省 / 武汉市 / 江岸区（420102）' },
    ])
    expect(warehouseLocationOptions({ version: '2026', nodes: [catalog.nodes[2]!] })).toEqual([])
  })
  it('打开编辑时保留历史编码和版本；用户重新选择时才使用当前版本', async () => {
    vi.mocked(getErpWarehouseLocationCatalog).mockResolvedValue(catalog)
    const w = mount(Select, {
      props: { code: '420103', version: '2025', display: '湖北省 / 武汉市 / 江汉区' },
      global: { plugins: [ElementPlus] },
    })
    try {
      await flushPromises()
      expect(w.emitted('update:version')).toBeUndefined()
      w.findComponent(ElSelectV2).vm.$emit('change', '420102')
      expect(w.emitted('update:code')?.at(-1)).toEqual(['420102'])
      expect(w.emitted('update:version')?.at(-1)).toEqual(['2026'])
      w.findComponent(ElSelectV2).vm.$emit('change', undefined)
      expect(w.emitted('update:code')?.at(-1)).toEqual([''])
      expect(w.emitted('update:version')?.at(-1)).toEqual([null])
    } finally {
      w.unmount()
    }
  })
  it('目录不可用时显示重试并保留已保存的所在地', async () => {
    vi.mocked(getErpWarehouseLocationCatalog).mockRejectedValue(new Error('unavailable'))
    const w = mount(Select, {
      props: { code: '420102', version: '2025', display: '湖北省 / 武汉市 / 江岸区' },
      global: { plugins: [ElementPlus] },
    })
    try {
      await flushPromises()
      expect(w.get('[role="alert"]').text()).toContain('加载失败')
      expect(w.findComponent(ElSelectV2).props('disabled')).toBe(true)
      expect(w.emitted('update:code')).toBeUndefined()
      expect(w.emitted('update:version')).toBeUndefined()
    } finally {
      w.unmount()
    }
  })
})
