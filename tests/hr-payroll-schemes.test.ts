import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Page from '@/views/supply-chain/hr/PayrollSchemeView.vue'
import { newPayrollScheme } from '@/utils/payroll-scheme'
describe('移除重复方案流程', () => {
  it('旧书签仅引导到员工档案及规则入口，不再提供创建发布方案', () => {
    const page = mount(Page, {
      global: {
        stubs: {
          SupplyPageTitle: true,
          ElAlert: { props: ['title'], template: '<p>{{title}}</p>' },
          RouterLink: { template: '<a><slot/></a>' },
        },
      },
    })
    expect(page.text()).toContain('无需创建薪酬方案')
    expect(page.findAll('button')).toHaveLength(0)
    page.unmount()
  })
  it('初始表单不虚构薪资金额，保留已经确认的新人阶段', () => {
    const d = newPayrollScheme()
    expect(d.performanceBase).toBeNull()
    expect(d.baseSalary.tiers.every((t) => t.amount === null)).toBe(true)
    expect(d.sales.targets.map((t) => t.target)).toEqual([5000, 7000])
    expect(Object.keys(d.commission).sort()).toEqual([
      'managerAttribution',
      'rules',
      'standardDate',
    ])
  })
})
