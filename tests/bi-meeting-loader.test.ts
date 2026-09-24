import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import BiMeetingPresentation from '@/views/supply-chain/bi/components/BiMeetingPresentation.vue'
import { meetingFixture } from './fixtures/bi-meeting-data'

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  overview: vi.fn(),
  trust: vi.fn(),
  analysis: vi.fn(),
}))
vi.mock('@/api/core/bi-access', () => ({ getBiEffectiveScope: mocks.access }))
vi.mock('@/api/core/bi', () => ({
  getSupplyDashboardOverview: mocks.overview,
  getSupplyDashboardDataTrust: mocks.trust,
  getSupplyDashboardOperatingAnalysis: mocks.analysis,
}))
const render = () =>
  mount(BiMeetingPresentation, {
    props: {
      query: {
        regionCode: 'BJ',
        ownerStaffCode: 'S1',
        customerTypeCode: 'STORE',
        sourceSystemCode: 'DHB',
      },
      scopeLabel: '北京 / 销售S1',
    },
    global: {
      stubs: {
        Teleport: true,
        BiCityMeetingBoard: {
          name: 'BiCityMeetingBoard',
          props: ['snapshot', 'allSnapshot', 'regionCode', 'loading', 'error'],
          template: '<div />',
        },
        BiMeetingBoard: {
          name: 'BiMeetingBoard',
          props: ['snapshot', 'month', 'error', 'loading'],
          template: '<div />',
        },
      },
    },
  })
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-22T02:00:00Z'))
  mocks.analysis.mockResolvedValue({
    cityReceipts: [],
    customerRetention: { orderingCustomerCount: 10, returningCustomerCount: 5 },
  })
  mocks.access.mockResolvedValue({ accessLevel: 'TENANT' })
  mocks.overview.mockImplementation(async (query) =>
    query.from.includes('2026-09') ? meetingFixture().current : meetingFixture().previous,
  )
  mocks.trust.mockResolvedValue(null)
})
afterEach(() => vi.useRealTimers())
describe('会议数据加载与隔离', () => {
  it('保留所有业务筛选并独立请求上月同期，不误用相邻等长区间', async () => {
    const wrapper = render()
    await flushPromises()
    expect(mocks.overview).toHaveBeenCalledTimes(2)
    expect(mocks.overview.mock.calls[0][0]).toMatchObject({
      from: '2026-09-01T00:00:00+08:00',
      to: '2026-09-21T23:59:59.999999+08:00',
      regionCode: 'BJ',
      ownerStaffCode: 'S1',
      customerTypeCode: 'STORE',
      sourceSystemCode: 'DHB',
    })
    expect(mocks.overview.mock.calls[1][0].from).toBe('2026-08-01T00:00:00+08:00')
    expect(wrapper.getComponent({ name: 'BiMeetingBoard' }).props('snapshot').current).toBeTruthy()
    wrapper.unmount()
  })
  it('前期查询失败仍展示本期，但不把失败当作零', async () => {
    mocks.overview
      .mockResolvedValueOnce(meetingFixture().current)
      .mockRejectedValueOnce(new Error('前期读取失败'))
    const wrapper = render()
    await flushPromises()
    const snapshot = wrapper.getComponent({ name: 'BiMeetingBoard' }).props('snapshot')
    expect(snapshot.previous).toBeNull()
    expect(snapshot.comparisonError).toContain('失败')
    wrapper.unmount()
  })
  it('快速切换城市时晚返回的请求不能覆盖新城市，并保留业务筛选', async () => {
    const wrapper = render()
    await flushPromises()
    const waiting: ((value: unknown) => void)[] = []
    mocks.overview.mockImplementation((query) =>
      query.regionCode === 'CITY-0'
        ? new Promise((resolve) => waiting.push(resolve))
        : Promise.resolve({ ...meetingFixture().current, generatedAt: 'new-city' }),
    )
    wrapper.getComponent({ name: 'BiMeetingBoard' }).vm.$emit('city', 'CITY-0')
    await flushPromises()
    const board = wrapper.getComponent({ name: 'BiCityMeetingBoard' })
    expect(board.props('snapshot')).toBeNull()
    board.vm.$emit('city', 'CITY-1')
    await flushPromises()
    expect(wrapper.getComponent({ name: 'BiCityMeetingBoard' }).props('regionCode')).toBe('CITY-1')
    expect(
      wrapper.getComponent({ name: 'BiCityMeetingBoard' }).props('snapshot').current.generatedAt,
    ).toBe('new-city')
    waiting.forEach((resolve) => resolve(meetingFixture().current))
    await flushPromises()
    expect(
      wrapper.getComponent({ name: 'BiCityMeetingBoard' }).props('snapshot').current.generatedAt,
    ).toBe('new-city')
    expect(mocks.analysis.mock.calls.at(-1)![0]).toMatchObject({
      regionCode: 'CITY-1',
      ownerStaffCode: 'S1',
      customerTypeCode: 'STORE',
      sourceSystemCode: 'DHB',
    })
    wrapper.unmount()
  })
  it('复购接口失败时保留订单数据并明确缺失，不使用旧复购指标代替', async () => {
    mocks.analysis.mockRejectedValue(new Error('读取失败'))
    const wrapper = render()
    await flushPromises()
    const snapshot = wrapper.getComponent({ name: 'BiMeetingBoard' }).props('snapshot')
    expect(snapshot.current).toBeTruthy()
    expect(snapshot.analysis).toBeNull()
    expect(snapshot.analysisError).toContain('读取失败')
    wrapper.unmount()
  })
  it('权限拒绝时不读取任何经营接口', async () => {
    mocks.access.mockResolvedValue({ accessLevel: 'DENIED', reason: '无经营权限' })
    const wrapper = render()
    await flushPromises()
    expect(mocks.overview).not.toHaveBeenCalled()
    expect(wrapper.getComponent({ name: 'BiMeetingBoard' }).props('snapshot')).toBeNull()
    wrapper.unmount()
  })
  it('本期读取失败不显示旧月份或伪造零值', async () => {
    mocks.overview.mockRejectedValue(new Error('网络读取失败'))
    const wrapper = render()
    await flushPromises()
    const board = wrapper.getComponent({ name: 'BiMeetingBoard' })
    expect(board.props('snapshot')).toBeNull()
    expect(board.props('error')).toContain('失败')
    wrapper.unmount()
  })
})

