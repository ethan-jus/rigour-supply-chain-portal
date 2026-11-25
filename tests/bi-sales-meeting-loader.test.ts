import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import BiSalesMeetingPresentation from '@/views/supply-chain/bi/components/BiSalesMeetingPresentation.vue'
import { salesDashboardFixture } from './fixtures/bi-sales-dashboard-data'
vi.mock('@/views/supply-chain/bi/components/BiSalesMeetingBoard.vue', () => ({
  default: { name: 'BiSalesMeetingBoard', template: '<div/>' },
}))
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  overview: vi.fn(),
  analysis: vi.fn(),
  sales: vi.fn(),
  summary: vi.fn(),
}))
vi.mock('@/api/core/bi-access', () => ({ getBiEffectiveScope: mocks.access }))
vi.mock('@/api/core/bi', () => ({
  getSupplyDashboardOverview: mocks.overview,
  getSupplyDashboardOperatingAnalysis: mocks.analysis,
}))
vi.mock('@/api/core/bi-sales-dashboard', () => ({
  getSalesDashboardAnalysis: mocks.sales,
  getSalesDashboardSummary: mocks.summary,
}))
const render = () =>
  mount(BiSalesMeetingPresentation, {
    props: {
      query: {
        from: '2026-08-01T00:00:00+08:00',
        to: '2026-08-31T23:59:59+08:00',
        sourceSystemCode: 'DHB',
      },
      scopeLabel: '当前范围',
      embedded: true,
    },
    global: {
      stubs: {
        Teleport: true,
        BiSalesMeetingBoard: {
          name: 'BiSalesMeetingBoard',
          props: [
            'snapshot',
            'detail',
            'selectedCode',
            'period',
            'dayMode',
            'error',
            'detailError',
            'filteredSummary',
            'summaryLoading',
            'summaryError',
          ],
          template: '<div/>',
        },
      },
    },
  })
