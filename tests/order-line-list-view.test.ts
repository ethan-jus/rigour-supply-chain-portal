import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ElementPlus, { ElSelect, ElTreeSelect, ElDatePicker } from 'element-plus'
import { reactive } from 'vue'

const mocks = vi.hoisted(() => ({
  getLines: vi.fn(),
  getCategories: vi.fn().mockResolvedValue({ total: 0, items: [] }),
  getProducts: vi.fn().mockResolvedValue({ total: 0, begin: 0, step: 200, items: [] }),
  exportCsv: vi.fn().mockResolvedValue(new Blob()),
}))

vi.mock('@/api/core/order-register', () => ({
  getOrderRegisterLines: mocks.getLines,
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

import OrderLineListView from '@/views/supply-chain/order/OrderLineListView.vue'

function linePage() {
  return {
    total: 2,
    begin: 0,
    step: 20,
    items: [
      {
        id: 'l1',
        orderId: 'o1',
        orderNo: 'A001',
        sourceSystemCode: 'DINGHUOBAO',
        customerId: 'c1',
        customerCode: 'C001',
        customerName: '测试客户',
        regionCode: 'HZ',
        regionName: '杭州',
        ownerEmployeeCode: 'E001',
        ownerEmployeeName: '张三',
        departmentId: 1,
        departmentName: '销售部',
        orderDate: '2026-09-10T08:00:00+08:00',
        lineNo: 1,
        sourceLineId: 'DHB-LINE-123',
        productId: '9',
        productVariantId: '11',
        productCode: 'PRD001',
        skuCode: 'SKU001',
        productName: '油泼辣子拌面',
        specification: '单规格',
        unitCode: 'BUCKET',
        quantity: 10,
        unitPrice: 10,
        lineAmount: 100,
      },
      {
        id: 'l2',
        orderId: 'o1',
        orderNo: 'A001',
        sourceSystemCode: 'DINGHUOBAO',
        customerId: 'c1',
        customerCode: 'C001',
        customerName: '测试客户',
        regionCode: 'HZ',
        regionName: '杭州',
        ownerEmployeeCode: 'E001',
        ownerEmployeeName: '张三',
        departmentId: 1,
        departmentName: '销售部',
        orderDate: '2026-09-10T08:00:00+08:00',
        lineNo: 2,
        sourceLineId: null,
        productId: null,
        productVariantId: null,
        productCode: null,
        skuCode: null,
        productName: null,
        specification: null,
        unitCode: null,
        quantity: 1,
        unitPrice: 0,
        lineAmount: 0,
      },
    ],
    totals: { lineAmount: 100 },
    coverage: null,
  }
}

describe('订单明细页', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getLines.mockResolvedValue(linePage())
  })

  it('收款日期展示最近实际日期和时分秒，未收款留空，查询与导出保留日期范围', async () => {
    const page = linePage()
    mocks.getLines.mockResolvedValue({ ...page, items: page.items.map((row, i) => ({ ...row,
      paymentStatusCode: i === 0 ? 'PARTIAL_PAID' : 'UNPAID',
      paymentTime: i === 0 ? '2026-09-01T16:23:45Z' : null,
    })) })
    const wrapper = mount(OrderLineListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const headers = wrapper.findAll('.el-table__header th')
    const dateIndex = headers.findIndex(h => h.text() === '收款日期')
    expect(dateIndex).toBeGreaterThan(-1)
    const rows = wrapper.findAll('.el-table__body tbody tr')
    expect(rows[0]!.findAll('td')[dateIndex]!.text()).toBe('2026-09-02 00:23:45')
    expect(rows[1]!.findAll('td')[dateIndex]!.text()).toBe('')
    const date = wrapper.findAllComponents(ElDatePicker).find(c => c.props('startPlaceholder') === '收款开始日期')!
    date.vm.$emit('update:modelValue', ['2026-09-02', '2026-09-02'])
    await wrapper.find('form').trigger('submit'); await flushPromises()
    const range = { paymentTimeFrom: '2026-09-01T16:00:00.000Z', paymentTimeTo: '2026-09-02T16:00:00.000Z' }
    expect(mocks.getLines.mock.calls.at(-1)![0]).toMatchObject(range)
    await wrapper.findAll('button').find(b => b.text() === '导出')!.trigger('click'); await flushPromises()
    expect(mocks.exportCsv).toHaveBeenLastCalledWith('lines', expect.objectContaining(range))
    date.vm.$emit('update:modelValue', null)
    await wrapper.find('form').trigger('submit'); await flushPromises()
    expect(mocks.getLines.mock.calls.at(-1)![0].paymentTimeFrom).toBeUndefined()
    expect(mocks.getLines.mock.calls.at(-1)![0].paymentTimeTo).toBeUndefined()
    wrapper.unmount()
  })

  it('商品规格必须先选商品，列表和导出都传递规格条件', async () => {
    const wrapper = mount(OrderLineListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const variant = wrapper.findAllComponents(ElSelect).find(item => item.props('ariaLabel') === '商品规格')!
    expect(variant.props('disabled')).toBe(true)
    const product = wrapper.findAllComponents(ElSelect).find(item => item.props('ariaLabel') === '商品')!
    product.vm.$emit('update:modelValue', ['9']); await flushPromises()
    expect(variant.props('disabled')).toBe(false)
    variant.vm.$emit('update:modelValue', ['99'])
    await wrapper.find('form').trigger('submit'); await flushPromises()
    expect(mocks.getLines.mock.calls.at(-1)![0]).toMatchObject({ productIds: [9], productVariantIds: ['99'] })
    await wrapper.findAll('button').find(button => button.text() === '导出')!.trigger('click'); await flushPromises()
    expect(mocks.exportCsv).toHaveBeenLastCalledWith('lines', expect.objectContaining({ productIds: [9], productVariantIds: ['99'] }))
    product.vm.$emit('update:modelValue', []); await flushPromises()
    expect(variant.props('disabled')).toBe(true)
    expect(variant.props('modelValue')).toEqual([])
    wrapper.unmount()
  })

  it('展示 SKU/型号与单位，缺关联的行给出未关联提示', async () => {
    const wrapper = mount(OrderLineListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('来源明细号')
    expect(text).toContain('DHB-LINE-123')
    expect(text).not.toContain('订货宝订单号')
    expect(text).toContain('SKU/型号')
    expect(text).toContain('SKU001')
    expect(text).toContain('BUCKET')
    expect(text).toContain('明细编码')
    expect(text).toContain('来源明细号')
    expect(text).not.toContain('商品关联')
    expect(text).toContain('订货金额')
    wrapper.unmount()
  })

  it('清空筛选后再查询，旧条件不再带上', async () => {
    const wrapper = mount(OrderLineListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const orderNo = wrapper.find('input[aria-label="订单号"]')
    await orderNo.setValue('A001')
    await orderNo.trigger('keyup.enter')
    await flushPromises()
    expect(mocks.getLines.mock.calls.at(-1)![0]).toMatchObject({ orderNo: 'A001' })

    await orderNo.setValue('')
    await orderNo.trigger('keyup.enter')
    await flushPromises()
    expect(mocks.getLines.mock.calls.at(-1)![0].orderNo).toBeUndefined()
    wrapper.unmount()
  })

  it('商品多选清空后查询不保留商品条件', async () => {
    const wrapper = mount(OrderLineListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const product = wrapper.findAllComponents(ElSelect).find((item) => item.props('ariaLabel') === '商品')!
    product.vm.$emit('update:modelValue', ['9'])
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.getLines.mock.calls.at(-1)![0].productIds).toEqual([9])
    product.vm.$emit('update:modelValue', [])
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.getLines.mock.calls.at(-1)![0].productIds).toBeUndefined()
    wrapper.unmount()
  })

  it('空商品分类不扩大成全量查询，统计归零', async () => {
    const wrapper = mount(OrderLineListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const category = wrapper.findAllComponents(ElTreeSelect).find((item) => item.props('ariaLabel') === '商品分类')!
    category.vm.$emit('update:modelValue', ['empty-category'])
    const calls = mocks.getLines.mock.calls.length
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.getLines).toHaveBeenCalledTimes(calls)
    expect(wrapper.find('[aria-label="明细统计"]').text()).toContain('¥0.00')
    expect(wrapper.text()).not.toContain('SKU001')
    wrapper.unmount()
  })

  it('分类多选清空后可以重新查询', async () => {
    const wrapper = mount(OrderLineListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const category = wrapper.findAllComponents(ElTreeSelect).find((item) => item.props('ariaLabel') === '商品分类')!
    category.vm.$emit('update:modelValue', [])
    const count = mocks.getLines.mock.calls.length
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.getLines).toHaveBeenCalledTimes(count + 1)
    expect(mocks.getLines.mock.calls.at(-1)![0].productIds).toBeUndefined()
    wrapper.unmount()
  })

  it('分类接口失败与无分类区分，重新展开后自动恢复分类树', async () => {
    mocks.getCategories.mockRejectedValueOnce(new Error('签名失败'))
    const wrapper = mount(OrderLineListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const category = wrapper.findAllComponents(ElTreeSelect).find(item => item.props('ariaLabel') === '商品分类')!
    expect(category.props('noDataText')).toContain('分类加载失败')
    mocks.getCategories.mockResolvedValueOnce({ total: 2, items: [
      { id: 1, parentId: null, categoryName: '台球用品' },
      { id: 2, parentId: 1, categoryName: '台呢' },
    ] })
    category.vm.$emit('visible-change', true)
    await flushPromises()
    expect(category.props('data')).toEqual([{ id: '1', categoryName: '台球用品', children: [{ id: '2', categoryName: '台呢', children: [] }] }])
    expect(category.props('noDataText')).toBe('暂无商品分类')
    mocks.getProducts.mockImplementation(async (query: { categoryId?: string }) => ({
      total: query.categoryId === '2' ? 1 : 0,
      items: query.categoryId === '2' ? [{ id: 9 }] : [],
    }))
    category.vm.$emit('update:modelValue', ['1'])
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.getLines.mock.calls.at(-1)![0].productIds).toEqual([9])
    wrapper.unmount()
  })

  it('商品信息失败时保留已加载缩略图并支持重试', async () => {
    mocks.getProducts.mockResolvedValue({ items: [{ id: 9, mainImageUrl: 'https://example.test/product.png' }] })
    const wrapper = mount(OrderLineListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    expect(wrapper.findAllComponents({ name: 'ElImage' }).some(img => img.props('src') === 'https://example.test/product.png')).toBe(true)
    mocks.getProducts.mockRejectedValueOnce(new Error('暂时不可用'))
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('商品图片与单位信息加载失败')
    expect(wrapper.findAllComponents({ name: 'ElImage' }).some(img => img.props('src') === 'https://example.test/product.png')).toBe(true)
    await wrapper.findAll('button').find(button => button.text() === '重新加载商品信息')!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).not.toContain('商品图片与单位信息加载失败')
    wrapper.unmount()
  })

  it('优惠筛选与排序传给后端，清空后恢复全部', async () => {
    const wrapper = mount(OrderLineListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const discount = wrapper.findAllComponents(ElSelect).find(item => item.props('ariaLabel') === '优惠情况')!
    discount.vm.$emit('update:modelValue', 'true')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.getLines.mock.calls.at(-1)![0].hasDiscount).toBe(true)
    wrapper.findAllComponents({ name: 'ElTable' })[0]!.vm.$emit('sort-change', { prop: 'discountRate', order: 'descending' })
    await flushPromises()
    expect(mocks.getLines.mock.calls.at(-1)![0]).toMatchObject({ hasDiscount: true, sortBy: 'discountRate', sortDirection: 'desc', begin: 0 })
    const exportButton = wrapper.findAll('button').find(button => button.text() === '导出')!
    await exportButton.trigger('click')
    await flushPromises()
    expect(mocks.exportCsv).toHaveBeenLastCalledWith('lines', expect.objectContaining({ hasDiscount: true, sortBy: 'discountRate', sortDirection: 'desc' }))
    expect(mocks.exportCsv.mock.calls.at(-1)![1]).not.toHaveProperty('begin')
    expect(mocks.exportCsv.mock.calls.at(-1)![1]).not.toHaveProperty('step')
    discount.vm.$emit('update:modelValue', 'false')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.getLines.mock.calls.at(-1)![0].hasDiscount).toBe(false)
    discount.vm.$emit('update:modelValue', undefined)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.getLines.mock.calls.at(-1)![0].hasDiscount).toBeUndefined()
    wrapper.unmount()
  })

  it('展示订单汇总收款状态，筛选和清空传递当前条件', async () => {
    const page = linePage()
    mocks.getLines.mockResolvedValue({ ...page, items: page.items.map((row) => ({ ...row, paymentStatusCode: 'PARTIAL_PAID' })) })
    const wrapper = mount(OrderLineListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    expect(wrapper.text()).toContain('部分收款')
    const status = wrapper.findAllComponents(ElSelect).find((item) => item.props('ariaLabel') === '收款状态')!
    status.vm.$emit('update:modelValue', 'PAID')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.getLines.mock.calls.at(-1)![0].paymentStatusCode).toBe('PAID')
    status.vm.$emit('update:modelValue', undefined)
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    expect(mocks.getLines.mock.calls.at(-1)![0].paymentStatusCode).toBeUndefined()
    wrapper.unmount()
  })

  it('统计条显示回款率与销售数量合计，而非商品种类数', async () => {
    mocks.getLines.mockResolvedValue({
      ...linePage(),
      totals: {
        lineAmount: 100,
        receivedAmount: 50,
        orderAmount: 80,
        discountAmount: 20,
        discountRate: 0.2,
        unpaidAmount: 30,
        customerCount: 1,
        productCount: 2,
        quantitySum: 34,
      },
    })
    const wrapper = mount(OrderLineListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('订货金额')
    expect(text).toContain('订单金额')
    // 收款金额按命中订单去重后的账本金额统计。
    expect(text).toContain('回款金额')
    expect(text).toContain('回款率')
    expect(text).toContain('62.50%')
    const summary = wrapper.find('[aria-label="明细统计"]')
    expect(summary.findAll('.order-summary__label').map(label => label.text()))
      .toEqual(['订单金额', '回款金额', '回款率', '待收金额', '客户数', '商品数', '订货金额', '优惠额', '优惠率'])
    expect(summary.findAll('.order-summary__metric').find(metric => metric.text().startsWith('商品数'))!.find('strong').text()).toBe('34')
    expect(wrapper.find('.order-summary-note--quantity').exists()).toBe(false)
    expect(text).toContain('¥50.00')
    expect(text).toContain('优惠额')
    expect(text).toContain('优惠率')
    expect(text).toContain('20.00%')
    expect(text).toContain('待收金额')
    expect(text).toContain('商品数')
    expect(text).toContain('¥80.00')
    expect(text).not.toContain('数量合计')
    expect(text).not.toContain('尾差')
    wrapper.unmount()
  })

  it('商品列展示缩略图占位与商品编码规格', async () => {
    const wrapper = mount(OrderLineListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    expect(wrapper.find('.line-product__image').exists()).toBe(true)
    expect(wrapper.text()).toContain('油泼辣子拌面')
    expect(wrapper.text()).toContain('PRD001')
    wrapper.unmount()
  })
})
