import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import BiSalesMeetingPresentation from '@/views/supply-chain/bi/components/BiSalesMeetingPresentation.vue'
import { salesDashboardFixture } from './fixtures/bi-sales-dashboard-data'
const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  overview: vi.fn(),
  analysis: vi.fn(),
  sales: vi.fn(),
}))
vi.mock('@/api/core/bi-access', () => ({ getBiEffectiveScope: mocks.access }))
vi.mock('@/api/core/bi', () => ({
  getSupplyDashboardOverview: mocks.overview,
  getSupplyDashboardOperatingAnalysis: mocks.analysis,
}))
vi.mock('@/api/core/bi-sales-dashboard', () => ({ getSalesDashboardAnalysis: mocks.sales }))
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
          ],
          template: '<div/>',
        },
      },
    },
  })
const board = (w: ReturnType<typeof render>) => w.getComponent({ name: 'BiSalesMeetingBoard' })
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-24T00:00:00Z'))
  const f = salesDashboardFixture()
  mocks.access.mockResolvedValue({ accessLevel: 'TENANT' })
  mocks.overview.mockImplementation(async (q) => ({ ...f.current, from: q.from, to: q.to }))
  mocks.analysis.mockResolvedValue(f.analysis)
  mocks.sales.mockResolvedValue(f.sales)
})
afterEach(() => vi.useRealTimers())
describe('销售看板查询入口', () => {
  it('保留业务筛选和自然月上期边界', async () => {
    const w = render()
    await flushPromises()
    expect(mocks.sales).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceSystemCode: 'DHB',
        from: '2026-07-01T00:00:00+08:00',
        to: '2026-07-31T23:59:59.999999+08:00',
      }),
    )
    expect(board(w).props('snapshot')).not.toBeNull()
    w.unmount()
  })
  it('拒绝权限后不查询业务数据', async () => {
    mocks.access.mockResolvedValue({ accessLevel: 'DENIED', reason: '无权限' })
    const w = render()
    await flushPromises()
    expect(mocks.overview).not.toHaveBeenCalled()
    expect(board(w).props('snapshot')).toBeNull()
    expect(board(w).props('error')).toContain('无权限')
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
    )
    expect(mocks.sales).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '2026-08-11T00:00:00+08:00',
        to: '2026-08-11T23:59:59.999999+08:00',
      }),
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
