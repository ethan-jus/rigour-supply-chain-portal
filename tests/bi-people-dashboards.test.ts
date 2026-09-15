import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PeopleDashboardFrame from '@/views/supply-chain/bi/components/PeopleDashboardFrame.vue'
import VisitDashboardView from '@/views/supply-chain/bi/VisitDashboardView.vue'
import { getBiEffectiveScope } from '@/api/core/bi-access'
import { getSupplyDashboardFilterOptions } from '@/api/core/bi'
import { getVisitAnalytics, type VisitAnalytics } from '@/api/core/bi-visits'
vi.mock('@/api/core/bi-access', () => ({ getBiEffectiveScope: vi.fn() }))
vi.mock('@/api/core/bi', () => ({ getSupplyDashboardFilterOptions: vi.fn() }))
vi.mock('@/api/core/bi-visits', () => ({ getVisitAnalytics: vi.fn() }))
const access = {
  accessLevel: 'SELF' as const,
  reasonCode: 'OK',
  reason: null,
  regionCodes: ['BJ'],
  employeeCode: 'E1',
  ownerStaffCode: 'E1',
  defaultRegionCode: 'BJ',
  defaultOwnerStaffCode: 'E1',
  globalGovernance: false,
  unavailableSubjects: [],
}
const stubs = {
  ElButton: { template: '<button><slot /></button>' },
  ElDatePicker: true,
  ElSelect: true,
  ElOption: true,
  ElAlert: { props: ['title'], template: '<div role="alert">{{ title }}</div>' },
  ElEmpty: { props: ['description'], template: '<div>{{ description }}</div>' },
  EchartsChart: true,
  ElProgress: true,
  ElTable: true,
  ElTableColumn: true,
  ElInput: true,
  ElPagination: true,
}
const global = { stubs, directives: { loading: () => {} } }
const result = (visits: number): VisitAnalytics => ({
  status: 'READY',
  syncedAt: '2026-09-15T00:00:00Z',
  from: '',
  to: '',
  days: [],
  cities: [],
  people: [],
  summary: {
    visits,
    contactedStores: 2,
    visitingPeople: 2,
    repeatStores: 1,
    approvedVisits: 1,
    pendingVisits: visits - 2,
    flaggedVisits: 1,
    unlinkedEmployeeVisits: 1,
    crmLinkedStores: 1,
  },
})
describe('people dashboard scope and lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getBiEffectiveScope).mockResolvedValue(access)
    vi.mocked(getSupplyDashboardFilterOptions).mockResolvedValue({
      regions: [{ optionType: 'REGION', optionValue: 'BJ', optionLabel: '北京', usageCount: 1 }],
      salesOwners: [],
      customerTypes: [],
      productCategories: [],
      sourceSystems: [],
    })
  })
  it('keeps SELF city and employee when resetting filters', async () => {
    const wrapper = mount(PeopleDashboardFrame, { props: { title: 'HR', description: '' }, global })
    expect(wrapper.emitted('change')).toBeUndefined()
    await flushPromises()
    expect(wrapper.emitted('change')?.[0]?.[0]).toMatchObject({
      regionCode: 'BJ',
      ownerStaffCode: 'E1',
    })
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '重置筛选')!
      .trigger('click')
    expect(wrapper.emitted('change')?.at(-1)?.[0]).toMatchObject({
      regionCode: 'BJ',
      ownerStaffCode: 'E1',
      from: expect.stringMatching(/T00:00:00\+08:00$/),
    })
    wrapper.unmount()
  })
  it('denied scope never loads filters or emits a data query', async () => {
    vi.mocked(getBiEffectiveScope).mockResolvedValue({
      ...access,
      accessLevel: 'DENIED',
      reason: '无数据权限',
    })
    const wrapper = mount(PeopleDashboardFrame, { props: { title: 'HR', description: '' }, global })
    await flushPromises()
    expect(getSupplyDashboardFilterOptions).not.toHaveBeenCalled()
    expect(wrapper.emitted('change')).toBeUndefined()
    expect(wrapper.text()).toContain('无数据权限')
    wrapper.unmount()
  })
  it('clears old scope and ignores a late response while showing independent store totals', async () => {
    let resolveOld!: (value: VisitAnalytics) => void
    vi.mocked(getVisitAnalytics)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveOld = resolve
        }),
      )
      .mockResolvedValueOnce(result(7))
    const wrapper = mount(VisitDashboardView, {
      global: {
        ...global,
        stubs: {
          ...stubs,
          PeopleDashboardFrame: { name: 'PeopleDashboardFrame', template: '<main><slot /></main>' },
        },
      },
    })
    const frame = wrapper.findComponent({ name: 'PeopleDashboardFrame' })
    frame.vm.$emit('change', { regionCode: 'BJ' })
    await flushPromises()
    frame.vm.$emit('change', { regionCode: 'SH' })
    await flushPromises()
    resolveOld(result(100))
    await flushPromises()
    const cards = wrapper.get('.metric-grid').text().replace(/\s/g, '')
    expect(cards).toContain('已提交拜访7次')
    expect(cards).toContain('建联客户2家')
    expect(cards).not.toContain('100')
    expect(wrapper.text()).toContain('不要求微信截图')
    expect(wrapper.text()).toContain('业务关联覆盖')
    wrapper.unmount()
  })
  it('shows source-not-ready and errors separately from zero activity', async () => {
    vi.mocked(getVisitAnalytics)
      .mockResolvedValueOnce({ ...result(0), status: 'NOT_READY', summary: null })
      .mockRejectedValueOnce(new Error('连接失败'))
    const wrapper = mount(VisitDashboardView, {
      global: {
        ...global,
        stubs: {
          ...stubs,
          PeopleDashboardFrame: { name: 'PeopleDashboardFrame', template: '<main><slot /></main>' },
        },
      },
    })
    const frame = wrapper.findComponent({ name: 'PeopleDashboardFrame' })
    frame.vm.$emit('change', {})
    await flushPromises()
    expect(wrapper.text()).toContain('尚未就绪')
    expect(wrapper.find('.metric-grid').exists()).toBe(false)
    frame.vm.$emit('change', {})
    await flushPromises()
    expect(wrapper.text()).toContain('连接失败')
    expect(wrapper.text()).not.toContain('没有已提交拜访')
    wrapper.unmount()
  })
})
