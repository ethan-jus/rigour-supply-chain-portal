import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HrDashboardView from '@/views/supply-chain/bi/HrDashboardView.vue'
import { getEmployeeAnalytics } from '@/api/core/bi-employees'

vi.mock('@/api/core/bi-employees', () => ({ getEmployeeAnalytics: vi.fn() }))
const get = vi.mocked(getEmployeeAnalytics)
const stubs = {
  PeopleDashboardFrame: { name: 'PeopleDashboardFrame', template: '<div><slot /></div>' },
  ElAlert: { props: ['title'], template: '<div role="alert">{{ title }}</div>' },
  ElEmpty: { props: ['description'], template: '<div>{{ description }}</div>' },
  ElTabs: { template: '<div><slot /></div>' },
  ElTabPane: { template: '<div><slot /></div>' },
  EchartsChart: true,
  ElTable: true,
  ElTableColumn: true,
  ElInput: true,
  ElPagination: true,
  ElButton: { template: '<button><slot /></button>' },
}
const create = () =>
  mount(HrDashboardView, { global: { stubs, directives: { loading: () => {} } } })
const query = { from: '2026-09-01T00:00:00Z', regionCode: 'BJ' }
const load = (wrapper: ReturnType<typeof create>) =>
  wrapper.findComponent({ name: 'PeopleDashboardFrame' }).vm.$emit('change', query)

describe('HR employee analytics', () => {
  beforeEach(() => vi.clearAllMocks())
  it('loads only after authorized scope is ready and keeps missing source separate from zero staff', async () => {
    get.mockResolvedValue({
      status: 'NOT_READY',
      summary: null,
      syncedAt: null,
      cities: [],
      positions: [],
      employees: [],
      months: [],
      from: '',
      to: '',
    })
    const wrapper = create()
    expect(get).not.toHaveBeenCalled()
    load(wrapper)
    await flushPromises()
    expect(get).toHaveBeenCalledWith({ from: '2026-09-01T00:00:00Z', regionCode: 'BJ' })
    expect(wrapper.text()).toContain('员工数据尚未同步')
    expect(wrapper.find('.metric-grid').exists()).toBe(false)
    wrapper.unmount()
  })
  it('does not turn an API failure into an empty personnel result', async () => {
    get.mockRejectedValue(new Error('服务不可用'))
    const wrapper = create()
    load(wrapper)
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('服务不可用')
    expect(wrapper.text()).not.toContain('当前范围暂无员工档案')
    wrapper.unmount()
  })
  it('shows current headcount independently of ordering employees and reports missing fields', async () => {
    get.mockResolvedValue({
      status: 'READY',
      syncedAt: '2026-09-15T00:00:00Z',
      from: '',
      to: '',
      summary: {
        total: 3,
        active: 1,
        left: 1,
        inactive: 1,
        pending: 0,
        joinedInPeriod: 1,
        leftInPeriod: 1,
        missingEntryDate: 1,
        missingDepartment: 3,
        unmappedCity: 0,
        orderingEmployees: 1,
      },
      cities: [{ name: '北京', total: 3, active: 1, left: 1 }],
      positions: [],
      employees: [],
      months: [],
    })
    const wrapper = create()
    load(wrapper)
    await flushPromises()
    expect(wrapper.text().replace(/\s/g, '')).toContain('员工档案3人')
    expect(wrapper.text()).toContain('期间有订单 1 人')
    expect(wrapper.text()).toContain('1 人缺入职日期')
    wrapper.unmount()
  })
})
