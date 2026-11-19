import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus, { ElMessage } from 'element-plus'
import CostCitySelect from '@/views/supply-chain/cost/CostCitySelect.vue'
import View from '@/views/supply-chain/erp/ErpBasicDataManagementView.vue'
const api = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), cities: vi.fn() }))
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRoute: () => ({ meta: { routeKey: 'supply.erp.inventory.warehouses' } }),
}))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
}))
vi.mock('@/api/core/erp-internal', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/core/erp-internal')>()),
  getErpInventoryWarehouses: api.list,
  getErpInventoryWarehouse: api.detail,
}))
vi.mock('@/api/core/cost', () => ({ getCostCities: api.cities }))
vi.mock('@/api/core/crm', () => ({ getCrmCustomerAreas: async () => ({ items: [] }) }))
vi.mock('@/utils/business-dictionary', () => ({
  loadBusinessDictionaries: async () => undefined,
  businessDictionaryLabel: (_m: string, _d: string, v: string) => v || '—',
  businessDictionaryOptions: () => [],
}))
let wrapper: VueWrapper
const row = {
  id: '1',
  warehouseCode: 'WH-LOCAL',
  warehouseName: '杭州仓',
  warehouseTypeCode: 'CITY',
  regionCode: null,
  defaultFlag: false,
  statusCode: 'ACTIVE',
  revision: 1,
  sourceReferences: [
    {
      sourceSystem: 'DINGHUOBAO',
      sourceCode: '0012',
      sourceObjectId: '26860',
      sourceName: '杭州仓',
      connectorId: 'C1',
    },
  ],
}
beforeEach(() => {
  vi.clearAllMocks()
  api.list.mockResolvedValue({ total: 1, items: [row] })
  api.detail.mockResolvedValue(row)
  api.cities.mockResolvedValue([
    { code: 'CUSAREA-WH', name: '武汉市' },
    { code: 'COST_HEADQUARTERS', name: '总部' },
  ])
})
afterEach(() => {
  wrapper?.unmount()
  ElMessage.closeAll()
  document.body.innerHTML = ''
})
async function open() {
  wrapper = mount(View, {
    global: {
      plugins: [createPinia(), ElementPlus],
      stubs: { DhbPageSyncButton: true, ErpWarehouseLocationSelect: true },
    },
  })
  await flushPromises()
}
describe('仓库订货宝来源追溯', () => {
  it('原仓库编号独立展示和筛选，保持前导零，不将来源ID混入业务编号', async () => {
    await open()
    const cells = wrapper
      .findAll('tr.el-table__row')[0]!
      .findAll('td')
      .map((c) => c.text())
    expect(cells).toContain('WH-LOCAL')
    expect(cells).toContain('0012')
    expect(cells).not.toContain('26860')
    await wrapper.get('input[placeholder="输入订货宝仓库编号"]').setValue('0012')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ sourceWarehouseCode: '0012', warehouseCode: undefined }),
    )
  })
  it('归属仅作为筛选和维护字段，仓库选项来自经营城市目录', async () => {
    await open()
    expect(wrapper.findAll('th').map((header) => header.text())).not.toContain('业务归属地区')
    expect(api.cities).toHaveBeenCalledWith('erp:product:read')
    await wrapper.get('button.el-button--primary').trigger('click')
    await flushPromises()
    expect(
      wrapper.findAllComponents(CostCitySelect).map((select) => select.props('action')),
    ).toContain('erp:product:write')
    expect(api.cities).toHaveBeenCalledWith('erp:product:write')
  })
  it('手工仓库没有订货宝编号，不以本系统编号补造', async () => {
    api.list.mockResolvedValue({ total: 1, items: [{ ...row, sourceReferences: [] }] })
    await open()
    const column = wrapper.findAll('th').findIndex((h) => h.text() === '订货宝仓库编号')
    const cells = wrapper.findAll('tr.el-table__row')[0]!.findAll('td')
    expect(cells[column]!.text()).toBe('—')
  })
})
