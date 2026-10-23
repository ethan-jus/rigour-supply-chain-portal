import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { useCostDashboard } from '@/views/supply-chain/bi/cost/use-cost-dashboard'
import {
  bars,
  line,
  money,
  waterfall,
  payrollHasRecords,
  comparisonCoverageNotice,
  overviewReading,
  detailDimensionValue,
  visibleDetailDimensions,
  resolveObjectLabels,
} from '@/views/supply-chain/bi/cost/cost-presentation'
import type { CostReport } from '@/api/core/bi-cost-dashboard'
import { costLabel } from '@/views/supply-chain/cost/cost-dictionaries'
const api = vi.hoisted(() => ({
  getCostReport: vi.fn(),
  getCostRecords: vi.fn(),
  getCostWorkspace: vi.fn(),
  getCostDetail: vi.fn(),
}))
vi.mock('@/api/core/bi-cost-dashboard', () => api)
vi.mock('@/views/supply-chain/cost/cost-dictionaries', () => ({
  loadCostDictionaries: vi.fn().mockResolvedValue(undefined),
  costLabel: vi.fn((_dict: string, code: string) => code),
}))
function report(snapshot = 's1', value = '100.01'): CostReport {
  const metric = {
    amount: value,
    count: 1,
    unpaid: '0.00',
    draftCount: 0,
    draftAmount: '0.00',
    missingCount: 0,
    unassigned: '0.00',
  }
  return {
    meta: {
      snapshotId: snapshot,
      metricVersion: 'cost-v5.1',
      generatedAt: '2026-10-16T06:00:00Z',
      effectiveCutoff: '2026-10-16',
      period: {
        from: '2026-10-01',
        to: '2026-10-16',
        previousFrom: '2026-09-01',
        previousTo: '2026-09-16',
        compare: 'previous',
      },
      includedSources: ['ERP'],
      excludedScopes: [],
      comparisonAvailable: false,
      comparisonReason: '无可比数据',
      dataState: 'READY',
      exportAllowed: false,
      availableCategories: ['office', 'purchase'],
    },
    scope: 'opex',
    category: null,
    dimension: null,
    current: metric,
    previous: metric,
    delta: null,
    growth: null,
    purchase: '1.00',
    loss: '0.00',
    increased: null,
    decreased: null,
    cities: [{ key: 'WH', label: '武汉市' }],
    categories: [],
    cityGroups: [],
    matrix: [],
    changes: [],
    objects: [],
    dimensionCoverage: null,
    dimensions: [],
    cumulative: [{ key: '1日', current: value, previous: null }],
    months: [],
    majorRecords: [],
    payrollComponents: [],
  }
}
function setup() {
  let state!: ReturnType<typeof useCostDashboard>
  const wrapper = mount(
    defineComponent({
      setup() {
        state = useCostDashboard()
        return () => h('div')
      },
    }),
  )
  return { state, wrapper }
}
beforeEach(() => {
  vi.clearAllMocks()
  api.getCostReport.mockResolvedValue(report())
  api.getCostRecords.mockResolvedValue({
    meta: report().meta,
    summary: { count: 0, confirmed: '0.00', draft: '0.00', missing: 0 },
    page: 1,
    size: 20,
    items: [],
  })
  api.getCostWorkspace.mockImplementation(async () => ({
    report: await api.getCostReport(),
    records: await api.getCostRecords(),
  }))
})
describe('成本看板正式查询交互', () => {
  it('快递详情不提示补充不适用的差旅字段，差旅缺项及真实已填值继续可见', () => {
    const values = { 费用类型: 'COURIER', 出差或报销事项: '未记录', 出差目的地: '未记录',
      收款方或合作方: '未记录', 收件客户或合作方: '合作方业务部', 运单号: 'SF001' }
    expect(visibleDetailDimensions({ source: 'HR', category: 'expense' }, values)).toEqual({
      费用类型: 'COURIER', 收件客户或合作方: '合作方业务部', 运单号: 'SF001',
    })
    expect(visibleDetailDimensions({ source: 'HR', category: 'expense' }, { ...values, 费用类型: 'TRAVEL' }))
      .toMatchObject({ 出差目的地: '未记录' })
    expect(visibleDetailDimensions({ source: 'HR', category: 'expense' }, { ...values, 收款方或合作方: '李四' }))
      .toMatchObject({ 收款方或合作方: '李四' })
  })
  it('uses the original reimbursement type after grouping the expense into another cost category', () => {
    for (const category of ['office', 'freight', 'marketing', 'purchase'] as const) {
      detailDimensionValue({ source: 'HR', category }, '费用类型', 'OFFICE_SUPPLIES')
      expect(costLabel).toHaveBeenLastCalledWith('REIMBURSEMENT_EXPENSE_TYPE', 'OFFICE_SUPPLIES')
    }
    detailDimensionValue({ source: 'ERP', category: 'marketing' }, '费用类型', 'ADVERTISING')
    expect(costLabel).toHaveBeenLastCalledWith('MARKETING_EXPENSE_TYPE', 'ADVERTISING')
    detailDimensionValue({ source: 'ERP', category: 'office' }, '费用类型', 'OFFICE')
    expect(costLabel).toHaveBeenLastCalledWith('COST_PREMISES_TYPE', 'OFFICE')
    detailDimensionValue({ source: 'ERP', category: 'warehouse' }, '费用类型', 'WAREHOUSE')
    expect(costLabel).toHaveBeenLastCalledWith('COST_PREMISES_TYPE', 'WAREHOUSE')
    expect(detailDimensionValue({ source: 'HR', category: 'expense' }, '员工', '张三')).toBe('张三')
  })
  it('keeps rental business details without suggesting an employee is missing', () => {
    const values = { 员工: '未记录', 费用类型: 'OFFICE', 合同: 'ZB-ZL-2026-10' }
    expect(visibleDetailDimensions({ source: 'ERP', category: 'office' }, values)).toEqual({
      费用类型: 'OFFICE',
      合同: 'ZB-ZL-2026-10',
    })
    expect(visibleDetailDimensions({ source: 'HR', category: 'office' }, values)).toEqual(values)
    expect(
      visibleDetailDimensions({ source: 'ERP', category: 'office' }, { 员工: '张三' }),
    ).toEqual({ 员工: '张三' })
    const r = report()
    r.category = 'office'
    r.dimension = 'type'
    r.objects = [
      {
        key: 'code:OFFICE',
        label: 'OFFICE',
        current: '4000.00',
        previous: null,
        delta: null,
        growth: null,
        share: '100',
        count: 1,
        missing: false,
      },
    ]
    resolveObjectLabels(r)
    expect(costLabel).toHaveBeenLastCalledWith('COST_PREMISES_TYPE', 'OFFICE')
  })
  it('loads the summary and rows with one authorization and rejects mismatched batches', async () => {
    const { state, wrapper } = setup()
    await flushPromises()
    let finish!: (value: unknown) => void
    api.getCostWorkspace.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    api.getCostReport.mockClear()
    state.openRecords()
    expect(api.getCostWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ snapshotId: 's1' }),
      expect.any(AbortSignal),
    )
    await flushPromises()
    expect(state.records.value).toBeNull()
    expect(state.report.value).toBeNull()
    finish({ report: report(), records: await api.getCostRecords() })
    await flushPromises()
    expect(api.getCostReport).not.toHaveBeenCalled()
    expect(state.records.value?.meta.snapshotId).toBe('s1')
    expect(state.report.value?.meta.snapshotId).toBe('s1')
    api.getCostWorkspace.mockResolvedValueOnce({
      report: report(),
      records: { meta: report('different').meta },
    })
    await state.load()
    expect(state.records.value).toBeNull()
    expect(state.report.value).toBeNull()
    expect(state.error.value).toContain('批次不一致')
    wrapper.unmount()
  })
  it('uses the returned reporting month rather than the later snapshot cutoff', async () => {
    const historical = report()
    historical.meta.period = {
      from: '2026-09-01',
      to: '2026-09-30',
      previousFrom: '2026-08-01',
      previousTo: '2026-08-31',
      compare: 'previous',
    }
    api.getCostReport.mockResolvedValue(historical)
    const { state, wrapper } = setup()
    await flushPromises()
    expect(state.filters.year).toBe(2026)
    expect(state.filters.month).toBe(9)
    expect(state.cutoff.value).toBe('2026-10-16')
    wrapper.unmount()
  })
  it('chart drill starts from confirmed all payments and clearing drill removes hidden object filters', async () => {
    const { state, wrapper } = setup()
    await flushPromises()
    state.filters.status = 'DRAFT'
    state.filters.payment = 'UNPAID'
    state.filters.category = 'office'
    state.filters.dimension = 'contract'
    state.filters.dimensionKey = 'contract:1'
    state.openRecords()
    await flushPromises()
    expect(state.request.value).toMatchObject({
      status: 'CONFIRMED',
      payment: 'ALL',
      category: 'office',
      dimensionKey: 'contract:1',
    })
    state.clearLedgerDrill()
    await flushPromises()
    expect(state.request.value.category).toBeUndefined()
    expect(state.request.value.dimensionKey).toBeUndefined()
    wrapper.unmount()
  })

  it('disabled feature never falls back to sample amounts or requests cost data', async () => {
    vi.stubEnv('VITE_COST_DASHBOARD_ENABLED', 'false')
    const { state, wrapper } = setup()
    await flushPromises()
    expect(api.getCostReport).not.toHaveBeenCalled()
    expect(state.report.value).toBeNull()
    expect(state.error.value).toContain('尚未开放')
    wrapper.unmount()
    vi.stubEnv('VITE_COST_DASHBOARD_ENABLED', undefined)
  })

  it('pins the same snapshot across charts, drilldown and both ledgers', async () => {
    const { state, wrapper } = setup()
    await flushPromises()
    await state.openAnalysis({ city: 'WH', category: 'office' })
    state.modalRecords('previous')
    await flushPromises()
    expect(api.getCostWorkspace).toHaveBeenLastCalledWith(
      expect.objectContaining({
        snapshotId: 's1',
        city: 'WH',
        category: 'office',
        periodSide: 'previous',
      }),
      expect.any(AbortSignal),
    )
    state.filters.periodSide = 'current'
    await state.load()
    expect(api.getCostWorkspace).toHaveBeenLastCalledWith(
      expect.objectContaining({ city: 'WH', category: 'office', periodSide: 'current' }),
      expect.any(AbortSignal),
    )
    wrapper.unmount()
  })
  it('ignores late responses and removes old amounts while changing filters', async () => {
    const { state, wrapper } = setup()
    await flushPromises()
    let old!: (r: CostReport) => void
    api.getCostReport.mockImplementationOnce(
      () =>
        new Promise<CostReport>((resolve) => {
          old = resolve
        }),
    )
    const pending = state.load(true)
    expect(state.report.value).toBeNull()
    api.getCostReport.mockResolvedValueOnce(report('new', '200.02'))
    await state.load(true)
    old(report('old', '1.00'))
    await pending
    expect(state.report.value?.current.amount).toBe('200.02')
    expect(state.request.value.snapshotId).toBe('new')
    wrapper.unmount()
  })
  it('global filters clear drill and search while retaining visible status/payment', async () => {
    const { state, wrapper } = setup()
    await flushPromises()
    state.openRecords({ city: 'WH', category: 'office', payment: 'UNPAID', status: 'DRAFT' })
    await flushPromises()
    state.filters.search = '单号'
    state.filters.month = 0
    state.globalChange()
    await flushPromises()
    expect(state.request.value).toMatchObject({
      month: 0,
      compare: 'yoy',
      periodSide: 'current',
      page: 1,
      status: 'DRAFT',
      payment: 'UNPAID',
    })
    expect(state.drill.value).toEqual({})
    expect(state.filters.search).toBeUndefined()
    wrapper.unmount()
  })
  it('source failure displays error without retaining previous amount or inserting demo values', async () => {
    const { state, wrapper } = setup()
    await flushPromises()
    api.getCostReport.mockRejectedValueOnce(new Error('来源暂不可用'))
    await state.load(true)
    expect(state.report.value).toBeNull()
    expect(state.records.value).toBeNull()
    expect(state.error.value).toContain('来源暂不可用')
    wrapper.unmount()
  })
  it('returning from purchase analysis restores operating expense scope', async () => {
    const { state, wrapper } = setup()
    await flushPromises()
    state.chooseScope('purchase')
    await flushPromises()
    state.goSection('overview')
    await flushPromises()
    expect(state.filters.scope).toBe('opex')
    wrapper.unmount()
  })
})
it('keeps cents exact in displayed values and all comparison bars vertical', () => {
  expect(money('9007199254740993.01')).toBe('9,007,199,254,740,993.01')
  const groups = Array.from({ length: 10 }, (_, i) => ({
    key: String(i),
    label: '对象' + i,
    current: '100.01',
    previous: '50.00',
    delta: '50.01',
    growth: '100.0',
    share: '10.0',
    count: 1,
    missing: false,
  }))
  const option = bars(groups, true) as {
    xAxis: { type: string; data: string[] }
    yAxis: { min: number }
    series: unknown[]
  }
  expect(option.xAxis.type).toBe('category')
  expect(option.xAxis.data).toHaveLength(8)
  expect(option.yAxis.min).toBe(0)
  expect(line(report()).series as unknown[]).toHaveLength(1)
  const bridge = waterfall(groups.slice(0, 1), '50.00', '100.01') as {
    series: { data: unknown[] }[]
  }
  expect(bridge.series[0].data).toEqual([0, 50, 0])
})

