import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Summary from '@/views/supply-chain/hr/components/PayrollCommissionSummary.vue'
import type { PayrollCalculation, PayrollDetail } from '@/api/core/payroll'

const line = (role: string, released: number, accrued = released) =>
  ({ recipientRoleCode: role, released, accrued }) as PayrollDetail
const calculation = (details: PayrollDetail[], commission: number) =>
  ({ details, commission, heldCommission: 75, rules: [] }) as unknown as PayrollCalculation

describe('城市总本期提成构成', () => {
  it('分别展示三类本期金额，待回款应计不混入发放合计', () => {
    const wrapper = mount(Summary, {
      props: {
        calculation: calculation(
          [
            line('CITY_TEAM', 1000),
            line('CITY_MANAGER', 200),
            line('SALES', 50),
            line('CITY_TEAM', 0, 75),
          ],
          1250,
        ),
        reviewHint: true,
      },
    })
    const parts = wrapper.findAll('.commission-summary__part').map((part) => part.text())
    expect(parts).toEqual([
      '团队销售提成（不含本人）1,000.00 元',
      '城市总独立提成200.00 元',
      '本人销售提成50.00 元',
      '本期计入工资的提成1,250.00 元',
    ])
    expect(wrapper.text()).toContain('待回款提成 75.00 元，不计入本期')
    expect(wrapper.text()).toContain('实际付款以发放登记为准')
    expect(wrapper.text()).toContain('建议先完成所辖销售的薪酬确认')
  })
  it('销售人员不会显示城市总说明', () => {
    const wrapper = mount(Summary, { props: { calculation: calculation([line('SALES', 50)], 50) } })
    expect(wrapper.find('section').exists()).toBe(false)
  })
})
