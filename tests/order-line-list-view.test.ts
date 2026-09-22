import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ElementPlus from 'element-plus'
import { reactive } from 'vue'

const mocks = vi.hoisted(() => ({
  getLines: vi.fn(),
}))

vi.mock('@/api/core/order-register', () => ({
  getOrderRegisterLines: mocks.getLines,
  exportOrderRegisterCsv: vi.fn(),
}))
vi.mock('@/api/core/erp-product', () => ({
  getErpManagedProducts: vi.fn().mockResolvedValue({ total: 0, begin: 0, step: 200, items: [] }),
}))
vi.mock('@/api/core/erp-internal', () => ({
  getErpProductCategories: vi.fn().mockResolvedValue({ total: 0, begin: 0, step: 200, items: [] }),
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
        sourceLineId: null,
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

  it('展示 SKU/型号与单位，缺关联的行给出未关联提示', async () => {
    const wrapper = mount(OrderLineListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('SKU/型号')
    expect(text).toContain('SKU001')
    expect(text).toContain('BUCKET')
    expect(text).toContain('明细编码')
    expect(text).toContain('来源明细号')
    expect(text).not.toContain('商品关联')
    expect(text).toContain('明细金额')
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

  it('统计条并列展示明细金额、订单金额、回款金额、客户数与数量合计', async () => {
    mocks.getLines.mockResolvedValue({
      ...linePage(),
      totals: {
        lineAmount: 100,
        receivedAmount: 50,
        orderAmount: 120,
        customerCount: 1,
        productCount: 2,
        quantitySum: 34,
      },
    })
    const wrapper = mount(OrderLineListView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('明细金额')
    expect(text).toContain('订单金额')
    // 回款金额：按明细金额比例分摊后的回款合计（部分回款同样按比例）
    expect(text).toContain('回款金额')
    expect(text).toContain('¥50.00')
    expect(text).toContain('客户数')
    expect(text).toContain('数量合计')
    expect(text).toContain('34')
    expect(text).toContain('¥120.00')
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