it('金额坐标按实际量级显示元或万元，零值和小额不出现浮点长尾', () => {
  type Axis = { name: string; axisLabel: { formatter: (n: number) => string } }
  const empty = report('empty', '0.00')
  const small = (line(empty) as { yAxis: Axis }).yAxis
  expect(small.name).toBe('金额（元）')
  expect(small.axisLabel.formatter(0.6000000000000001)).toBe('0.6')
  expect(small.axisLabel.formatter(0.01)).toBe('0.01')
  expect(small.axisLabel.formatter(0)).toBe('0')
  const large = (line(report('large', '20000.00')) as { yAxis: Axis }).yAxis
  expect(large.name).toBe('金额（万元）')
  expect(large.axisLabel.formatter(10000)).toBe('1')
  expect(large.axisLabel.formatter(6000.000000000001)).toBe('0.6')
})

describe('已登记费用与薪酬覆盖提示', () => {
  it('没有工资单时不将零金额解释为实际无薪酬，并指出比较登记差异', () => {
    const r = report()
    r.meta.comparisonAvailable = true
    r.delta = '-1431.35'
    r.categories = [
      {
        key: 'labor',
        label: '人力薪酬',
        current: '0.00',
        previous: '10751.35',
        count: 0,
        delta: '-10751.35',
        growth: '-100.0',
        share: '0.0',
        missing: false,
      },
    ]
    expect(payrollHasRecords(r)).toBe(false)
    expect(comparisonCoverageNotice(r)).toContain('本期人力薪酬暂无已确认记录')
    expect(overviewReading(r, '较上期')).toContain('已登记费用较上期减少 1,431.35 元')
    expect(overviewReading(r, '较上期')).not.toContain('节省')
  })
  it('有金额为零的已确认工资仍是已登记，零基数或无历史不虚构差额', () => {
    const r = report()
    r.categories = [
      {
        key: 'labor',
        label: '人力薪酬',
        current: '0.00',
        previous: null,
        count: 1,
        delta: null,
        growth: null,
        share: null,
        missing: false,
      },
    ]
    expect(payrollHasRecords(r)).toBe(true)
    expect(comparisonCoverageNotice(r)).toBe('')
    expect(overviewReading(r, '较上期')).toContain('无可比记录')
    r.current.count = 0
    expect(overviewReading(r, '较上期')).toContain('暂无计入经营费用的已确认记录')
  })
})
