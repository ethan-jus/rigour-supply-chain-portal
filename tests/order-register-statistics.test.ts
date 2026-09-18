import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ElementPlus from 'element-plus'

const mocks = vi.hoisted(() => ({
  getPeriod: vi.fn(),
  getReceivables: vi.fn(),
  exportCsv: vi.fn(),
  getCreators: vi.fn(),
  getAllAreas: vi.fn(),
  getEmployees: vi.fn(),
  getDepartments: vi.fn(),
  push: vi.fn(),
}))

vi.mock('@/api/core/order-register', () => ({
  getOrderRegisterPeriod: mocks.getPeriod,
  getOrderRegisterReceivables: mocks.getReceivables,
  exportOrderRegisterCsv: mocks.exportCsv,
  getOrderRegisterCreators: mocks.getCreators,
}))
vi.mock('@/api/core/crm', () => ({ getAllCrmCustomerAreas: mocks.getAllAreas }))
vi.mock('@/api/core/hr', () => ({
  getHrEmployees: mocks.getEmployees,
  hrOrganizationApi: { departments: mocks.getDepartments },
}))
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRouter: () => ({ push: mocks.push }),
    useRoute: () => ({ query: {} }),
  }
})

import OrderStatisticsView from '@/views/supply-chain/order/OrderStatisticsView.vue'

describe('订单与回款统计页', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAllAreas.mockResolvedValue([])
    mocks.getDepartments.mockResolvedValue([])
    mocks.getEmployees.mockResolvedValue({ items: [] })
    mocks.getCreators.mockResolvedValue([])
    mocks.getPeriod.mockResolvedValue({
      dateFrom: '2026-09-01',
      dateTo: '2026-09-10',
      groupBy: 'employee',
      totals: {
        periodOrderAmount: 2000,
        periodReceivedAmount: 600,
        periodRefundAmount: 0,
        periodNetReceivedAmount: 600,
        endingUnpaidAmount: 2400,
      },
      rows: [
        {
          key: 'E001',
          label: '张三',
          periodOrderAmount: 2000,
          periodReceivedAmount: 600,
          periodRefundAmount: 0,
          periodNetReceivedAmount: 600,
          endingUnpaidAmount: 2400,
        },
      ],
      coverage: null,
    })
    mocks.getReceivables.mockResolvedValue({
      asOfDate: '2026-09-10',
      totals: {
        receivableAmount: null,
        netReceivedAmount: null,
        unpaidAmount: 2400,
        overpaidAmount: 0,
      },
      items: [
        {
          orderId: '1',
          orderNo: 'A001',
          customerId: 'c1',
          customerCode: 'C001',
          customerName: '测试客户',
          regionCode: 'HZ',
          regionName: '杭州',
          ownerEmployeeCode: 'E001',
          ownerEmployeeName: '张三',
          departmentId: null,
          departmentName: null,
          orderDate: '2026-09-01T08:00:00+08:00',
          receivableAmount: null,
          netReceivedAmount: null,
          unpaidAmount: 2400,
          overpaidAmount: 0,
          historyComplete: false,
          coverageFrom: '2026-09-04',
        },
      ],
      coverage: { historyComplete: false, coverageFrom: '2026-09-04' },
    })
  })

  it('期间经营按下单/到账分别统计，期末未回款包含往期订单', async () => {
    const wrapper = mount(OrderStatisticsView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const vm = wrapper.vm as unknown as {
      periodFilters: { range: [string, string] | null; groupBy: string }
      loadPeriod: () => Promise<void>
    }
    vm.periodFilters.range = ['2026-09-01', '2026-09-10']
    vm.periodFilters.groupBy = 'employee'
    await vm.loadPeriod()
    await flushPromises()
    expect(mocks.getPeriod).toHaveBeenCalledWith({
      dateFrom: '2026-09-01',
      dateTo: '2026-09-10',
      groupBy: 'employee',
    })
    expect(wrapper.text()).toContain('期间订单额')
    expect(wrapper.text()).toContain('期间实收金额')
    expect(wrapper.text()).toContain('期末未回款')
    expect(wrapper.text()).toContain('¥2,000.00')
    expect(wrapper.text()).toContain('¥2,400.00')
    wrapper.unmount()
  })

  it('截至日未回款使用 asOfDate 与 hasUnpaid，覆盖不完整不填零', async () => {
    const wrapper = mount(OrderStatisticsView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const vm = wrapper.vm as unknown as {
      activeTab: string
      receivablesFilters: { asOfDate: string; hasUnpaid: string }
      loadReceivables: () => Promise<void>
    }
    vm.activeTab = 'receivables'
    vm.receivablesFilters.asOfDate = '2026-09-10'
    vm.receivablesFilters.hasUnpaid = 'true'
    await vm.loadReceivables()
    await flushPromises()
    expect(mocks.getReceivables).toHaveBeenCalledWith({
      asOfDate: '2026-09-10',
      hasUnpaid: true,
    })
    expect(wrapper.text()).toContain('截至 2026-09-10 未回款')
    expect(wrapper.text()).toContain('未提供')
    expect(wrapper.text()).toContain('¥2,400.00')
    expect(wrapper.text()).toContain('历史数据仅可从 2026-09-04 起准确回溯')
    wrapper.unmount()
  })

  it('缺少必填日期时不请求，并给出提示', async () => {
    const wrapper = mount(OrderStatisticsView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    const vm = wrapper.vm as unknown as {
      periodFilters: { range: [string, string] | null }
      loadPeriod: () => Promise<void>
    }
    vm.periodFilters.range = null
    await vm.loadPeriod()
    expect(mocks.getPeriod).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
