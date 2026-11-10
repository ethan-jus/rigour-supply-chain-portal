import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus, { ElDatePicker, ElSelect, ElTreeSelect } from 'element-plus'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PaymentRiskData, PaymentRiskOrder } from '@/api/core/payment-risk'
import PaymentRiskBoard from '@/views/supply-chain/bi/components/PaymentRiskBoard.vue'
import { buildPaymentRiskExcel } from '@/views/supply-chain/bi/payment-risk-export'
import { downloadBlob } from '@/utils/file-download'

vi.mock('@/views/supply-chain/bi/payment-risk-export', () => ({ buildPaymentRiskExcel: vi.fn() }))
vi.mock('@/utils/file-download', () => ({ downloadBlob: vi.fn() }))

const order: PaymentRiskOrder = {
  orderId: '1',
  orderNo: 'DEMO-1',
  customerName: '示例门店',
  regionCode: 'CD',
  regionName: '成都',
  ownerStaffCode: 'A',
  ownerStaffName: '业务员A',
  orderDate: '2026-09-25',
  ageDays: 25,
  orderAmount: 312.01,
  paidAmount: 100.13,
  products: [
    {
      categoryId: '11',
      categoryName: '台呢子分类',
      productId: '1',
      productName: '台呢A',
      riskLevel: 'HIGH',
      productAmount: 312.01,
    },
  ],
}
const matching = Array.from({ length: 25 }, (_, i) => ({
  ...order,
  orderId: String(i),
  orderNo: `DEMO-${i}`,
  ageDays: i + 20,
}))
const data: PaymentRiskData = {
  generatedAt: '2026-10-20T00:00:00Z',
  dataUpdatedAt: null,
  categories: [
    { id: '1', parentId: null, name: '台呢' },
    { id: '11', parentId: '1', name: '台呢子分类' },
  ],
  regions: [
    { code: 'SC', parentCode: null, name: '四川' },
    { code: 'CD', parentCode: 'SC', name: '成都' },
  ],
  orders: [
    ...matching,
    matching[0]!,
    { ...order, orderId: 'other-region', regionCode: 'SZ', regionName: '深圳' },
    { ...order, orderId: 'other-owner', ownerStaffCode: 'B', ownerStaffName: '业务员B' },
    { ...order, orderId: 'other-category', products: [{ ...order.products[0]!, categoryId: '2' }] },
    { ...order, orderId: 'other-risk', products: [{ ...order.products[0]!, riskLevel: 'LOW' }] },
    { ...order, orderId: 'other-month', orderDate: '2026-10-01' },
    {
      ...order,
      orderId: 'other-product',
      products: [{ ...order.products[0]!, productId: '2', productName: '台呢B' }],
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(buildPaymentRiskExcel).mockResolvedValue({
    bytes: new Uint8Array([1]),
    filename: '明细.xlsx',
  })
})

const render = () =>
  mount(PaymentRiskBoard, {
    props: { data, initialRange: ['2026-09', '2026-10'] },
    global: { plugins: [ElementPlus], stubs: { EchartsChart: true } },
  })
const exportButton = (wrapper: ReturnType<typeof render>) =>
  wrapper.get('button[title="导出当前查询及下钻的全部订单"]')

describe('风险回款看板导出入口', () => {
  it('使用已查询的筛选和月份/产品下钻结果，去重排序导出全部页，未提交条件不影响导出', async () => {
    const wrapper = render()
    try {
      for (const [label, value] of [
        ['城市', 'SC'],
        ['业务员', 'A'],
        ['风险等级', 'HIGH'],
      ]) {
        wrapper
          .findAllComponents(ElSelect)
          .find((c) => c.props('ariaLabel') === label)!
          .vm.$emit('update:modelValue', value)
      }
      wrapper.findComponent(ElTreeSelect).vm.$emit('update:modelValue', ['1'])
      await wrapper.get('form').trigger('submit')
      await wrapper.get('button[aria-label="成都 2026-09 订单金额"]').trigger('click')
      const productToggle = wrapper.findAll('button').find((b) => b.text() === '产品')!
      await productToggle.trigger('click')
      await wrapper
        .findAll('button')
        .find((b) => b.text() === '台呢A')!
        .trigger('click')
      // 仅更改输入而未查询，不得把新输入写成已导出条件。
      wrapper
        .findAllComponents(ElSelect)
        .find((c) => c.props('ariaLabel') === '业务员')!
        .vm.$emit('update:modelValue', 'B')
      wrapper.findAllComponents(ElDatePicker)[0]!.vm.$emit('update:modelValue', '2026-01')
      await exportButton(wrapper).trigger('click')
      await flushPromises()
      const exported = vi.mocked(buildPaymentRiskExcel).mock.calls[0]![0]
      expect(exported.orders.map((o) => o.orderNo)).toEqual(
        [...matching].reverse().map((o) => o.orderNo),
      )
      expect(exported.range).toEqual(['2026-09', '2026-10'])
      expect(exported.scope).toContainEqual(['业务员', '业务员A'])
      expect(exported.scope).toContainEqual(['下钻订单月份', '2026-09'])
      expect(exported.scope).toContainEqual(['下钻产品', '台呢A'])
      expect(exported.orders.reduce((sum, o) => sum + Math.round(o.orderAmount * 100), 0)).toBe(
        780025,
      )
      expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), '明细.xlsx')
    } finally {
      wrapper.unmount()
    }
  })

  it('加载中、读取失败和空结果禁止导出；生成失败展示错误并允许重试', async () => {
    const wrapper = render()
    try {
      for (const state of [
        { loading: true },
        { loading: false, error: '读取失败' },
        { error: '', data: { ...data, orders: [] } },
      ]) {
        await wrapper.setProps(state)
        expect(exportButton(wrapper).attributes('disabled')).toBeDefined()
      }
      expect(buildPaymentRiskExcel).not.toHaveBeenCalled()
      await wrapper.setProps({ data })
      vi.mocked(buildPaymentRiskExcel).mockRejectedValueOnce(new Error('生成失败'))
      await exportButton(wrapper).trigger('click')
      await flushPromises()
      expect(wrapper.get('[role="alert"]').text()).toBe('生成失败')
      expect(downloadBlob).not.toHaveBeenCalled()
      await exportButton(wrapper).trigger('click')
      await flushPromises()
      expect(downloadBlob).toHaveBeenCalledTimes(1)
    } finally {
      wrapper.unmount()
    }
  })
})
