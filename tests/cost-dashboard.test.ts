import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import CostDashboardView from '@/views/supply-chain/bi/CostDashboardView.vue'
import { useCostDashboard } from '@/views/supply-chain/bi/cost/use-cost-dashboard'
import {
  bars,
  line,
  money,
  matrixTotal,
  payrollHasRecords,
  comparisonCoverageNotice,
  detailDimensionValue,
  visibleDetailDimensions,
  resolveObjectLabels,
} from '@/views/supply-chain/bi/cost/cost-presentation'
import type { CostRecord, CostReport } from '@/api/core/bi-cost-dashboard'
import { costLabel, loadCostDictionaryCodes } from '@/views/supply-chain/cost/cost-dictionaries'
const api = vi.hoisted(() => ({
  getCostReport: vi.fn(),
  getCostRecords: vi.fn(),
  getCostWorkspace: vi.fn(),
  getCostDetail: vi.fn(),
}))
vi.mock('@/api/core/bi-cost-dashboard', () => api)
vi.mock('@/views/supply-chain/cost/cost-dictionaries', () => ({
  loadCostDictionaryCodes: vi.fn().mockResolvedValue(undefined),
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
  it('付款状态在明细表和详情中明确展示，筛选按原状态编码查询', async () => {
    const states = [
      ['PAID', '已付款'],
      ['UNPAID', '未付款'],
      ['PARTIAL_PAID', '部分付款'],
      ['NOT_REQUIRED', '无需付款'],
      ['NEEDS_REVIEW', '待核对'],
      ['UNKNOWN', '未记录'],
    ] as const
    const rows: CostRecord[] = states.map(([payment], index) => ({
      source: 'ORDER',
      sourceId: `transport-${index}`,
      documentNo: `CST-${index}`,
      title: '订单配送',
      category: 'freight',
      city: 'WH',
      cityName: '武汉市',
      date: '2026-10-16',
      amount: '25.71',
      status: 'CONFIRMED',
      payment,
      sourceSystem: 'HUOLALA',
      employeeName: null,
    }))
    api.getCostRecords.mockResolvedValue({
      meta: report().meta,
      summary: { count: rows.length, confirmed: '154.26', draft: '0.00', missing: 0 },
      page: 1,
      size: 20,
      items: rows,
    })
    api.getCostDetail.mockResolvedValue({
      record: rows[2],
      dimensions: {},
      originalNumbers: [],
    })
    const wrapper = mount(CostDashboardView, {
      global: {
        stubs: {
          CostOverview: true,
          CostDepartmentAnalysis: true,
          CostExportDialog: true,
          RouterLink: true,
        },
      },
    })
    await flushPromises()
    await wrapper.get('.cost-tabs button:last-child').trigger('click')
    await flushPromises()
    expect(
      wrapper
        .findAll('.cost-records-table tbody tr')
        .map((row) => row.get('td:nth-child(9)').text()),
    ).toEqual(states.map(([, label]) => label))
    const select = wrapper.get('select[aria-label="付款状态"]')
    expect(select.findAll('option').map((option) => option.text())).toEqual([
      '全部',
      ...states.map(([, label]) => label),
    ])
    for (const [payment] of states) {
      await select.setValue(payment)
      await flushPromises()
      expect(api.getCostWorkspace).toHaveBeenLastCalledWith(
        expect.objectContaining({ payment, page: 1 }),
        expect.any(AbortSignal),
      )
    }
    await wrapper.get('.cost-records-table tbody tr:nth-child(3) button').trigger('click')
    await flushPromises()
    expect(wrapper.get('section[aria-labelledby="cost-detail-title"]').text()).toContain('部分付款')
    wrapper.unmount()
  })

  it('未提交搜索草稿不会改变明细和导出范围，查询后统一应用并可清除', async () => {
    const { state, wrapper } = setup()
    await flushPromises()
    state.openRecords({ scope: 'purchase' })
    await flushPromises()
    api.getCostWorkspace.mockClear()
    const visibleQuery = { ...state.request.value }
    state.recordSearch.value = '  PO202609010693  '
    expect(state.request.value).toEqual(visibleQuery)
    expect(api.getCostWorkspace).not.toHaveBeenCalled()
    state.searchRecords()
    await flushPromises()
    expect(api.getCostWorkspace).toHaveBeenCalledTimes(1)
    expect(api.getCostWorkspace).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'PO202609010693', scope: 'purchase', page: 1 }),
      expect.any(AbortSignal),
    )
    expect(state.request.value.search).toBe('PO202609010693')
    state.globalChange()
    await flushPromises()
    expect(state.recordSearch.value).toBe('')
    expect(state.request.value.search).toBeUndefined()
    wrapper.unmount()
  })
  it('列表控制只更新已提交的查询并且总览不沿用隐藏的付款状态', async () => {
    const wrapper = mount(CostDashboardView, {
      global: {
        stubs: {
          CostOverview: true,
          CostDepartmentAnalysis: true,
          CostExportDialog: true,
          RouterLink: true,
        },
      },
    })
    await flushPromises()
    await wrapper.get('.cost-tabs button:last-child').trigger('click')
    await flushPromises()
    await wrapper.get('input[aria-label="搜索单据"]').setValue('已提交单号')
    await wrapper.get('form.ledger-filters').trigger('submit')
    await flushPromises()
    await wrapper.get('input[aria-label="搜索单据"]').setValue('尚未查询单号')
    await wrapper.get('select[aria-label="付款状态"]').setValue('PAID')
    await flushPromises()
    expect(api.getCostWorkspace).toHaveBeenLastCalledWith(
      expect.objectContaining({ payment: 'PAID', search: '已提交单号', page: 1 }),
      expect.any(AbortSignal),
    )
    await wrapper.get('select[aria-label="每页行数"]').setValue(50)
    await flushPromises()
    expect(api.getCostWorkspace).toHaveBeenLastCalledWith(
      expect.objectContaining({ payment: 'PAID', search: '已提交单号', page: 1, size: 50 }),
      expect.any(AbortSignal),
    )
    expect(wrapper.get<HTMLInputElement>('input[aria-label="搜索单据"]').element.value).toBe(
      '尚未查询单号',
    )
    await wrapper.get('.cost-tabs button:first-child').trigger('click')
    await flushPromises()
    expect(api.getCostReport).toHaveBeenLastCalledWith(
      expect.objectContaining({ payment: 'ALL', search: undefined }),
      expect.any(AbortSignal),
    )
    await wrapper.get('.cost-tabs button:last-child').trigger('click')
    await flushPromises()
    expect(wrapper.get<HTMLSelectElement>('select[aria-label="付款状态"]').element.value).toBe(
      'PAID',
    )
    wrapper.unmount()
  })

  it('刷新导致明细页码越界时，在同一新批次重新读取最后一页', async () => {
    const { state, wrapper } = setup()
    await flushPromises()
    state.openRecords({ payment: 'PAID' })
    await flushPromises()
    const next = report('s2')
    const result = {
      report: next,
      records: {
        meta: next.meta,
        summary: { count: 21, documentCount: 19, confirmed: '100.00', draft: '0.00', missing: 0 },
        page: 3,
        size: 20,
        items: [],
      },
    }
    api.getCostWorkspace.mockClear()
    api.getCostWorkspace
      .mockResolvedValueOnce(result)
      .mockResolvedValueOnce({ ...result, records: { ...result.records, page: 2 } })
    state.filters.page = 3
    await state.load(true)
    expect(api.getCostWorkspace).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ snapshotId: undefined, payment: 'PAID', page: 3 }),
      expect.any(AbortSignal),
    )
    expect(api.getCostWorkspace).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ snapshotId: 's2', payment: 'PAID', page: 2 }),
      expect.any(AbortSignal),
    )
    expect(state.filters.page).toBe(2)
    expect(state.records.value?.page).toBe(2)
    expect(state.report.value?.meta.snapshotId).toBe('s2')
    wrapper.unmount()
  })

  it('分析弹窗先加载样本明细使用的费用项目字典', async () => {
    const { state, wrapper } = setup()
    await flushPromises()
    const result = report()
    result.majorRecords = [{ itemKey: 'dict:COST_LOGISTICS_FEE_TYPE:FREIGHT' } as CostRecord]
    api.getCostReport.mockResolvedValueOnce(result)
    let finishDictionary!: () => void
    vi.mocked(loadCostDictionaryCodes).mockImplementationOnce(
      () => new Promise<void>((resolve) => (finishDictionary = resolve)),
    )
    const opening = state.openAnalysis({ city: 'WH' })
    await flushPromises()
    expect(loadCostDictionaryCodes).toHaveBeenLastCalledWith(
      ['COST_LOGISTICS_FEE_TYPE'],
      false,
      'inline',
    )
    expect(state.modalLoading.value).toBe(true)
    expect(state.modalReport.value).toBeNull()
    finishDictionary()
    await opening
    expect(state.modalReport.value?.majorRecords).toHaveLength(1)
    expect(state.modalLoading.value).toBe(false)
    wrapper.unmount()
  })

  it('从总览定位待核对原单，分别显示单据数和明细行数并隐藏导出', async () => {
    const summary = report()
    summary.current.reviewCount = 1
    summary.meta.exportAllowed = true
    const row: CostRecord = {
      source: 'HR',
      sourceId: 'reimbursement-1',
      documentNo: 'BX-001',
      title: '来源凭证待核对',
      category: 'expense',
      city: 'WH',
      cityName: '武汉市',
      date: '2026-10-16',
      amount: '250.00',
      status: 'CONFIRMED',
      payment: 'PAID',
      sourceSystem: 'MANUAL',
      employeeName: null,
      costTreatment: 'REVIEW',
    }
    api.getCostReport.mockResolvedValue(summary)
    api.getCostRecords.mockResolvedValue({
      meta: summary.meta,
      summary: { count: 2, documentCount: 1, confirmed: '0.00', draft: '0.00', missing: 0 },
      page: 1,
      size: 20,
      items: [row],
    })
    api.getCostDetail.mockResolvedValue({
      record: row,
      dimensions: { 待核对原因: '原费用发生变化' },
      originalNumbers: [],
      sourceRoute: '/cost/source/BX-001',
    })
    const wrapper = mount(CostDashboardView, {
      global: {
        stubs: {
          EchartsChart: true,
          CostRing: true,
          CostDepartmentAnalysis: true,
          CostExportDialog: true,
          RouterLink: true,
        },
      },
    })
    await flushPromises()
    await wrapper.get('.review-scopes button').trigger('click')
    await flushPromises()
    expect(api.getCostWorkspace).toHaveBeenLastCalledWith(
      expect.objectContaining({ scope: 'opex', status: 'REVIEW', snapshotId: 's1' }),
      expect.any(AbortSignal),
    )
    expect(wrapper.text()).toContain('待核对来源明细')
    expect(wrapper.text()).toContain('匹配单据1 笔')
    expect(wrapper.text()).toContain('明细行2 行')
    expect(wrapper.text()).toContain('待核对来源金额暂未计入成本')
    expect(wrapper.get('.cost-records-table tbody tr').text()).toContain('待核对')
    expect(wrapper.find('.record-export-controls').exists()).toBe(false)
    await wrapper.get('.cost-records-table tbody tr button').trigger('click')
    await flushPromises()
    expect(api.getCostDetail).toHaveBeenLastCalledWith(
      'HR',
      'reimbursement-1',
      expect.objectContaining({ status: 'REVIEW' }),
    )
    expect(wrapper.get('section[aria-labelledby="cost-detail-title"]').text()).toContain(
      '原费用发生变化',
    )
    expect(
      wrapper.get('section[aria-labelledby="cost-detail-title"] router-link-stub').attributes('to'),
    ).toBe('/cost/source/BX-001')
    await wrapper.get('.analysis-controls button').trigger('click')
    await flushPromises()
    expect(api.getCostWorkspace).toHaveBeenLastCalledWith(
      expect.objectContaining({ scope: 'opex', status: 'CONFIRMED' }),
      expect.any(AbortSignal),
    )
    expect(wrapper.find('.cost-dashboard cost-export-dialog-stub').exists()).toBe(true)
    wrapper.unmount()
  })

  it('快捷期间使用接口业务截止日，跨年上月仍保留归属及采购口径', async () => {
    const { state, wrapper } = setup()
    await flushPromises()
    state.chooseScope('purchase')
    await flushPromises()
    const january = report()
    january.meta.effectiveCutoff = '2026-01-16'
    api.getCostReport.mockResolvedValue(january)
    state.cutoff.value = january.meta.effectiveCutoff
    state.filters.city = 'WH'
    state.applyPeriod('previous')
    await flushPromises()
    expect(state.filters).toMatchObject({
      year: 2025,
      month: 12,
      city: 'WH',
      scope: 'purchase',
      category: 'purchase',
      dimension: 'component',
    })
    expect(state.activePeriod.value).toBe('previous')
    state.applyPeriod('year')
    await flushPromises()
    expect(state.request.value).toMatchObject({
      year: 2026,
      month: 0,
      compare: 'yoy',
      city: 'WH',
      scope: 'purchase',
    })
    expect(state.activePeriod.value).toBe('year')
    wrapper.unmount()
  })
  it('快递详情不提示补充不适用的差旅字段，差旅缺项及真实已填值继续可见', () => {
    const values = {
      费用类型: 'COURIER',
      出差或报销事项: '未记录',
      出差目的地: '未记录',
      收款方或合作方: '未记录',
      收件客户或合作方: '合作方业务部',
      运单号: 'SF001',
    }
    expect(visibleDetailDimensions({ source: 'HR', category: 'expense' }, values)).toEqual({
      费用类型: 'COURIER',
      收件客户或合作方: '合作方业务部',
      运单号: 'SF001',
    })
    expect(
      visibleDetailDimensions(
        { source: 'HR', category: 'expense' },
        { ...values, 费用类型: 'TRAVEL' },
      ),
    ).toMatchObject({ 出差目的地: '未记录' })
    expect(
      visibleDetailDimensions(
        { source: 'HR', category: 'expense' },
        { ...values, 收款方或合作方: '李四' },
      ),
    ).toMatchObject({ 收款方或合作方: '李四' })
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
    await state.openAnalysis({ city: 'WH', category: 'office', department: 'dep-1' })
    state.modalRecords('previous')
    await flushPromises()
    expect(api.getCostWorkspace).toHaveBeenLastCalledWith(
      expect.objectContaining({
        snapshotId: 's1',
        city: 'WH',
        category: 'office',
        department: 'dep-1',
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
  it('global filters retain payment and always restrict records to confirmed', async () => {
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
      status: 'CONFIRMED',
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
  it('只查询报表使用的字典，主动刷新时重新取该字典', async () => {
    const { state, wrapper } = setup()
    await flushPromises()
    expect(loadCostDictionaryCodes).not.toHaveBeenCalled()
    const data = report()
    data.objects = [
      {
        key: 'dict:COST_TRANSPORT_KIND:EXPRESS',
        label: '快递',
        current: '100.01',
        previous: null,
        delta: null,
        growth: null,
        share: '100.0',
        count: 1,
        missing: false,
      },
    ]
    api.getCostReport.mockResolvedValue(data)
    await state.load()
    expect(loadCostDictionaryCodes).toHaveBeenLastCalledWith(
      ['COST_TRANSPORT_KIND'],
      false,
      'inline',
    )
    await state.load(true)
    expect(loadCostDictionaryCodes).toHaveBeenLastCalledWith(
      ['COST_TRANSPORT_KIND'],
      true,
      'inline',
    )
    wrapper.unmount()
  })
  it('采购成本默认查看货款与实际运费构成，期间切换和下钻保留范围', async () => {
    const { state, wrapper } = setup()
    await flushPromises()
    state.chooseScope('purchase')
    await flushPromises()
    expect(state.perspective.value).toBe('structure')
    expect(state.request.value).toMatchObject({
      scope: 'purchase',
      category: 'purchase',
      dimension: 'component',
    })
    state.globalChange()
    await flushPromises()
    expect(state.request.value).toMatchObject({
      scope: 'purchase',
      category: 'purchase',
      dimension: 'component',
    })
    await state.openAnalysis({
      category: 'purchase',
      dimension: 'component',
      dimensionKey: 'FREIGHT',
    })
    state.modalRecords('current')
    await flushPromises()
    expect(state.request.value).toMatchObject({
      scope: 'purchase',
      dimensionKey: 'FREIGHT',
      status: 'CONFIRMED',
    })
    wrapper.unmount()
  })
  it('does not reapply an analysis topic when changing city on the overview', async () => {
    const { state, wrapper } = setup()
    await flushPromises()
    state.goSection('analysis')
    state.choosePerspective('objects')
    await flushPromises()
    state.goSection('overview')
    await flushPromises()
    state.filters.city = 'WH'
    state.globalChange()
    await flushPromises()
    expect(state.request.value).toMatchObject({ city: 'WH', scope: 'opex' })
    expect(state.request.value.category).toBeUndefined()
    expect(state.request.value.dimension).toBeUndefined()
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
it('keeps cents exact in displayed values and existing city comparison bars vertical', () => {
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
  })
})

it('归属矩阵合计随金额、占比和变动视角切换，零金额不伪造占比', () => {
  const group = { current: '4398.60', delta: '-1601.40' }
  expect(matrixTotal(group, 'amount')).toBe('4,398.60')
  expect(matrixTotal(group, 'delta')).toBe('-1,601.40')
  expect(matrixTotal(group, 'share')).toBe('100.0%')
  expect(matrixTotal({ current: '0.00', delta: null }, 'share')).toBe('—')
  expect(matrixTotal({ current: '0.00', delta: null }, 'delta')).toBe('—')
})
