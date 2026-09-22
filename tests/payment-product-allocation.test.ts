import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ElementPlus, { ElSelect, ElTreeSelect } from 'element-plus'
import { reactive } from 'vue'

const mocks = vi.hoisted(() => ({
  getPayments: vi.fn(),
  getCategories: vi.fn().mockResolvedValue({ total: 0, items: [] }),
  getProducts: vi.fn().mockResolvedValue({ total: 0, begin: 0, step: 200, items: [] }),
  exportCsv: vi.fn().mockResolvedValue(new Blob()),
}))

vi.mock('@/api/core/order-register', () => ({
  getOrderRegisterPayments: mocks.getPayments,
  exportOrderRegisterCsv: mocks.exportCsv,
}))
vi.mock('@/utils/file-download', () => ({ csvFilename: () => 'lines.csv', downloadBlob: vi.fn() }))
vi.mock('@/utils/business-dictionary', () => ({
  loadBusinessDictionaries: vi.fn(),
  businessDictionaryLabel: (_module: string, _code: string, value: string) => value || '-',
}))
vi.mock('@/api/core/erp-product', () => ({
  getErpManagedProducts: mocks.getProducts,
}))
vi.mock('@/api/core/erp-internal', () => ({
  getErpProductCategories: mocks.getCategories,
}))
vi.mock('@/composables/useOrderRegisterOptions', () => ({
  useOrderRegisterOptions: () => ({
    areaTree: [],
    departmentOptionsTree: [],
    employeeOptions: [],
    employeeLoading: false,
    creatorOptions: [],
    areaTreeProps: {},
    departmentTreeProps: {},
    loadOptions: vi.fn(),
    searchEmployees: vi.fn(),
    areaLabel: (code: string | null) => code || '-',
    departmentLabel: (_id: number | null, name: string | null) => name || '-',
    employeeLabel: (_code: string | null, name: string | null) => name || '-',
  }),
}))
vi.mock('@/composables/useOrderRegisterQuery', () => ({
  useOrderRegisterCommonFilters: () => ({
    filters: reactive({
      orderNo: '',
      customerName: '',
      customerCode: '',
      regionCode: '',
      ownerEmployeeCode: '',
      departmentId: null,
      createdBy: '',
      orderDateRange: null,
    }),
    resetCommonFilters: vi.fn(),
  }),
}))
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRoute: () => ({ query: {} }),
  }
})


vi.mock('@/composables/useSupplyPermissions', () => ({ useSupplyPermissions: () => ({ can: () => true }) }))
import PaymentRecordListView from '@/views/supply-chain/order/PaymentRecordListView.vue'
function paymentPage() {
  return { total: 1, begin: 0, step: 20, coverage: null,
    totals: { receivedAmount: 10, checkedAmount: 10, relatedOrderAmount: 16, unpaidAmount: 2, customerCount: 1 },
    items: [{ id: '1', orderId: '2', paymentNo: 'P1', orderNo: 'O1', customerName: '客户', paidAmount: 50,
      allocatedPaymentAmount: 10, paymentStatusCode: 'CHECKED', attachments: [], productAllocations: [
        { lineId: 1, productName: '方便面', originalAmount: 20, allocatedAmount: 10, matched: true },
        { lineId: 2, productName: '台呢', originalAmount: 80, allocatedAmount: 40, matched: false },
      ] }],
  }
}
function mountPage() { return mount(PaymentRecordListView, { global: { plugins: [ElementPlus], stubs: {
  OrderRegisterDetailDrawer: true, PaymentDetailDrawer: true, PaymentCheckDialog: true,
} } }) }
describe('回款商品分摊', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getPayments.mockResolvedValue(paymentPage())
    mocks.getCategories.mockResolvedValue({ total: 2, items: [
      { id: 1, categoryName: '商品', parentId: null }, { id: 2, categoryName: '食品', parentId: 1 },
    ] })
    mocks.getProducts.mockImplementation(async (q: { categoryId?: string }) => ({ total: q.categoryId === '2' ? 1 : 0, items: q.categoryId === '2' ? [{ id: 101 }] : [] }))
  })
  it('保留真实回款，父分类包含子类，汇总与导出使用同一筛选', async () => {
    const wrapper = mountPage(); await flushPromises()
    expect(wrapper.text()).not.toContain('筛选商品分摊金额')
    const category = wrapper.findAllComponents(ElTreeSelect).find(c => c.props('ariaLabel') === '商品分类')!
    category.vm.$emit('update:modelValue', '1')
    await wrapper.find('form').trigger('submit'); await flushPromises()
    expect(mocks.getPayments.mock.calls.at(-1)![0].productIds).toEqual([101])
    expect(wrapper.text()).toContain('筛选商品分摊金额')
    expect(wrapper.text()).toContain('¥50.00')
    expect(wrapper.find('[aria-label="回款统计"]').text()).toContain('¥10.00')
    await wrapper.findAll('button').find(b => b.text() === '导出')!.trigger('click'); await flushPromises()
    expect(mocks.exportCsv).toHaveBeenLastCalledWith('payments', expect.objectContaining({ productIds: [101] }))
    category.vm.$emit('update:modelValue', undefined)
    await wrapper.find('form').trigger('submit'); await flushPromises()
    expect(mocks.getPayments.mock.calls.at(-1)![0].productIds).toBeUndefined()
    expect(wrapper.text()).not.toContain('筛选商品分摊金额')
    wrapper.unmount()
  })
  it('分类与商品取交集，空交集不能退化为全部回款', async () => {
    const wrapper=mountPage(); await flushPromises()
    wrapper.findAllComponents(ElTreeSelect).find(c => c.props('ariaLabel') === '商品分类')!.vm.$emit('update:modelValue','1')
    wrapper.findAllComponents(ElSelect).find(c => c.props('ariaLabel') === '商品')!.vm.$emit('update:modelValue','999')
    await wrapper.find('form').trigger('submit'); await flushPromises()
    expect(mocks.getPayments.mock.calls.at(-1)![0].productIds).toEqual([0])
    wrapper.unmount()
  })
  it('旧订单服务未返回分摊字段时不展示整笔金额作为分摊统计', async () => {
    const wrapper=mountPage(); await flushPromises()
    const data=paymentPage()
    Reflect.deleteProperty(data.items[0]!, 'allocatedPaymentAmount')
    mocks.getPayments.mockResolvedValue(data)
    wrapper.findAllComponents(ElSelect).find(c => c.props('ariaLabel') === '商品')!.vm.$emit('update:modelValue','101')
    await wrapper.find('form').trigger('submit'); await flushPromises()
    expect(wrapper.text()).toContain('回款加载失败，请重新查询')
    expect(wrapper.find('[aria-label="回款统计"]').text()).not.toContain('¥10.00')
    wrapper.unmount()
  })
  it('无法分摊显式提示，接口错误不会保留旧金额', async () => {
    const data=paymentPage(); data.totals = { ...data.totals, unallocatedCount: 1 } as typeof data.totals
    mocks.getPayments.mockResolvedValue(data)
    const wrapper=mountPage(); await flushPromises()
    expect(wrapper.text()).toContain('1 笔回款无法分摊')
    mocks.getPayments.mockRejectedValueOnce(new Error('加载失败'))
    await wrapper.find('form').trigger('submit'); await flushPromises()
    expect(wrapper.text()).toContain('回款加载失败，请重新查询')
    expect(wrapper.text()).not.toContain('¥50.00')
    wrapper.unmount()
  })
})
