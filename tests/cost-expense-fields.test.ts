import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import CostExpenseFields from '@/views/supply-chain/cost/CostExpenseFields.vue'
import { getCost, getCosts, type CostCommand, type CostRecord } from '@/api/core/cost'
vi.mock('@/api/core/cost', () => ({ getCost: vi.fn(), getCosts: vi.fn() }))
const base = (type = 'TRAVEL'): CostCommand => ({
  requestId: 'test',
  revision: null,
  title: '',
  typeCode: type,
  cityCode: '4201',
  cityName: '武汉',
  departmentId: 1,
  ownerEmployeeCode: 'E1',
  costDate: '2026-10-02',
  amount: null,
  paymentStatusCode: 'UNPAID',
  logistics: null,
  rental: null,
  remark: '',
  reason: '',
})
const stubs = {
  ElFormItem: { template: '<label><slot /></label>' },
  ElCollapse: { template: '<div><slot /></div>' },
  ElCollapseItem: { template: '<div><slot /></div>' },
  CostReferenceSelect: true,
  CostDictSelect: true,
}
describe('报销业务字段', () => {
  it.each([
    ['TRAVEL', 'expense', false],
    ['ACCOMMODATION', 'expense', false],
    ['TAXI', 'expense', false],
    ['COURIER', 'expense', false],
    ['OFFICE_SUPPLIES', 'office', false],
    ['OFFICE_RENT', 'office', true],
    ['NETWORK', 'office', true],
    ['FREIGHT', 'freight', false],
    ['WAREHOUSE_RENT', 'warehouse', true],
    ['MARKETING', 'marketing', false],
    ['GOODS_PURCHASE', 'purchase', false],
  ])('按费用类型 %s 自动处理归集且不要求业务选择看板分类', async (type, category, monthly) => {
    const form = base(String(type))
    const wrapper = mount(CostExpenseFields, { props: { modelValue: form }, global: { stubs } })
    await nextTick()
    expect(form.expense?.costCategory).toBe(category)
    expect(wrapper.find('[label="看板归类"]').exists()).toBe(false)
    expect(wrapper.find('[label="费用所属月份"]').exists()).toBe(monthly)
    expect(wrapper.text()).not.toMatch(/看板|薪酬|归集|统计口径/)
    wrapper.unmount()
  })
  it('快递寄送仅展示实际业务明细，保留编辑值且不显示销售运输环节', async () => {
    const form = base('COURIER')
    form.expense = {
      costCategory: 'expense',
      purpose: '寄合作合同',
      courier: {
        contents: '合作合同',
        recipientName: '客户甲',
        companyName: '顺丰速运',
        trackingNo: 'SF00001234',
      },
    }
    const wrapper = mount(CostExpenseFields, { props: { modelValue: form }, global: { stubs } })
    await nextTick()
    for (const label of ['寄送内容', '收件客户 / 合作方', '快递公司', '运单号'])
      expect(wrapper.find(`[label="${label}"][required]`).exists()).toBe(true)
    expect(form.expense.courier?.trackingNo).toBe('SF00001234')
    expect(wrapper.find('[label="运输环节"]').exists()).toBe(false)
    expect(wrapper.find('[label="开始日期"]').exists()).toBe(false)
    wrapper.unmount()
  })
  it('差旅留在报销，随实际费用日确定月份，显示行程字段', async () => {
    const form = base()
    const wrapper = mount(CostExpenseFields, { props: { modelValue: form }, global: { stubs } })
    await nextTick()
    expect(form.expense?.costCategory).toBe('expense')
    expect(form.costMonth).toBe('2026-10')
    expect(wrapper.text()).toContain('车票、住宿、打车分别登记明细金额')
    expect(wrapper.findComponent({ name: 'CostReferenceSelect' }).exists()).toBe(false)
    wrapper.unmount()
  })
  it('选择原运费调用现有接口并带回金额、月份、原单版本和承运方', async () => {
    const form = base('FREIGHT')
    const row = {
      id: 'source',
      revision: 7,
      documentNo: 'CST-1',
      statusCode: 'CONFIRMED',
      data: {
        ...base(),
        title: '配送费',
        amount: 320,
        costDate: '2026-10-01',
        logistics: { legCode: 'DELIVERY', carrierName: '测试承运方' },
      },
    } as CostRecord
    vi.mocked(getCost).mockResolvedValue(row)
    vi.mocked(getCosts).mockResolvedValue({ total: 1, items: [row], begin: 0, step: 50 })
    const wrapper = mount(CostExpenseFields, { props: { modelValue: form }, global: { stubs } })
    const selector = wrapper.findComponent({ name: 'CostReferenceSelect' })
    const choices = await selector.props('loader')('CST-1', 0)
    expect(getCosts).toHaveBeenCalledWith(
      'logistics',
      expect.objectContaining({
        cityCode: '4201',
        statusCode: 'CONFIRMED',
        payerCode: 'COMPANY',
        documentNo: 'CST-1',
      }),
    )
    selector.vm.$emit('change', choices[0])
    await flushPromises()
    expect(getCost).toHaveBeenCalledWith('logistics', 'source')
    expect(form.amount).toBe(320)
    expect(form.expense?.relatedCost).toEqual({
      source: 'ORDER',
      category: 'LOGISTICS',
      id: 'source',
      revision: 7,
    })
    expect(form.expense?.payeeName).toBe('测试承运方')
    wrapper.unmount()
  })
})
