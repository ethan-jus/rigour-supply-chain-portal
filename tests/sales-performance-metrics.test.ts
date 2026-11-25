import { flushPromises, shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, type Component } from 'vue'
import { businessMonth } from '@/utils/business-date'
import SalesPayrollBoard from '@/views/supply-chain/hr/SalesPayrollBoard.vue'
import SalesTeamOverview from '@/views/supply-chain/sales/SalesTeamOverview.vue'
import { summarizeOverviewGoal } from '@/views/supply-chain/sales/sales-overview-model'

const api = vi.hoisted(() => ({ analysis: vi.fn(), hr: vi.fn() }))
vi.mock('@/api/core/bi-sales-dashboard', () => ({ getSalesDashboardAnalysis: api.analysis }))
vi.mock('@/api/core/client', () => ({ apiClient: { get: api.hr } }))
vi.mock('@/stores/navigation', () => ({ useNavigationStore: () => ({ hasPath: () => false }) }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ hasPermission: () => false }) }))
vi.mock('vue-router', async (importActual) => ({
  ...(await importActual<typeof import('vue-router')>()),
  useRoute: () => ({ meta: { routeKey: 'supply.sales.performance' }, query: {} }),
}))

const table = defineComponent({ props: ['data'], template: '<div />' })
function render(component: Component = SalesTeamOverview) {
  return shallowMount(component, {
    global: {
      stubs: {
        ElTable: table,
        ElTableColumn: true,
        ElDatePicker: true,
        ElInput: true,
        ElButton: true,
        ElDrawer: true,
        ElAlert: true,
        ElSkeleton: true,
        ElEmpty: true,
        ElTabs: true,
        ElTabPane: true,
        RouterLink: true,
      },
    },
  })
}
const hr = [
  { employee: 'A', employeeName: '甲', settled: 0, target: 6000, visits: 2, expectedVisits: 4 },
  { employee: 'B', employeeName: '乙', settled: 6000, target: 3000, visits: 3, expectedVisits: 6 },
  {
    employee: 'C',
    employeeName: '丙',
    settled: 600,
    target: 0,
    collectionExempt: true,
    visits: null,
    expectedVisits: 4,
  },
  { employee: 'Z', employeeName: '丁', settled: 200, target: 0, visits: 0, expectedVisits: 0 },
]
const analysis = {
  people: [
    { code: 'A', name: '甲', sales: 6000, receipts: 2000, city: '杭州' },
    { code: 'B', name: '乙', sales: 0, receipts: 4000, city: '杭州' },
  ],
  goals: [
    {
      code: 'A',
      metric: 'SALES_AMOUNT',
      month: Number(businessMonth(new Date()).slice(5)),
      target: 10000,
    },
  ],
}
describe('人员月度达成', () => {
  it('经营回款只汇总有数据且有正目标的员工，保留零实绩、零目标和目标缺失的区别', () => {
    expect(
      summarizeOverviewGoal([
        { actual: 2000, target: 3000 },
        { actual: 0, target: 1000 },
        { actual: null, target: 4000 },
        { actual: 5000, target: 0 },
        { actual: 6000, target: null },
      ]),
    ).toEqual({
      actual: 2000,
      target: 4000,
      gap: 2000,
      percent: 50,
      progress: 50,
      missing: 1,
      zero: 1,
    })
    expect(summarizeOverviewGoal([{ actual: 4000, target: 3000 }])).toMatchObject({
      gap: 0,
      percent: 133.3,
      progress: 100,
    })
    expect(summarizeOverviewGoal([{ actual: null, target: 3000 }])).toMatchObject({
      percent: null,
      progress: 0,
    })
  })

  it('分别用下单、整单结清和有效拜访计算可比人数与团队达成率', async () => {
    api.analysis.mockResolvedValue(analysis)
    api.hr.mockResolvedValue(hr)
    const page = render()
    await flushPromises()
    const numbers = () => page.findAll('.stat-grid strong').map((n) => n.text())
    expect(numbers()).toEqual(['60.0%', '6,000.00', '10,000.00', '1 / 4'])
    await page.findAll('.score-tabs button')[1]!.trigger('click')
    expect(numbers()).toEqual(['66.7%', '6,000.00', '9,000.00', '2 / 4'])
    const rows = page.getComponent(table).props('data')
    expect(rows.find((r: { code: string }) => r.code === 'A').actual).toBe(0)
    expect(rows.find((r: { code: string }) => r.code === 'C').reason).toBe('免考核')
    expect(rows.find((r: { code: string }) => r.code === 'Z').reason).toBe('零目标')
    await page.findAll('.score-tabs button')[2]!.trigger('click')
    expect(numbers()).toEqual(['50.0%', '5 次', '10 次', '2 / 4'])
    page.unmount()
  })
  it('订单来源暂不可读时仍可核对有授权的 HR 业绩', async () => {
    api.analysis.mockRejectedValue(new Error('订单业绩暂不可读'))
    api.hr.mockResolvedValue(hr)
    const page = render()
    await flushPromises()
    await page.findAll('.score-tabs button')[1]!.trigger('click')
    expect(page.findAll('.stat-grid strong')[0]!.text()).toBe('66.7%')
    page.unmount()
  })
})

describe('销售薪酬看板整单结清汇总', () => {
  it('同一订单同时出现在旧口径管理岗和结清回款人时只汇总一次', async () => {
    const order = {
      orderNo: 'SO-1',
      settledOn: '2026-11-21',
      basis: 10000,
      state: 'ELIGIBLE',
    }
    api.hr.mockResolvedValue({
      month: '2026-11',
      employees: [
        {
          code: 'A',
          name: '城市总',
          role: 'CITY_MANAGER',
          status: 'READY',
          basis: 10000,
          basisSource: 'ORDER',
          orders: [{ ...order, id: '1' }],
          issues: [],
        },
        {
          code: 'B',
          name: '结清回款人',
          role: 'SALES',
          status: 'READY',
          basis: 10000,
          basisSource: 'SETTLEMENT_PAYMENT',
          orders: [{ ...order, id: 'FULL:1', settlementPaymentNo: 'RC-2', paymentOwnerCode: 'B' }],
          issues: [],
        },
      ],
    })
    const page = render(SalesPayrollBoard)
    await flushPromises()
    expect(page.findAll('.stat-grid strong').slice(0, 2).map((stat) => stat.text()))
      .toEqual(['10,000.00', '1'])
    expect(page.getComponent(table).props('data')).toHaveLength(2)
    page.unmount()
  })
})