const board = (w: ReturnType<typeof render>) => w.getComponent({ name: 'BiSalesMeetingBoard' })
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
  vi.setSystemTime(new Date('2026-09-24T00:00:00Z'))
  const f = salesDashboardFixture()
  mocks.access.mockResolvedValue({ accessLevel: 'TENANT' })
  mocks.overview.mockImplementation(async (q) => ({ ...f.current, from: q.from, to: q.to }))
  mocks.analysis.mockResolvedValue(f.analysis)
  mocks.sales.mockResolvedValue(f.sales)
})
afterEach(() => vi.useRealTimers())
describe('销售看板查询入口', () => {
  it('手动刷新同时回源看板和当前姓名筛选汇总', async () => {
    mocks.summary.mockResolvedValue({ sales: 1, receipts: 0, customers: 1, newCustomers: 0, returningCustomers: 0, annualReturningCustomers: 0 })
    const w = render()
    await flushPromises()
    board(w).vm.$emit('filter', ['S1'])
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    mocks.sales.mockClear()
    mocks.summary.mockClear()
    board(w).vm.$emit('refresh')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    expect(mocks.sales).toHaveBeenCalledWith(expect.any(Object), true, 'RANKING', expect.any(Object))
    expect(mocks.summary).toHaveBeenCalledWith(expect.any(Object), ['S1'], true)
    w.unmount()
  })
  it('姓名汇总保留时间来源筛选，清空与无匹配不会请求全员总数', async () => {
    const totals = {
      sales: 234,
      receipts: 0,
      customers: 1,
      newCustomers: 1,
      returningCustomers: 0,
      annualReturningCustomers: 0,
    }
    mocks.summary.mockResolvedValue(totals)
    const w = render()
    await flushPromises()
    board(w).vm.$emit('filter', ['S1'])
    await flushPromises()
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()
    expect(mocks.summary).toHaveBeenCalledTimes(2)
    expect(mocks.summary).toHaveBeenCalledWith(
      expect.objectContaining({ sourceSystemCode: 'DHB', from: '2026-08-01T00:00:00+08:00' }),
      ['S1'],
      false,
    )
    expect(board(w).props('filteredSummary').current.sales).toBe(234)
    board(w).vm.$emit('filter', [])
    await flushPromises()
    expect(board(w).props('filteredSummary').current.customers).toBe(0)
    expect(mocks.summary).toHaveBeenCalledTimes(2)
    board(w).vm.$emit('filter', null)
    await flushPromises()
    expect(board(w).props('filteredSummary')).toBeNull()
    w.unmount()
  })
  it('旧搜索迟到和失败都不能重新显示其他范围的汇总', async () => {
    const resolvers: ((data: unknown) => void)[] = []
    mocks.summary.mockImplementation(
      () =>
        new Promise((r) => {
          resolvers.push(r)
        }),
    )
    const w = render()
    await flushPromises()
    board(w).vm.$emit('filter', ['S1'])
    await flushPromises()
    await vi.advanceTimersByTimeAsync(250)
    board(w).vm.$emit('filter', [])
    await flushPromises()
    resolvers.forEach((resolve) => resolve({ sales: 999 }))
    await flushPromises()
    expect(board(w).props('filteredSummary').current.sales).toBe(0)
    mocks.summary.mockRejectedValue(new Error('网络错误'))
    board(w).vm.$emit('filter', ['S2'])
    await flushPromises()
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()
    expect(board(w).props('filteredSummary')).toBeNull()
    expect(board(w).props('summaryError')).toBeTruthy()
    w.unmount()
  })
  it('保留业务筛选和自然月上期边界', async () => {
    const w = render()
    await flushPromises()
    expect(mocks.sales).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceSystemCode: 'DHB',
        from: '2026-07-01T00:00:00+08:00',
        to: '2026-07-31T23:59:59.999999+08:00',
      }),
      false,
      'COMPARISON',
      expect.any(Object),
    )
    expect(board(w).props('snapshot')).not.toBeNull()
    w.unmount()
  })
  it('权限检查并行执行，访问被拒时不展示数据', async () => {
    mocks.access.mockResolvedValue({ accessLevel: 'DENIED', reason: '无权限' })
    const w = render()
    await flushPromises()
    expect(mocks.overview).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), 'SALES')
    expect(board(w).props('snapshot')).toBeNull()
    expect(board(w).props('error')).toContain('无权限')
    w.unmount()
  })
  it('上期请求未返回时先展示本期排名', async () => {
    let resolve!: (value: unknown) => void
    mocks.sales.mockImplementation((_query, _cacheBypass, projection) =>
      projection === 'COMPARISON'
        ? new Promise((done) => { resolve = done })
        : Promise.resolve(salesDashboardFixture().sales),
    )
    const w = render()
    await flushPromises()
    expect(board(w).props('snapshot').sales.people.length).toBeGreaterThan(0)
    expect(board(w).props('snapshot').previous).toBeNull()
    resolve(salesDashboardFixture().sales)
    await flushPromises()
    expect(board(w).props('snapshot').previous).not.toBeNull()
    w.unmount()
  })
  it('一月选择全年仍对比上年同期，不退回月视图', async () => {
    vi.setSystemTime(new Date('2026-01-24T00:00:00Z'))
    const w = render()
    await flushPromises()
    mocks.sales.mockClear()
    board(w).vm.$emit('period', { from: '2026-01-01', to: '2026-01-24' }, true)
    await flushPromises()
    expect(mocks.sales).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '2025-01-01T00:00:00+08:00',
        to: '2025-01-24T23:59:59.999999+08:00',
      }),
      false,
      'COMPARISON',
      expect.any(Object),
    )
    w.unmount()
  })
  it('按日查北京时间完整一天及前一天，不扩成整月', async () => {
    const w = render()
    await flushPromises()
    mocks.sales.mockClear()
    board(w).vm.$emit('day', '2026-08-12')
    await flushPromises()
    expect(board(w).props('dayMode')).toBe(true)
    expect(mocks.sales).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '2026-08-12T00:00:00+08:00',
        to: '2026-08-12T23:59:59.999999+08:00',
      }),
      false,
      'RANKING',
      expect.any(Object),
    )
    expect(mocks.sales).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '2026-08-11T00:00:00+08:00',
        to: '2026-08-11T23:59:59.999999+08:00',
      }),
      false,
      'COMPARISON',
      expect.any(Object),
    )
    w.unmount()
  })
  it('个人请求保留城市与来源，到账趋势替换旧经办人序列', async () => {
    const f = salesDashboardFixture()
    f.sales!.dailyReceipts = [{ period: '2026-08-12', value: 50 }]
    mocks.sales.mockResolvedValue(f.sales)
    const w = render()
    await flushPromises()
    board(w).vm.$emit('city', 'HZ')
    await flushPromises()
    board(w).vm.$emit('select', 'S1')
    await flushPromises()
    expect(mocks.sales).toHaveBeenCalledWith(
      expect.objectContaining({ regionCode: 'HZ', ownerStaffCode: 'S1', sourceSystemCode: 'DHB' }),
      false,
      undefined,
      expect.any(Object),
    )
    const detail = board(w).props('detail')
    expect(detail.current.collectionTrend[0].value).toBe(50)
    expect(
      detail.current.metrics.find((m: { metricCode: string }) => m.metricCode === 'receipt_amount')
        .value,
    ).toBe(50)
    w.unmount()
  })
  it('刷新失败清空旧数据', async () => {
    const w = render()
    await flushPromises()
    mocks.sales.mockRejectedValue(new Error('暂不可用'))
    board(w).vm.$emit('refresh')
    await flushPromises()
    expect(board(w).props('snapshot')).toBeNull()
    expect(board(w).props('error')).toContain('暂不可用')
    w.unmount()
  })
  it('迟到个人查询不会覆盖新选择', async () => {
    const w = render()
    await flushPromises()
    let resolve!: (v: unknown) => void
    mocks.sales.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r
        }),
    )
    board(w).vm.$emit('select', 'S1')
    await flushPromises()
    board(w).vm.$emit('select', 'S2')
    await flushPromises()
    const latest = board(w).props('detail')
    resolve({ ...salesDashboardFixture().sales, people: [] })
    await flushPromises()
    expect(board(w).props('selectedCode')).toBe('S2')
    expect(board(w).props('detail')).toEqual(latest)
    w.unmount()
  })
})