describe('年度经营总览下钻', () => {
  it('城市详情保留全年及上年范围，城市列表不被当前选择截断', async () => {
    const wrapper = mount(BiMeetingPresentation, {
      props: {
        embedded: true,
        initialCity: true,
        scopeLabel: '当前授权范围',
        query: { from: '2025-01-01', to: '2025-12-31', regionCode: 'CITY-0' },
      },
      global: {
        stubs: {
          Teleport: true,
          BiCityMeetingBoard: {
            name: 'BiCityMeetingBoard',
            props: ['annual', 'year', 'snapshot'],
            template: '<div />',
          },
        },
      },
    })
    await flushPromises()
    expect(mocks.overview.mock.calls[0][0]).toMatchObject({
      from: '2025-01-01T00:00:00+08:00',
      to: '2025-12-31T23:59:59.999999+08:00',
      regionCode: undefined,
    })
    expect(mocks.overview.mock.calls[1][0].from).toBe('2024-01-01T00:00:00+08:00')
    const board = wrapper.getComponent({ name: 'BiCityMeetingBoard' })
    expect(board.props('annual')).toBe(true)
    expect(board.props('year')).toBe(2025)
    expect(
      mocks.overview.mock.calls.some(
        ([query]) => query.regionCode === 'CITY-0' && query.to.startsWith('2025-12-31'),
      ),
    ).toBe(true)
    wrapper.unmount()
  })
})

describe('城市看板年月切换', () => {
  it('从年度切换到月份时保留所选城市并按完整自然月重查，不残留旧数据', async () => {
    const wrapper = mount(BiMeetingPresentation, {
      props: {
        embedded: true,
        initialCity: true,
        scopeLabel: '当前授权范围',
        query: { from: '2025-01-01', to: '2025-12-31', regionCode: 'CITY-0' },
      },
      global: {
        stubs: {
          Teleport: true,
          BiCityMeetingBoard: {
            name: 'BiCityMeetingBoard',
            props: ['annual', 'year', 'month', 'snapshot', 'regionCode'],
            emits: ['period'],
            template: '<div />',
          },
        },
      },
    })
    await flushPromises()
    const board = wrapper.getComponent({ name: 'BiCityMeetingBoard' })
    board.vm.$emit('period', 2026, 8)
    await flushPromises()
    const updatedBoard = wrapper.getComponent({ name: 'BiCityMeetingBoard' })
    expect(updatedBoard.props('annual')).toBe(false)
    expect(updatedBoard.props('month')).toBe('2026-08')
    expect(updatedBoard.props('regionCode')).toBe('CITY-0')
    expect(updatedBoard.props('snapshot').query).toMatchObject({
      regionCode: 'CITY-0',
      from: '2026-08-01T00:00:00+08:00',
      to: '2026-08-31T23:59:59.999999+08:00',
    })
    wrapper.unmount()
  })
})
