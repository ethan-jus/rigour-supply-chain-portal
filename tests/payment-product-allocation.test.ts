import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ElementPlus, { ElSelect, ElTreeSelect } from 'element-plus'
import { reactive } from 'vue'

const mocks = vi.hoisted(() => ({
  routeQuery: {} as Record<string, string>,
  getPayments: vi.fn(),
  getAuditStates: vi.fn().mockResolvedValue({}),
  getCategories: vi.fn().mockResolvedValue({ total: 0, items: [] }),
  getProducts: vi.fn().mockResolvedValue({ total: 0, begin: 0, step: 200, items: [] }),
  exportCsv: vi.fn().mockResolvedValue(new Blob()),
}))

vi.mock('@/api/core/order-register', () => ({
  getOrderRegisterPayments: mocks.getPayments,
  exportOrderRegisterCsv: mocks.exportCsv,
}))
vi.mock('@/api/core/payment-voucher-audit', () => ({ getPaymentAuditStates: mocks.getAuditStates }))
vi.mock('@/utils/file-download', () => ({ csvFilename: () => 'lines.csv', downloadBlob: vi.fn() }))
vi.mock('@/api/core/business-settings', () => ({
  resolveBizDict: vi.fn(async (code: string) => {
    const values: Record<string, Array<[string, string]>> = {
      ORDER_COLLECTION_STATUS: [['UNPAID','未收款'],['PARTIAL_PAID','部分收款'],['PAID','已结清'],['NOT_REQUIRED','无需收款']],
      PAYMENT_RECEIPT_STATUS: [['PENDING','待收款'],['RECEIVED','租户已到账'],['CANCELLED','已作废']],
      PAYMENT_CONFIRMATION_STATUS: [['UNCONFIRMED','待确认'],['CONFIRMED','财务已确认']],
      PAYMENT_VOUCHER_AUDIT_STATUS: [['PENDING_REVIEW','待核查'],['NORMAL','正常'],['ABNORMAL','异常']],
      PAYMENT_VOUCHER_AUDIT_REASON: [['MISSING_VOUCHER','缺少付款凭证'],['OTHER','其他原因']],
    }
    return { dictionary: { dictionaryCode: code }, items: (values[code] ?? []).map(([value,name],i) => ({
      id: String(i),dictionaryCode:code,dictionaryItemCode:value,dictionaryItemName:name,ordinal:i,enabled:true,
    })) }
  }),
}))
vi.mock('@/api/core/erp-product', () => ({
  getErpManagedProducts: mocks.getProducts,
}))
vi.mock('@/api/core/erp-internal', () => ({
  getErpProductCategories: mocks.getCategories,
}))
vi.mock('@/composables/usePaymentFilterOptions', () => ({
  usePaymentFilterOptions: () => ({
    productSources: { categories: mocks.getCategories, products: mocks.getProducts },
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
    useRoute: () => ({ query: mocks.routeQuery }),
  }
})


vi.mock('@/composables/useSupplyPermissions', () => ({ useSupplyPermissions: () => ({ can: () => true }) }))
import PaymentRecordListView from '@/views/supply-chain/order/PaymentRecordListView.vue'
function paymentPage() {
  return { total: 1, begin: 0, step: 20, coverage: null,
    totals: { receivedAmount: 10, checkedAmount: 10, relatedOrderAmount: 16, unpaidAmount: 2, customerCount: 1, quantitySum: 1234.5 },
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
  it('回款归属缺失显示待确认，筛选按回款人传参，不冒用下单业务员', async () => {
    const page = paymentPage()
    Object.assign(page.items[0]!, { ownerEmployeeCode: 'ZHANG', ownerEmployeeName: '张三', paymentOwner: { status: 'PENDING', employeeCode: null } })
    Object.assign(page.totals, { ownerPendingAmount: 10 })
    mocks.getPayments.mockResolvedValue(page)
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('回款人')
    expect(wrapper.text()).toContain('回款人待补齐')
    expect(wrapper.text()).toContain('张三')
    const select = wrapper.findAllComponents(ElSelect).find(v => v.props('placeholder') === '搜索回款人')!
    select.vm.$emit('update:modelValue', 'LI')
    await flushPromises()
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.getPayments.mock.lastCall?.[0].ownerEmployeeCode).toBe('LI')
    await wrapper.findAll('button').find(b => b.text() === '导出')!.trigger('click'); await flushPromises()
    expect(mocks.exportCsv).toHaveBeenLastCalledWith('payments', expect.objectContaining({ ownerEmployeeCode: 'LI' }))
    select.vm.$emit('update:modelValue', '')
    await wrapper.find('form').trigger('submit'); await flushPromises()
    expect(mocks.getPayments.mock.lastCall?.[0].ownerEmployeeCode).toBeUndefined()
    wrapper.unmount()
  })
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.routeQuery = {}
    mocks.getAuditStates.mockResolvedValue({})
    mocks.getPayments.mockResolvedValue(paymentPage())
    mocks.getCategories.mockResolvedValue({ total: 2, items: [
      { id: 1, categoryName: '商品', parentId: null }, { id: 2, categoryName: '食品', parentId: 1 },
    ] })
    mocks.getProducts.mockImplementation(async (q: { categoryId?: string }) => ({ total: q.categoryId === '2' ? 1 : 0, items: q.categoryId === '2' ? [{ id: 101 }] : [] }))
  })
  it('商品规格随商品联动，查询和导出保留规格条件', async () => {
    const wrapper=mountPage(); await flushPromises()
    const variant=wrapper.findAllComponents(ElSelect).find(c => c.props('ariaLabel') === '商品规格')!
    expect(variant.props('disabled')).toBe(true)
    wrapper.findAllComponents(ElSelect).find(c => c.props('ariaLabel') === '商品')!.vm.$emit('update:modelValue',['101', '102'])
    await flushPromises()
    variant.vm.$emit('update:modelValue',['1001', '1003'])
    await wrapper.find('form').trigger('submit'); await flushPromises()
    expect(mocks.getPayments.mock.calls.at(-1)![0]).toMatchObject({ productIds: [101, 102], productVariantIds: ['1001', '1003'] })
    await wrapper.findAll('button').find(b => b.text() === '导出')!.trigger('click'); await flushPromises()
    expect(mocks.exportCsv).toHaveBeenLastCalledWith('payments',expect.objectContaining({ productVariantIds: ['1001', '1003'] }))
    wrapper.unmount()
  })
  it('保留真实回款，父分类包含子类，汇总与导出使用同一筛选', async () => {
    const wrapper = mountPage(); await flushPromises()
    expect(wrapper.text()).not.toContain('筛选商品分摊金额')
    const category = wrapper.findAllComponents(ElTreeSelect).find(c => c.props('ariaLabel') === '商品分类')!
    category.vm.$emit('update:modelValue', ['1'])
    await wrapper.find('form').trigger('submit'); await flushPromises()
    expect(mocks.getPayments.mock.calls.at(-1)![0].productIds).toEqual([101])
    expect(wrapper.text()).toContain('筛选商品分摊金额')
    expect(wrapper.text()).toContain('¥50.00')
    expect(wrapper.find('[aria-label="回款统计"]').text()).toContain('¥10.00')
    expect(wrapper.find('[aria-label="回款统计"]').text()).toContain('商品数1,234.5')
    await wrapper.findAll('button').find(b => b.text() === '导出')!.trigger('click'); await flushPromises()
    expect(mocks.exportCsv).toHaveBeenLastCalledWith('payments', expect.objectContaining({ productIds: [101] }))
    category.vm.$emit('update:modelValue', [])
    await wrapper.find('form').trigger('submit'); await flushPromises()
    expect(mocks.getPayments.mock.calls.at(-1)![0].productIds).toBeUndefined()
    expect(wrapper.text()).not.toContain('筛选商品分摊金额')
    wrapper.unmount()
  })
  it('分类与商品取交集，空交集不能退化为全部回款', async () => {
    const wrapper=mountPage(); await flushPromises()
    wrapper.findAllComponents(ElTreeSelect).find(c => c.props('ariaLabel') === '商品分类')!.vm.$emit('update:modelValue',['1'])
    wrapper.findAllComponents(ElSelect).find(c => c.props('ariaLabel') === '商品')!.vm.$emit('update:modelValue',['999'])
    await wrapper.find('form').trigger('submit'); await flushPromises()
    expect(mocks.getPayments.mock.calls.at(-1)![0].productIds).toEqual([0])
    wrapper.unmount()
  })
  it('旧订单服务未返回分摊字段时不展示整笔金额作为分摊统计', async () => {
    const wrapper=mountPage(); await flushPromises()
    const data=paymentPage()
    Reflect.deleteProperty(data.items[0]!, 'allocatedPaymentAmount')
    mocks.getPayments.mockResolvedValue(data)
    wrapper.findAllComponents(ElSelect).find(c => c.props('ariaLabel') === '商品')!.vm.$emit('update:modelValue',['101', '102'])
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
  it('已收款查询与导出使用同一汇总状态，清空后取消状态筛选', async () => {
    const wrapper = mountPage(); await flushPromises()
    const status = wrapper.findAllComponents(ElSelect).find(c => c.props('ariaLabel') === '收款状态')!
    status.vm.$emit('update:modelValue', 'RECEIVED')
    await wrapper.find('form').trigger('submit'); await flushPromises()
    expect(mocks.getPayments).toHaveBeenLastCalledWith(expect.objectContaining({ receiptStatusCode: 'RECEIVED' }))
    expect(wrapper.find('[aria-label="回款统计"]').text()).toContain('¥10.00')
    await wrapper.findAll('button').find(b => b.text() === '导出')!.trigger('click'); await flushPromises()
    expect(mocks.exportCsv).toHaveBeenLastCalledWith('payments', expect.objectContaining({ receiptStatusCode: 'RECEIVED' }))
    status.vm.$emit('update:modelValue', undefined)
    await wrapper.find('form').trigger('submit'); await flushPromises()
    expect(mocks.getPayments.mock.calls.at(-1)![0].receiptStatusCode).toBeUndefined()
    wrapper.unmount()
  })
  it('首页待核回款按到账未审核条件进入列表，重置后清除状态', async () => {
    mocks.routeQuery = { homeTask: 'payment', orderNo: 'OLD-ORDER' }
    const wrapper = mountPage()
    await flushPromises()
    expect(mocks.getPayments).toHaveBeenCalledTimes(1)
    expect(mocks.getPayments).toHaveBeenLastCalledWith(expect.objectContaining({ orderNo: 'OLD-ORDER', receiptStatusCode: 'RECEIVED', confirmationStatusCode: 'UNCONFIRMED' }))
    const status = wrapper.findAllComponents(ElSelect).find(c => c.props('ariaLabel') === '收款状态')!
    expect(status.props('modelValue')).toBe('RECEIVED')
    await wrapper.findAll('button').find(button => button.text() === '重置')!.trigger('click')
    await flushPromises()
    expect(mocks.getPayments.mock.calls.at(-1)![0].receiptStatusCode).toBeUndefined()
    wrapper.unmount()
  })

  it('使用真实字典解析，财务确认与凭证核查独立，核查失败不清空金额', async () => {
    mocks.getAuditStates.mockResolvedValue({ '1': { statusCode: 'PENDING_REVIEW', reasonCodes: ['MISSING_VOUCHER'] } })
    const wrapper = mountPage(); await flushPromises()
    expect(wrapper.text()).toContain('租户已到账')
    expect(wrapper.text()).toContain('财务已确认')
    expect(wrapper.text()).toContain('待核查')
    const confirmation = wrapper.findAllComponents(ElSelect).find(c => c.props('ariaLabel') === '财务确认')!
    confirmation.vm.$emit('update:modelValue', 'UNCONFIRMED')
    mocks.getAuditStates.mockRejectedValueOnce(new Error('核查暂不可用'))
    await wrapper.find('form').trigger('submit'); await flushPromises()
    expect(mocks.getPayments.mock.calls.at(-1)![0].confirmationStatusCode).toBe('UNCONFIRMED')
    expect(wrapper.text()).toContain('加载失败')
    expect(wrapper.text()).toContain('¥50.00')
    expect(wrapper.find('[aria-label="回款统计"]').text()).toContain('¥10.00')
    await wrapper.findAll('button').find(b => b.text() === '导出')!.trigger('click'); await flushPromises()
    expect(mocks.exportCsv).toHaveBeenLastCalledWith('payments',expect.objectContaining({ confirmationStatusCode: 'UNCONFIRMED' }))
    wrapper.unmount()
  })

})
