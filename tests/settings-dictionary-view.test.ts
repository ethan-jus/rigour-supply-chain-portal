import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import BusinessDictionaryView from '@/views/supply-chain/settings/BusinessDictionaryView.vue'
import { getBizDicts, getBizDictItems } from '@/api/core/business-settings'
import type { DictItemView, DictView } from '@/api/core/business-settings'

vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
}))
vi.mock('@/api/core/business-settings', () => ({
  getBizDicts: vi.fn(),
  getBizDictItems: vi.fn(),
  createBizDict: vi.fn(),
  createBizDictItem: vi.fn(),
  updateBizDict: vi.fn(),
  updateBizDictItem: vi.fn(),
  previewBizDictMerge: vi.fn(),
  mergeBizDictItem: vi.fn(),
}))
vi.mock('@/utils/business-dictionary', () => ({ refreshBusinessDictionaries: vi.fn() }))
const dictionaries: DictView[] = [
  {
    id: 'unit',
    dictionaryCode: 'UNIT',
    dictionaryName: '商品单位',
    dictionaryType: 'COMMON',
    remark: null,
    revision: 1,
    allowNewItems: true,
    sourceType: 'CUSTOM',
  },
  {
    id: 'status',
    dictionaryCode: 'STATUS',
    dictionaryName: '订单状态',
    dictionaryType: 'COMMON',
    remark: null,
    revision: 1,
    allowNewItems: false,
    sourceType: 'BUILTIN',
  },
]
const item = (id: string, name: string): DictItemView => ({
  id,
  dictionaryCode: 'UNIT',
  dictionaryItemCode: id,
  dictionaryItemName: name,
  dictionaryItemLevel: 1,
  parentDictionaryItemCode: null,
  ordinal: 0,
  revision: 1,
  remark: null,
  enabled: true,
})
let wrapper: VueWrapper | undefined
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getBizDicts).mockResolvedValue(dictionaries)
  vi.mocked(getBizDictItems).mockResolvedValue([item('BOX', '箱')])
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})
async function page() {
  wrapper = mount(BusinessDictionaryView, {
    global: { plugins: [ElementPlus], stubs: { DictionarySourceMappings: true } },
  })
  await flushPromises()
  return wrapper
}
async function choose(view: VueWrapper, name: string) {
  await view
    .findAll('.dictionary-entry')
    .find((row) => row.text().includes(name))!
    .trigger('click')
  await flushPromises()
}
describe('数据字典目录与详情', () => {
  it('默认仅加载当前字典，按名称或编码查目录，不发起整目录明细请求', async () => {
    const view = await page()
    expect(getBizDictItems).toHaveBeenCalledTimes(1)
    expect(getBizDictItems).toHaveBeenCalledWith('unit')
    expect(view.find('.master-detail').text()).toContain('箱')
    await view.get('input[aria-label="搜索字典名称或编码"]').setValue('订单')
    expect(view.findAll('.dictionary-entry')).toHaveLength(1)
    expect(view.find('.dictionary-entry').text()).toContain('订单状态')
    expect(getBizDictItems).toHaveBeenCalledTimes(1)
  })
  it('快速切换不让旧请求覆盖当前字典，固定字典不展示新增和合并', async () => {
    const view = await page()
    let oldResolve!: (items: DictItemView[]) => void
    vi.mocked(getBizDictItems).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          oldResolve = resolve
        }),
    )
    await choose(view, '订单状态')
    vi.mocked(getBizDictItems).mockResolvedValueOnce([item('PIECE', '件')])
    await choose(view, '商品单位')
    oldResolve([item('PENDING', '待支付')])
    await flushPromises()
    expect(view.find('.master-detail').text()).toContain('件')
    expect(view.find('.master-detail').text()).not.toContain('待支付')
    await choose(view, '订单状态')
    expect(view.find('.master-detail').text()).not.toContain('新增字典项')
    expect(view.find('.master-detail').text()).not.toContain('合并')
  })
  it('窄屏原生选择器兼容接口返回的数字 ID', async () => {
    vi.mocked(getBizDicts).mockResolvedValue(
      dictionaries.map((row, index) => ({ ...row, id: index + 1 })) as unknown as DictView[],
    )
    const view = await page()
    await view.get('#dictionary-select').setValue('2')
    await flushPromises()
    expect(view.find('.detail-heading').text()).toContain('订单状态')
    expect(getBizDictItems).toHaveBeenLastCalledWith(2)
  })
  it('加载失败与空结果区分，能在详情中重试', async () => {
    vi.mocked(getBizDictItems).mockRejectedValueOnce(new Error('字典项暂不可用'))
    const view = await page()
    expect(view.find('[role="alert"]').text()).toContain('字典项暂不可用')
    expect(view.find('.master-detail').text()).not.toContain('共 0 个标准项')
    await view
      .findAll('button')
      .find((button) => button.text() === '重新加载')!
      .trigger('click')
    await flushPromises()
    expect(view.find('.master-detail').text()).toContain('箱')
    expect(view.find('.detail-error').exists()).toBe(false)
  })
  it('字典项搜索与历史兼容切换各自展示真实结果', async () => {
    vi.mocked(getBizDictItems).mockResolvedValue([
      item('BOX', '箱'),
      { ...item('OLD_BOX', '旧箱'), canonicalDictionaryCode: 'UNIT', canonicalItemCode: 'BOX' },
    ])
    const view = await page()
    expect(view.find('.master-table').text()).not.toContain('旧箱')
    await view.get('input[aria-label="搜索字典项"]').setValue('不存在')
    expect(view.find('.master-table').text()).toContain('没有匹配的字典项')
    await view
      .findAll('[role="tab"]')
      .find((tab) => tab.text().includes('历史兼容'))!
      .trigger('click')
    await flushPromises()
    expect(view.find('.master-table').text()).toContain('旧箱')
    expect(view.find('.master-table').text()).toContain('BOX')
  })
})
