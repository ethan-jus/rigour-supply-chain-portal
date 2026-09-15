import type { EChartsCoreOption } from 'echarts/core'
import { businessDate } from '@/utils/business-date'
import type {
  SupplyDashboardOverview,
  SupplyDashboardRankingItem,
  SupplyDashboardProductSalesItem,
  SupplyDashboardTrendPoint,
  SupplyDashboardTargetCompletionItem,
  SupplyDashboardOperatingAnalysis,
} from '@/api/core/bi'
import {
  amount,
  collectionGauge,
  collectionColumns,
  performanceColumns,
  exactAmount,
  bars,
  chartColors,
  lines,
  smallMultipleLines,
  smallMultipleHeight,
  cityOperatingMatrix,
  categoryComposition,
  numeric,
  percent,
  ratio,
  ring,
  waterfall,
  costComposition,
  type CostSlice,
  pareto,
  heatmap,
  type PlotRow,
  type PlotSeries,
  type CollectionGaugeData,
  type CollectionColumn,
  type PerformanceColumn,
} from './cockpit-charts'
import { operatingCosts, sampleSkuCosts } from './cockpit-costs'
import { concreteDimension } from './cockpit-scope'
import { reportUnitName } from './report-format'

export { operatingCosts, sampleCostLines, sampleSkuCosts } from './cockpit-costs'
import { operatingAnalysisFigures } from './cockpit-analysis'
import { targetCompletionFigure } from './cockpit-targets'
import { salesMovementFigure } from './cockpit-movement'

export const cockpitSections = {
  overview: '供应链经营驾驶舱',
  sales: '销售监控',
  'sales-collection': '销售与回款',
  'city-operating': '城市经营',
  customer: '客户经营',
  'product-sales': '商品销售',
  'product-inventory': '采购与库存',
  'gross-profit': '销售毛利',
  'payment-risk': '回款风险',
  'city-cost': '成本与盈亏',
  'inventory-risk': '库存风险',
  activity: '活动经营',
} as const
export type CockpitSection = keyof typeof cockpitSections
export type ProductDimension = 'PRODUCT' | 'SKU' | 'CATEGORY' | 'BRAND'
export type DrillKind =
  | 'city'
  | 'sales'
  | 'product'
  | 'customer'
  | 'inventory'
  | 'orders'
  | 'receipt'
  | 'cost'
  | 'activity'
  | 'target'
export interface DetailRow {
  key: string
  groupKey?: string
  name: string
  cells: Record<string, string>
  kind?: DrillKind
  code?: string
  dimension?: ProductDimension
  regionCode?: string | null
  ownerStaffCode?: string | null
  period?: string
  sample?: boolean
}
export interface Figure {
  id: string
  title: string
  span: 3 | 4 | 6 | 8 | 12
  option: EChartsCoreOption
  rows: DetailRow[]
  collection?: CollectionGaugeData
  comparison?: CollectionColumn[]
  performance?: PerformanceColumn[]
  performanceMetric?: string
  breakdown?: CostSlice[]
  smallMultiples?: { rows: PlotRow[]; series: PlotSeries[] }
  height?: number
  compact?: boolean
  sample?: boolean
  note?: string
  empty?: string
  emptyAction?: 'inventory' | 'product' | 'target' | 'reset' | 'cost'
}
export interface CockpitKpi {
  label: string
  value: string
  color: string
  sample?: boolean
  definition?: string
  section?: CockpitSection
}
export interface CockpitAction {
  label: string
  value: string
  context?: string
  section: CockpitSection
  row?: DetailRow
}
export interface CockpitOptions {
  productDimension: ProductDimension
  period: 'month' | 'day'
  inventoryUnit: string
  costGroup: string
  regionCode?: string
  regionName?: string
  ownerStaffCode?: string
  rankingMetric?: 'salesAmount' | 'paidAmount'
  inventoryScopeLimited?: boolean
  costScopeLimited?: boolean
  targetScopeLimited?: boolean
  unavailableSubjects?: string[]
  analysis?: SupplyDashboardOperatingAnalysis
}

export const metricValue = (data: SupplyDashboardOverview, code: string): number | null => {
  const metric = data.metrics.find((item) => item.metricCode === code)
  return metric?.value != null && Number.isFinite(Number(metric.value))
    ? Number(metric.value)
    : null
}
const metric = (data: SupplyDashboardOverview, code: string) => metricValue(data, code) ?? 0
const count = (value: number) => value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
const details = (
  rows: PlotRow[],
  labels: string[],
  format: (value: number | null) => string = exactAmount,
  kind?: DrillKind,
): DetailRow[] =>
  rows.map((row) => ({
    key: row.key,
    name: row.name,
    kind,
    code: row.key,
    cells: Object.fromEntries(
      labels.map((label, index) => [label, format(row.values[index] ?? null)]),
    ),
  }))
const rankingRows = (rows: SupplyDashboardRankingItem[], kind: 'city' | 'sales'): DetailRow[] =>
  rows.map((row) => ({
    key: row.dimensionCode,
    code: row.dimensionCode,
    name: row.dimensionName || row.dimensionCode,
    kind,
    regionCode: kind === 'city' ? row.dimensionCode : row.regionCode,
    ownerStaffCode: kind === 'sales' ? row.dimensionCode : undefined,
    cells: {
      城市: row.regionName || (kind === 'city' ? row.dimensionName : '—'),
      销售额: exactAmount(row.salesAmount),
      回款额: exactAmount(row.paidAmount),
      待回款: exactAmount(row.unpaidAmount),
      回款率: percent(ratio(row.paidAmount, row.salesAmount)),
      订单数: count(row.orderCount),
      客户数: count(row.customerCount),
    },
  }))
const rankingPlot = (
  rows: SupplyDashboardRankingItem[],
  fields: ('salesAmount' | 'paidAmount' | 'unpaidAmount')[],
): PlotRow[] =>
  rows.map((row) => ({
    key: row.dimensionCode,
    name: row.dimensionName || row.dimensionCode,
    values: fields.map((field) => numeric(row[field])),
  }))

export function aggregatePeriods(
  items: SupplyDashboardTrendPoint[],
  period: 'month' | 'day',
): PlotRow[] {
  const grouped = new Map<string, [number, number]>()
  for (const item of items) {
    const key = String(item.period).slice(0, period === 'month' ? 7 : 10)
    const values = grouped.get(key) || [0, 0]
    values[0] += numeric(item.value)
    values[1] += numeric(item.secondaryValue)
    grouped.set(key, values)
  }
  const keys = [...grouped.keys()].sort()
  if (!keys.length) return []
  const result: PlotRow[] = []
  const cursor = new Date(`${keys[0]}${period === 'month' ? '-01' : ''}T00:00:00Z`)
  const last = keys[keys.length - 1]
  while (Number.isFinite(cursor.getTime())) {
    const key = cursor.toISOString().slice(0, period === 'month' ? 7 : 10)
    if (key > last) break
    result.push({ key, name: key, values: grouped.get(key) || [null, null] })
    if (period === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    else cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return result
}

export function targetPlot(items: SupplyDashboardTargetCompletionItem[]): PlotRow[] {
  const codes = ['CONTACTED_CUSTOMER', 'COOPERATED_CUSTOMER', 'SALES_AMOUNT', 'PAID_AMOUNT']
  const grouped = new Map<string, { name: string; totals: Map<string, [number, number]> }>()
  items.forEach((item) => {
    const row = grouped.get(item.dimensionCode) || {
      name: item.dimensionName,
      totals: new Map<string, [number, number]>(),
    }
    const code = item.metricCode.toUpperCase()
    const total = row.totals.get(code) || [0, 0]
    total[0] += numeric(item.actualValue)
    total[1] += numeric(item.targetValue)
    row.totals.set(code, total)
    grouped.set(item.dimensionCode, row)
  })
  return [...grouped.entries()].map(([key, row]) => ({
    key,
    name: row.name,
    values: codes.map((code) => {
      const value = row.totals.get(code)
      return value ? ratio(value[0], value[1]) : null
    }),
  }))
}

function productRows(
  data: SupplyDashboardOverview,
  dimension: ProductDimension,
): SupplyDashboardProductSalesItem[] {
  const source = {
    PRODUCT: data.productSalesRanking,
    SKU: data.skuSalesRanking,
    CATEGORY: data.categorySalesRanking,
    BRAND: data.brandSalesRanking,
  }
  return [...(source[dimension] || [])].sort(
    (a, b) => numeric(b.salesAmount) - numeric(a.salesAmount),
  )
}

export function buildCockpit(
  data: SupplyDashboardOverview,
  section: CockpitSection,
  options: CockpitOptions,
) {
  const figures: Figure[] = []
  const stockSource = data.freshness?.find((row) => row.sourceCode === 'ERP_STOCK_BALANCE')
  const stockUnavailable = Boolean(stockSource && stockSource.status !== 'READY')
  const moneyKpi = (
    code: string,
    label: string,
    color: string,
    target?: CockpitSection,
  ): CockpitKpi => ({
    label,
    value: amount(metricValue(data, code)),
    color,
    section: target,
    definition: data.metrics.find((item) => item.metricCode === code)?.description || undefined,
  })
  const countKpi = (code: string, label: string): CockpitKpi => ({
    label,
    value: metricValue(data, code) == null ? '—' : count(metric(data, code)),
    color: chartColors[0],
  })
  const referenceCostKpi = (): CockpitKpi => {
    const coverage = metricValue(data, 'cost_coverage_rate')
    return {
      label:
        coverage != null && coverage > 0 && coverage < 100 ? '已覆盖参考价成本' : '参考价估算成本',
      value:
        coverage != null && coverage > 0 ? amount(metricValue(data, 'estimated_cost_amount')) : '—',
      color: chartColors[2],
      definition:
        coverage != null && coverage > 0
          ? '仅含已匹配ERP采购参考价的订单行，不代表完整经营成本。'
          : '当前订单行尚无可用采购参考价，无法估算成本。',
    }
  }
  const costs = operatingCosts(data)
  const paid = metricValue(data, 'paid_amount')
  const sales = metricValue(data, 'sales_amount')
  const paidRate = paid == null || sales == null ? null : ratio(paid, sales)
  const core: CockpitKpi[] = [
    moneyKpi('sales_amount', '销售额', chartColors[0], 'sales'),
    moneyKpi('paid_amount', '回款额', chartColors[1], 'sales-collection'),
    moneyKpi('unpaid_amount', '待回款', chartColors[2], 'payment-risk'),
    {
      label: '回款率',
      value: percent(paidRate),
      color: chartColors[1],
      section: 'payment-risk',
      definition: '当前筛选订单累计已收 / 同批订单应收；无销售时不计算。',
    },
  ]
  let kpis = core
  const cities = [...(data.citySalesRanking || [])].sort((a, b) => b.salesAmount - a.salesAmount)
  const sellers = [...(data.salesRanking || [])].sort((a, b) => b.salesAmount - a.salesAmount)
  const dimensionLabels: Record<ProductDimension, string> = {
    PRODUCT: '商品',
    SKU: '规格/型号',
    CATEGORY: '分类',
    BRAND: '品牌',
  }

  function addTrend(id = 'trend', title = '销售与回款趋势', span: Figure['span'] = 8) {
    const plot = aggregatePeriods(data.salesTrend || [], options.period)
    figures.push({
      id,
      title,
      span,
      option: lines(plot, [{ name: '销售额' }, { name: '订单累计已收' }]),
      rows: details(plot, ['销售额', '订单累计已收'], exactAmount, 'orders').map((row) => ({
        ...row,
        period: row.key,
      })),
      note:
        options.period === 'month'
          ? `按订单日期归期；末月截至${businessDate(data.to)}`
          : '按订单日期归期',
      empty: '所选期间没有订单记录',
    })
  }
  function addCollectionGauge(id: string, title: string, span: Figure['span']) {
    const salesAmount = metricValue(data, 'sales_amount')
    const paidAmount = metricValue(data, 'paid_amount')
    const unpaidAmount = metricValue(data, 'unpaid_amount')
    const rate = salesAmount == null || paidAmount == null ? null : ratio(paidAmount, salesAmount)
    const collection = { salesAmount, paidAmount, unpaidAmount, rate }
    const plot = [
      { key: 'sales', name: '应收金额', values: [salesAmount] },
      { key: 'paid', name: '已回款', values: [paidAmount] },
      { key: 'unpaid', name: '待回款', values: [unpaidAmount] },
    ]
    figures.push({
      id,
      title,
      span,
      collection,
      option: collectionGauge(collection),
      rows: details(plot, ['金额'], exactAmount, 'orders'),
      note:
        rate == null
          ? '当前范围无有效应收，回款率未计算'
          : rate > 100
            ? `回款超过应收 ${exactAmount((paidAmount ?? 0) - (salesAmount ?? 0))}，需核对订单回款`
            : rate < 0
              ? '回款金额为负，需核对订单回款'
              : '同批订单累计已收 / 应收',
    })
  }
  function addCollectionComparison(
    id: string,
    title: string,
    source: SupplyDashboardRankingItem[],
    kind: 'city' | 'sales',
    span: Figure['span'] = 8,
  ) {
    const ordered = [...source].sort(
      (a, b) => b.unpaidAmount - a.unpaidAmount || b.salesAmount - a.salesAmount,
    )
    const comparison = ordered.map((row) => ({
      key: row.dimensionCode,
      name: row.dimensionName || row.dimensionCode,
      salesAmount: row.salesAmount,
      paidAmount: row.paidAmount,
      unpaidAmount: row.unpaidAmount,
    }))
    figures.push({
      id,
      title,
      span,
      comparison,
      option: collectionColumns(comparison.slice(0, 8), comparison),
      rows: rankingRows(ordered, kind),
      note: '同批订单累计已收 / 应收；待回款不等同于逾期',
      empty: '所选范围没有销售记录',
    })
  }
  function addPerformanceRanking(span: Figure['span'] = 8) {
    const field = options.rankingMetric || 'salesAmount'
    const label = field === 'salesAmount' ? '销售额' : '订单累计回款'
    const ranked = [...sellers]
      .filter((row) => concreteDimension(row.dimensionCode))
      .sort(
        (a, b) =>
          numeric(b[field]) - numeric(a[field]) || a.dimensionCode.localeCompare(b.dimensionCode),
      )
    let rank = 0
    const previous = [...(options.analysis?.previousSalesRanking || [])].sort(
      (a, b) =>
        numeric(b[field]) - numeric(a[field]) || a.dimensionCode.localeCompare(b.dimensionCode),
    )
    let previousRank = 0
    const previousRanks = new Map(
      previous.map((row, i) => {
        if (!i || numeric(row[field]) !== numeric(previous[i - 1][field])) previousRank = i + 1
        return [row.dimensionCode, previousRank]
      }),
    )
    const performance = ranked.map((row, index) => {
      if (!index || numeric(row[field]) !== numeric(ranked[index - 1][field])) rank = index + 1
      return {
        key: row.dimensionCode,
        name: row.dimensionName || row.dimensionCode,
        currentRegionName: row.currentRegionName?.trim() || '待完善',
        orderRegionNames:
          row.orderRegionNames ??
          (concreteDimension(row.regionCode) && row.regionName ? [row.regionName] : []),
        value: numeric(row[field]),
        rank,
        previousRank: previousRanks.get(row.dimensionCode),
      }
    })
    figures.push({
      id: 'performance-ranking',
      title: `${options.ownerStaffCode ? '所选销售' : options.regionCode ? options.regionName || '本城市' : '全国销售人员'}业绩排行`,
      span,
      performance,
      performanceMetric: label,
      option: performanceColumns(performance.slice(0, 8), performance, label),
      rows: rankingRows(ranked, 'sales').map((row, i) => {
        const cells = { ...row.cells }
        delete cells.城市
        return {
          ...row,
          cells: {
            名次: String(performance[i].rank),
            当前归属: performance[i].currentRegionName,
            历史订单涉及: performance[i].orderRegionNames.join('、') || '城市明细待同步',
            ...(options.analysis
              ? {
                  前期名次:
                    performance[i].previousRank == null
                      ? '前期无记录'
                      : String(performance[i].previousRank),
                }
              : {}),
            ...cells,
          },
        }
      }),
      note: `${label}降序；并列同名次；当前归属取 HR；历史订单涉及城市见提示或明细，按所选期间及筛选范围统计${sellers.length > ranked.length ? '；未归属销售不参与排名' : ''}${options.analysis ? `；前期 ${businessDate(options.analysis.previousFrom)} 至 ${businessDate(options.analysis.previousTo)}（等长窗口）` : ''}`,
      empty: '当前范围没有已归属销售的业绩记录',
    })
  }
  function addRanking(
    id: string,
    title: string,
    rows: SupplyDashboardRankingItem[],
    kind: 'city' | 'sales',
    span: Figure['span'] = 6,
    risk = false,
  ) {
    const ordered = [...rows].sort((a, b) =>
      risk ? b.unpaidAmount - a.unpaidAmount : b.salesAmount - a.salesAmount,
    )
    const plot = rankingPlot(ordered, risk ? ['unpaidAmount'] : ['paidAmount', 'unpaidAmount'])
    figures.push({
      id,
      title,
      span,
      option: bars(
        plot,
        risk
          ? [{ name: '逾期待回款', color: chartColors[3] }]
          : [
              { name: '已回款', color: chartColors[1] },
              { name: '待回款', color: chartColors[0] },
            ],
        { stacked: !risk },
      ),
      rows: rankingRows(ordered, kind),
      empty: risk ? '所选范围无逾期未收金额' : '所选范围没有销售记录',
      note: risk ? '超过客户账期的订单' : '条形总长为销售额',
    })
  }
  function addCostBridge(span: Figure['span'] = 6) {
    const groups = [...new Set(costs.lines.map((line) => line.group))]
    const plot: PlotRow[] = [
      { key: 'sales', name: '销售额', values: [costs.sales] },
      ...groups.map((group) => ({
        key: group,
        name: group === '未分项' ? '未分项成本' : `${group}成本`,
        values: [
          -costs.lines
            .filter((line) => line.group === group)
            .reduce((sum, line) => sum + Math.round(line.amount * 100), 0) / 100,
        ],
      })),
      { key: 'profit', name: '经营结余', values: [costs.profit] },
    ]
    figures.push({
      id: 'cost-bridge',
      title: '成本与盈亏',
      span,
      option: waterfall(plot),
      rows: details(plot, ['金额'], exactAmount, 'cost').map((row) => ({
        ...row,
        kind: row.key === 'sales' ? 'orders' : 'cost',
        sample:
          row.key === 'profit'
            ? costs.sample
            : costs.lines.some((line) => line.group === row.key && line.sample),
      })),
      sample: costs.sample,
      note: costs.sample ? '成本含样例，结余仅供演示' : '销售额减已入账成本；非财务净利润',
    })
  }
  function addCostStructure(span: Figure['span'] = 6) {
    const costLines = costs.lines.filter(
      (line) =>
        section !== 'city-cost' || options.costGroup === '全部' || line.group === options.costGroup,
    )
    const plot = costLines.map((line) => ({
      key: line.name,
      name: line.name,
      group: line.group,
      sample: line.sample,
      values: [line.amount],
    }))
    figures.push({
      id: 'cost-structure',
      title: '货 · 人 · 场成本构成',
      span,
      sample: costLines.some((line) => line.sample),
      height: 290,
      option: costComposition(plot),
      breakdown: plot,
      rows: costLines.map((line) => ({
        key: line.name,
        groupKey: line.group,
        name: line.name,
        sample: line.sample,
        cells: {
          维度: line.group,
          成本类别: line.category,
          金额: exactAmount(line.amount),
          占总成本比重: percent(ratio(line.amount, costs.cost)),
          备注:
            line.group === '未分项'
              ? '接口仅提供已入账总额，未提供费用分项'
              : line.name === '营销费'
                ? '试吃成本、活动成本'
                : line.group === '人'
                  ? '仅城市/期间汇总'
                  : '',
        },
      })),
      empty: '当前范围未提供此类成本分项',
      note: costLines.some((line) => line.amount < 0)
        ? '含负调整，以正负金额显示；已入账未分项总额单列'
        : '货品、物流、仓库、人力、房租及其他补充项；已入账未分项总额单列',
    })
  }
  function addCityCosts(span: Figure['span'] = 6) {
    const plot = [...costs.rows]
      .sort((a, b) => b.sales - a.sales)
      .map((row) => ({ key: row.key, name: row.name, values: [row.sales, row.cost] }))
    figures.push({
      id: 'city-costs',
      title: '城市收入与成本',
      span,
      sample: costs.sample,
      option: bars(plot, [{ name: '销售额' }, { name: '经营成本', color: chartColors[2] }]),
      rows: costs.rows.map((row) => ({
        key: row.key,
        name: row.name,
        kind: 'city',
        code: row.key,
        regionCode: row.key,
        sample: row.sample,
        cells: {
          销售额: exactAmount(row.sales),
          成本: exactAmount(row.cost),
          经营结余: exactAmount(row.profit),
          成本率: percent(ratio(row.cost, row.sales)),
          成本来源: row.sample ? row.assumption?.name || '样例' : '已入账成本（未提供分项）',
          成本说明: row.assumption?.explanation || '真实总额保留，不推算费用分项',
          ...Object.fromEntries(row.lines.map((line) => [line.name, exactAmount(line.amount)])),
        },
      })),
      note: costs.sample
        ? '按销售额排列；缺失费用使用样例，不作真实成本排名。' + costs.rules.date
        : '当前期间已入账成本；未提供分项的总额单列',
    })
  }
  function addTargets(city: boolean, span: Figure['span'] = 6) {
    if (options.targetScopeLimited || (city && options.ownerStaffCode)) {
      if (figures.length) figures[figures.length - 1].span = 12
      figures.push({
        id: 'targets',
        title: city ? '城市目标达成与缺口' : '销售目标达成与缺口',
        span,
        compact: true,
        rows: [],
        option: { series: [] },
        empty: '当前细分范围与目标范围不同，暂不比较达成率',
        emptyAction: 'reset',
      })
      return
    }
    const source = (city ? data.cityTargetCompletions : data.salesTargetCompletions) || []
    const figure = targetCompletionFigure(source, city, span)
    if (figure.compact && figures.length) figures[figures.length - 1].span = 12
    figures.push(figure)
  }
  function addProducts(dimension: ProductDimension, span: Figure['span'] = 6, id = 'products') {
    const source = productRows(data, dimension)
    const plot = source.map((row) => ({
      key: row.dimensionCode,
      name: row.dimensionName,
      values: [numeric(row.salesAmount)],
    }))
    const composition =
      section === 'product-sales' && ['CATEGORY', 'BRAND'].includes(dimension)
        ? categoryComposition(plot)
        : undefined
    figures.push({
      id,
      title: `${dimensionLabels[dimension]}销售贡献`,
      span,
      option:
        composition?.option ||
        (dimension === 'CATEGORY' && plot.length <= 6 && plot.every((row) => row.values[0] >= 0)
          ? ring(plot, amount(plot.reduce((sum, row) => sum + row.values[0], 0)), '分类销售额')
          : pareto(plot, '销售额')),
      height: span === 12 ? 310 : 290,
      rows: source.map((row) => ({
        key: row.dimensionCode,
        groupKey: composition?.groupKeys.get(row.dimensionCode),
        name: row.dimensionName,
        kind: 'product',
        code: row.dimensionCode,
        dimension,
        cells: {
          ...(dimension === 'BRAND' ? {} : { 分类: row.categoryName || '—' }),
          销售额: exactAmount(row.salesAmount),
          销售净额: exactAmount(row.salesNetAmount),
          订单数: count(row.orderCount),
          客户数: count(row.customerCount),
          采购价覆盖率: percent(row.costCoverageRate),
        },
      })),
      empty: '当前筛选无商品销售记录',
      emptyAction: 'product',
      note:
        dimension === 'PRODUCT'
          ? `已关联${source.filter((row) => row.dimensionCode?.toUpperCase() !== 'UNKNOWN').length}个商品；商品关联待核对单列；数量按原单位在城市商品报表核对`
          : dimension === 'BRAND'
            ? '按订单行品牌归属；同一品牌可跨分类，未归属品牌单列'
            : dimension === 'SKU'
              ? '按订单记录的SKU及规格统计；未区分的型号不拆分，销量与回款在城市商品报表按原单位核对'
              : '订单行销售额；数量按原单位在城市商品报表核对',
    })
  }
  function addAging(span: Figure['span'] = 4) {
    const order = [
      'CURRENT',
      'DAYS_1_30',
      'DAYS_31_60',
      'DAYS_61_PLUS',
      'DAYS_61_90',
      'DAYS_90_PLUS',
      'DAYS_60_PLUS',
    ]
    const source = [...(data.paymentAgingBuckets || [])].sort(
      (a, b) => order.indexOf(a.bucketCode) - order.indexOf(b.bucketCode),
    )
    const plot = source.map((row) => ({
      key: row.bucketCode,
      name: row.bucketName,
      values: [row.unpaidAmount],
    }))
    figures.push({
      id: 'aging',
      title: '待回款账龄',
      span,
      option: bars(plot, [{ name: '待回款', color: chartColors[2] }], { vertical: true }),
      rows: source.map((row) => ({
        key: row.bucketCode,
        name: row.bucketName,
        cells: {
          待回款: exactAmount(row.unpaidAmount),
          订单数: count(row.orderCount),
          客户数: count(row.customerCount),
        },
      })),
      note: '按客户账期到期日计算',
      empty:
        metricValue(data, 'unpaid_amount') === 0
          ? '当前筛选无待回款订单'
          : '账龄明细暂不可用，请核对待回款订单',
    })
  }
  function addCustomerValue(span: Figure['span'] = 8) {
    const source = data.customerActivityRanking || []
    const plot = source.map((row) => ({
      key: row.customerCode,
      name: row.customerName,
      values: [row.salesAmount],
    }))
    figures.push({
      id: 'customer-value',
      title: '客户销售贡献',
      span,
      option: pareto(plot, '销售额'),
      rows: customerDetails(source),
      note: `本次返回${source.length}位客户的贡献；累计占比仅以这些客户为分母`,
      empty: '所选范围没有客户活跃数据',
    })
  }
  function addInventory() {
    const summary = (data.inventoryItemSummary || []).filter(
      (row) => !options.inventoryUnit || row.unitCode === options.inventoryUnit,
    )
    const units = [...new Set(summary.map((row) => row.unitCode))]
    const flowUnit = options.inventoryUnit || (units.length === 1 ? units[0] : '')
    const plot = summary
      .filter((row) => row.unitCode === flowUnit)
      .map((row, i) => ({
        key: `${row.categoryCode}-${row.unitCode}-${i}`,
        name: row.categoryName,
        values: [row.procurementQuantity, row.shippedQuantity, row.remainingQuantity],
      }))
    figures.push({
      id: 'inventory-flow',
      title: '采购 · 发货 · 留存',
      span: 8,
      option: bars(plot, [{ name: '采购' }, { name: '发货' }, { name: '留存' }], {
        unit: unitName(flowUnit),
        vertical: true,
      }),
      rows: details(plot, ['采购', '发货', '留存'], (v) => count(v ?? 0)),
      compact: !plot.length,
      empty: !flowUnit && summary.length ? '请选择同一计量单位后比较' : '所选范围无采购、发货记录',
      emptyAction: 'inventory',
      note: flowUnit ? `按${unitName(flowUnit)}分别统计` : undefined,
    })
    const demand = (data.inventoryReplenishment || [])
      .filter((row) => !options.inventoryUnit || row.unitCode === options.inventoryUnit)
      .sort((a, b) => a.coverageDays - b.coverageDays)
    const replenishment = stockUnavailable ? [] : demand
    const cover = replenishment.map((row) => ({
      key: row.productCode,
      name: row.productName,
      values: [row.dailySalesQuantity > 0 ? row.coverageDays : null],
    }))
    figures.push({
      id: 'coverage',
      title: '库存可售天数',
      span: 4,
      option: heatmap(cover, ['可售天数'], { unit: '天', reverse: true, missingLabel: '未计算' }),
      rows: replenishmentDetails(replenishment),
      compact: !replenishment.length,
      empty: stockUnavailable ? '库存快照暂无记录，无法判断可售天数' : '当前筛选无库存覆盖记录',
      emptyAction: 'inventory',
      note: '无日销时不计算覆盖天数',
    })
    const supply = replenishment.map((row) => ({
      key: row.productCode,
      name: row.productName,
      values: [row.availableQuantity, row.inTransitQuantity, row.suggestedProcurementQuantity],
    }))
    const demandPlot = demand.map((row) => ({
      key: row.productCode,
      name: row.productName,
      values: [row.dailySalesQuantity],
    }))
    figures.push({
      id: 'replenishment',
      title: stockUnavailable ? '商品日均销售需求' : '可用库存与补货建议',
      span: 8,
      option: stockUnavailable
        ? bars(demandPlot, [{ name: '日均销量' }], {
            unit: `${unitName(options.inventoryUnit)}/天`,
          })
        : heatmap(supply, ['可用', '在途', '建议补货'], { unit: unitName(options.inventoryUnit) }),
      height: Math.max(
        160,
        Math.min(stockUnavailable ? demand.length : replenishment.length, 8) * 30 + 90,
      ),
      rows: stockUnavailable
        ? details(demandPlot, ['日均销量'], (v) => count(v ?? 0))
        : replenishmentDetails(replenishment),
      note: stockUnavailable ? '无库存快照，不计算采购建议' : undefined,
      empty: '当前筛选无补货建议',
      emptyAction: 'inventory',
    })
    const old = summary.map((row, i) => ({
      key: `${row.categoryCode}-${i}`,
      name: row.categoryName,
      values: [row.inactiveRemainingQuantity],
    }))
    figures.push({
      id: 'inactive-stock',
      title: '历史留存分布',
      span: 4,
      option: pareto(old, '历史留存', unitName(options.inventoryUnit)),
      rows: details(old, ['历史留存'], (v) => count(v ?? 0)),
      empty: '当前筛选无历史留存',
      emptyAction: 'inventory',
    })
  }

  if (section === 'overview') {
    kpis = [
      ...core,
      {
        label: '经营成本',
        value: amount(costs.cost),
        color: chartColors[2],
        sample: costs.sample,
        section: 'city-cost',
      },
      {
        label: '经营结余',
        value: amount(costs.profit),
        color: costs.profit < 0 ? chartColors[3] : chartColors[1],
        sample: costs.sample,
        section: 'city-cost',
        definition: '销售额减经营成本。样例成本参与计算时，结余也为样例。',
      },
    ]
    addTrend('trend', '销售与回款趋势', 8)
    addCollectionGauge('collection-progress', '整体回款进度', 4)
    addCostBridge(6)
    addCollectionComparison('cities', '城市销售与回款', cities, 'city', 6)
    addCostStructure(6)
    addProducts('CATEGORY', 6)
    addPerformanceRanking(12)
  } else if (section === 'sales') {
    if (options.ownerStaffCode) {
      addTrend('monthly-sales', '个人销售与回款趋势', 8)
      addCollectionGauge('collection-progress', '个人回款进度', 4)
    } else {
      addPerformanceRanking(12)
      addCollectionGauge(
        'collection-progress',
        options.regionCode ? '本城市团队回款进度' : '全国销售回款进度',
        4,
      )
      const monthly = data.salesMonthlyPerformance || []
      const owners = [...sellers]
        .filter((row) => concreteDimension(row.dimensionCode))
        .sort(
          (a, b) => b.salesAmount - a.salesAmount || a.dimensionCode.localeCompare(b.dimensionCode),
        )
        .slice(0, 6)
      const periods = aggregatePeriods(
        monthly.map((row) => ({
          metricCode: 'sales_amount',
          period: row.period,
          value: row.salesAmount,
          secondaryValue: row.paidAmount,
        })),
        'month',
      ).map((row) => row.key)
      const amounts = new Map<string, number>()
      monthly.forEach((row) => {
        const key = `${row.period.slice(0, 7)}:${row.ownerStaffCode}`
        if (row.salesAmount != null && Number.isFinite(Number(row.salesAmount)))
          amounts.set(key, (amounts.get(key) ?? 0) + Number(row.salesAmount))
      })
      const plot = periods.map((period) => ({
        key: period,
        name: period,
        seriesKeys: owners.map((owner) => `${period}:${owner.dimensionCode}`),
        values: owners.map((owner) => amounts.get(`${period}:${owner.dimensionCode}`) ?? null),
      }))
      const series = owners.map((row) => ({ name: row.dimensionName || row.dimensionCode }))
      if (periods.length > 1 && owners.length)
        figures.push({
          id: 'monthly-sales',
          title: `销售额前${owners.length}位 · 月度趋势`,
          span: 8,
          smallMultiples: { rows: plot, series },
          option: smallMultipleLines(plot, series),
          height: smallMultipleHeight(series.length),
          rows: monthly.map((row, i) => ({
            key: `${row.period}-${i}`,
            groupKey: `${row.period.slice(0, 7)}:${row.ownerStaffCode}`,
            name: row.ownerStaffName,
            kind: 'sales',
            ownerStaffCode: row.ownerStaffCode,
            regionCode: row.regionCode,
            period: row.period,
            cells: {
              月份: row.period,
              城市: row.regionName || '—',
              销售额: exactAmount(row.salesAmount),
              回款额: exactAmount(row.paidAmount),
              客户数: count(row.customerCount),
            },
          })),
          empty: '当前筛选无月度销售记录',
          note: '按当前范围销售额选人；不是综合绩效排名',
        })
    }
    addTargets(false, 4)
    if (!options.ownerStaffCode) {
      addCollectionComparison('sales-ranking', '销售回款对比', sellers, 'sales', 12)
    }
    if (options.analysis) {
      const movement = salesMovementFigure(
        sellers,
        options.analysis.previousSalesRanking,
        options.rankingMetric || 'salesAmount',
        options.analysis.previousFrom,
        options.analysis.previousTo,
      )
      if (movement) {
        if (!figures.some((figure) => figure.id === 'monthly-sales')) movement.id = 'monthly-sales'
        figures.push(movement)
      }
    }
  } else if (section === 'sales-collection') {
    addTrend()
    addCollectionGauge('collection-progress', '订单回款进度', 4)
    const receipts = aggregatePeriods(data.collectionTrend || [], options.period)
    figures.push({
      id: 'receipt-trend',
      title: '期间实际回款',
      span: 8,
      option: lines(receipts, [{ name: '实际回款', color: chartColors[1] }]),
      rows: details(receipts, ['回款额'], exactAmount, 'receipt').map((row) => ({
        ...row,
        period: row.key,
      })),
      note: '按回款发生日期统计',
    })
    addAging()
  } else if (section === 'city-operating') {
    if (options.regionCode) {
      addTrend('city-trend', `${options.regionName || '本城市'}销售与回款趋势`, 8)
      addCollectionGauge('city-collection-progress', '城市回款进度', 4)
      addPerformanceRanking(8)
      addTargets(true, 4)
      addCostBridge(6)
      addAging(6)
    } else {
      figures.push({
        id: 'cities',
        title: '城市经营指标',
        span: 8,
        option: cityOperatingMatrix(
          cities.map((row) => ({
            key: row.dimensionCode,
            name: row.dimensionName || row.dimensionCode,
            salesAmount: row.salesAmount,
            paidAmount: row.paidAmount,
            unpaidAmount: row.unpaidAmount,
          })),
        ),
        rows: rankingRows(cities, 'city'),
        empty: '所选范围没有销售记录',
        note: '同批订单累计已收 / 应收；待回款不等同于逾期',
      })
      addAging(4)
      addCityCosts(6)
      addTargets(true, 6)
      addPerformanceRanking(12)
    }
    addCollectionComparison('city-sellers', '城市销售人员回款', sellers, 'sales', 6)
    addProducts('CATEGORY', 6)
  } else if (section === 'customer') {
    kpis = [
      countKpi('active_customer_count', '可用客户'),
      countKpi('cooperated_customer_count', '合作客户'),
      countKpi('repeat_customer_count', '复购客户'),
      {
        ...countKpi('customer_churn_risk_count', '待跟进客户'),
        definition: '从未下单或距最近下单已满30天；不等同于已流失',
      },
    ]
    const segments = (data.customerSegments || []).map((row) => ({
      key: row.segmentCode,
      name: row.segmentName,
      values: [row.customerCount],
    }))
    figures.push({
      id: 'customer-risk',
      title: '客户分层与跟进压力',
      span: 8,
      option: bars(
        (data.customerSegments || []).map((row) => ({
          key: row.segmentCode,
          name: row.segmentName,
          values: [row.customerCount - row.churnRiskCustomerCount, row.churnRiskCustomerCount],
        })),
        [
          { name: '近30天有下单', color: chartColors[1] },
          { name: '待跟进', color: chartColors[2] },
        ],
        { stacked: true, vertical: true, unit: '位' },
      ),
      rows: (data.customerSegments || []).map((row) => ({
        key: row.segmentCode,
        name: row.segmentName,
        cells: {
          客户数: count(row.customerCount),
          待跟进客户: count(row.churnRiskCustomerCount),
          待跟进占比: percent(ratio(row.churnRiskCustomerCount, row.customerCount)),
          待回款: exactAmount(row.unpaidAmount),
        },
      })),
      empty: '客户分层汇总暂不可用',
      note: '当前范围全部分层客户；待跟进包含从未下单、满30天未再下单',
    })
    figures.push({
      id: 'segments',
      title: '客户分层',
      span: 4,
      option: ring(
        segments,
        count(segments.reduce((sum, row) => sum + row.values[0], 0)),
        '分层客户',
      ),
      rows: details(segments, ['客户数'], (v) => count(v ?? 0)),
    })
    const value = (data.customerSegments || []).map((row) => ({
      key: row.segmentCode,
      name: row.segmentName,
      values: [row.salesAmount, row.unpaidAmount],
    }))
    figures.push({
      id: 'segment-value',
      title: '各层客户销售与待回款',
      span: 8,
      option: bars(value, [{ name: '销售额' }, { name: '待回款', color: chartColors[2] }]),
      rows: details(value, ['销售额', '待回款']),
    })
    addCustomerValue(8)
    const churn = [...(data.customerChurnRiskRanking || [])]
    const cohort = (row: (typeof churn)[number]) =>
      !row.lastOrderTime ? '待首单' : row.inactiveDays >= 60 ? '60天及以上未下单' : '30–59天未下单'
    const plot = ['待首单', '30–59天未下单', '60天及以上未下单'].map((name) => ({
      key: name,
      name,
      values: [churn.filter((row) => cohort(row) === name).length],
    }))
    figures.push({
      id: 'churn',
      title: '优先跟进名单分布',
      span: 12,
      option: bars(plot, [{ name: '客户数', color: chartColors[2] }], {
        unit: '位',
        vertical: true,
      }),
      rows: customerDetails(churn).map((row, i) => ({ ...row, groupKey: cohort(churn[i]) })),
      compact: !churn.length,
      empty:
        metricValue(data, 'customer_churn_risk_count') === 0
          ? '当前范围无待跟进客户'
          : '待跟进名单暂未返回，请重试查询',
      note: `${metricValue(data, 'customer_churn_risk_count') == null ? '风险汇总暂不可用' : `风险汇总 ${count(metric(data, 'customer_churn_risk_count'))} 位`}；本次返回 ${churn.length} 位优先名单，不代表全部客户`,
    })
  } else if (section === 'product-sales') {
    kpis = [
      moneyKpi('sales_net_amount', '销售净收入', chartColors[0]),
      moneyKpi('refund_amount', '退款额', chartColors[3]),
      referenceCostKpi(),
      {
        label: '采购价覆盖率',
        value: percent(metricValue(data, 'cost_coverage_rate')),
        color: chartColors[1],
      },
    ]
    addProducts(options.productDimension, 8)
    if (options.productDimension !== 'CATEGORY') addProducts('CATEGORY', 4, 'categories')
    if (options.productDimension !== 'BRAND') addProducts('BRAND', 6, 'brands')
    const source = productRows(data, options.productDimension)
    const plot = source.map((row) => ({
      key: row.dimensionCode,
      name: row.dimensionName,
      values: [row.customerCount],
    }))
    figures.push({
      id: 'product-customers',
      title: `${dimensionLabels[options.productDimension]}客户覆盖`,
      span: 6,
      option: bars(plot, [{ name: '客户数', color: chartColors[1] }], { unit: '个' }),
      rows: details(plot, ['客户数'], (v) => count(v ?? 0), 'product').map((row) => ({
        ...row,
        dimension: options.productDimension,
      })),
    })
  } else if (section === 'gross-profit') {
    const coverage = metricValue(data, 'cost_coverage_rate')
    const complete = coverage != null && coverage >= 100
    kpis = [
      moneyKpi('sales_net_amount', '销售净收入', chartColors[0]),
      referenceCostKpi(),
      {
        label: '估算毛利',
        value: complete ? amount(metricValue(data, 'estimated_gross_profit')) : '—',
        color: chartColors[1],
        definition: '仅采购参考价全部覆盖时展示总体估算毛利。',
      },
      { label: '采购价覆盖率', value: percent(coverage), color: chartColors[0] },
    ]
    const source = productRows(data, options.productDimension)
    const plot = source
      .filter((row) => row.costCoverageRate >= 100)
      .map((row) => ({
        key: row.dimensionCode,
        name: row.dimensionName,
        values: [row.estimatedCostAmount, row.estimatedGrossProfit],
      }))
    figures.push({
      id: 'product-profit',
      title: '商品成本与估算毛利',
      span: 8,
      option: bars(
        plot,
        [
          { name: '参考价成本', color: chartColors[2] },
          { name: '估算毛利', color: chartColors[1] },
        ],
        { stacked: true },
      ),
      rows: details(plot, ['参考价成本', '估算毛利']),
      note: '仅含采购价完整的商品；不含人工、房租等期间费用',
      empty: '所选范围没有采购价完整的商品',
      emptyAction: 'product',
    })
    const coveragePlot = [
      { key: 'covered', name: '已覆盖', values: [coverage ?? 0] },
      { key: 'missing', name: '未覆盖', values: [Math.max(0, 100 - (coverage ?? 0))] },
    ]
    figures.push({
      id: 'cost-coverage',
      title: '采购参考价覆盖',
      span: 4,
      option:
        coverage == null
          ? { series: [] }
          : ring(coveragePlot, percent(coverage), '按订单行金额', [chartColors[1], '#dce3ea']),
      compact: coverage == null,
      empty: '采购参考价覆盖率暂不可用',
      rows: (coverage == null ? [] : source).map((row) => ({
        key: row.dimensionCode,
        name: row.dimensionName,
        kind: 'product',
        code: row.dimensionCode,
        dimension: options.productDimension,
        cells: {
          采购价覆盖率: percent(row.costCoverageRate),
          销售额: exactAmount(row.salesAmount),
        },
      })),
    })
    const margins = source
      .filter((row) => row.costCoverageRate >= 100)
      .sort((a, b) => a.estimatedGrossProfitRate - b.estimatedGrossProfitRate)
      .map((row) => ({
        key: row.dimensionCode,
        name: row.dimensionName,
        values: [row.estimatedGrossProfitRate],
      }))
    figures.push({
      id: 'margins',
      title: '低毛利商品',
      span: 6,
      option: bars(margins, [{ name: '估算毛利率', color: chartColors[2] }], { unit: '%' }),
      rows: details(margins, ['估算毛利率'], percent),
      empty: '当前范围没有采购参考价完整的商品，暂不比较毛利率',
      emptyAction: 'product',
    })
    const refunds = source
      .filter((row) => row.refundAmount > 0)
      .sort((a, b) => b.refundAmount - a.refundAmount)
      .map((row) => ({
        key: row.dimensionCode,
        name: row.dimensionName,
        values: [row.refundAmount],
      }))
    figures.push({
      id: 'refunds',
      title: '商品退款影响',
      span: 6,
      option: bars(refunds, [{ name: '退款额', color: chartColors[3] }]),
      rows: details(refunds, ['退款额']),
      empty: '当前筛选无退款记录',
    })
  } else if (section === 'payment-risk') {
    kpis = [
      moneyKpi('unpaid_amount', '全部待回款', chartColors[0]),
      moneyKpi('payment_risk_amount', '逾期待回款', chartColors[3]),
      countKpi('payment_risk_customer_count', '逾期客户'),
      {
        label: '平均逾期天数',
        value: `${count(metric(data, 'payment_avg_overdue_days'))}天`,
        color: chartColors[2],
      },
    ]
    addRanking(
      'overdue-cities',
      '逾期金额 · 城市',
      data.paymentRiskCityRanking || [],
      'city',
      8,
      true,
    )
    addAging(4)
    addRanking(
      'overdue-sales',
      '逾期金额 · 责任销售',
      data.paymentRiskSalesRanking || [],
      'sales',
      8,
      true,
    )
    addCollectionComparison('city-paid-rate', '城市回款对比', cities, 'city', 4)
  } else if (section === 'city-cost') {
    kpis = [
      core[0],
      { label: '经营成本', value: amount(costs.cost), color: chartColors[2], sample: costs.sample },
      {
        label: '经营结余',
        value: amount(costs.profit),
        color: costs.profit < 0 ? chartColors[3] : chartColors[1],
        sample: costs.sample,
      },
      {
        label: '成本率',
        value: percent(ratio(costs.cost, costs.sales)),
        color: chartColors[2],
        sample: costs.sample,
      },
    ]
    addCostBridge(6)
    addCostStructure(6)
    addCityCosts(12)
    const skuCosts = data.skuSalesRanking || []
    const pricedSkus = skuCosts.filter((row) => row.costCoverageRate > 0)
    if (pricedSkus.length) {
      figures.push({
        id: 'sku-reference-cost',
        title: 'SKU采购参考成本',
        span: 12,
        height: 320,
        option: pareto(
          pricedSkus.map((row) => ({
            key: row.dimensionCode,
            name: row.dimensionName,
            group: row.categoryCode,
            groupName: row.categoryName,
            values: [row.estimatedCostAmount],
          })),
          '采购参考成本',
        ),
        rows: skuCosts.map((row) => ({
          key: row.dimensionCode,
          code: row.dimensionCode,
          name: row.dimensionName,
          kind: 'product',
          dimension: 'SKU',
          sample: false,
          cells: {
            分类: row.categoryName || '未分类',
            商品行销售额: exactAmount(row.salesAmount),
            采购参考成本:
              row.costCoverageRate > 0 ? exactAmount(row.estimatedCostAmount) : '未取得参考价',
            采购参考价覆盖率: percent(row.costCoverageRate),
          },
        })),
        note: 'ERP采购参考价 × 订单行数量；仅覆盖已有参考价的销售，不含运费损耗，不计入上方经营成本',
      })
    }
    const skuPlot = sampleSkuCosts.map((row, i) => ({
      key: String(i),
      name: row.name,
      values: [row.price * row.quantity, row.price * row.quantity * row.loss],
    }))
    figures.push({
      id: 'sku-costs',
      title: 'SKU采购与损耗',
      span: 8,
      sample: true,
      option: bars(skuPlot, [{ name: '货品采购' }, { name: '采购损耗', color: chartColors[2] }], {
        stacked: true,
      }),
      rows: sampleSkuCosts.map((row, i) => ({
        key: String(i),
        name: row.name,
        sample: true,
        cells: {
          分类: row.category,
          系列: row.series,
          规格: row.sku,
          采购价: exactAmount(row.price),
          数量: count(row.quantity),
          损耗率: percent(row.loss * 100),
          含损耗成本: exactAmount(row.price * row.quantity * (1 + row.loss)),
        },
      })),
      note: '分类 → 系列 → 口味 → 规格；独立固定批次SKU样例，不随城市或日期变化，不计入城市总额',
    })
    const humanLines = costs.lines.filter((row) => row.group === '人')
    const human = humanLines.map((row) => ({ key: row.name, name: row.name, values: [row.amount] }))
    figures.push({
      id: 'human-cost',
      title: '人力成本构成',
      span: 4,
      sample: humanLines.some((row) => row.sample),
      option: human.some((row) => row.values[0] < 0)
        ? bars(human, [{ name: '人力成本', color: chartColors[1] }])
        : ring(human, amount(human.reduce((sum, row) => sum + row.values[0], 0)), '人力成本'),
      rows: details(human, ['金额']).map((row, index) => ({
        ...row,
        sample: humanLines[index].sample,
      })),
      note: '仅城市/期间汇总；已入账未分项成本不分摊为人力',
      empty: '当前范围未提供人力成本分项',
    })
  } else if (section === 'product-inventory') {
    const rows = (data.inventoryItemSummary || []).filter(
      (row) => row.unitCode === options.inventoryUnit,
    )
    const unit = unitName(options.inventoryUnit)
    kpis = [
      ['采购数量', 'procurementQuantity'],
      ['发货数量', 'shippedQuantity'],
      ['留存数量', 'remainingQuantity'],
      ['历史留存', 'inactiveRemainingQuantity'],
    ].map(([label, field], index) => ({
      label,
      color: chartColors[index],
      value: rows.length
        ? `${count(rows.reduce((sum, row) => sum + numeric(row[field as keyof typeof row]), 0))}${unit}`
        : '—',
    }))
    addInventory()
  } else if (section === 'inventory-risk') {
    const risks = data.risks || []
    kpis = [
      {
        label: '重点库存风险项',
        value: stockUnavailable ? '—' : count(risks.length),
        color: chartColors[0],
      },
      ...['HIGH', 'MEDIUM', 'LOW'].map((level, i) => ({
        label: ['高风险', '中风险', '低风险'][i],
        value: stockUnavailable
          ? '—'
          : count(risks.filter((row) => row.riskLevel === level).length),
        color: [chartColors[3], chartColors[2], chartColors[1]][i],
      })),
    ]
    const levels = ['HIGH', 'MEDIUM', 'LOW'].map((level, index) => ({
      key: level,
      name: ['高风险', '中风险', '低风险'][index],
      values: [risks.filter((row) => row.riskLevel === level).length],
    }))
    figures.push({
      id: 'risk-levels',
      title: '库存风险等级',
      span: 4,
      option: ring(levels, count(risks.length), '已返回风险项'),
      rows: stockUnavailable ? [] : details(levels, ['风险项'], (v) => count(v ?? 0)),
      empty: stockUnavailable ? '库存快照暂无记录，无法评估风险' : '当前无重点库存风险',
      note: '接口最多返回20项，不代表全部库存风险',
    })
    const types = [...new Set(risks.map((row) => row.riskType))].map((type) => ({
      key: type,
      name: riskTypeName(type),
      values: ['HIGH', 'MEDIUM', 'LOW'].map(
        (level) => risks.filter((row) => row.riskType === type && row.riskLevel === level).length,
      ),
    }))
    figures.push({
      id: 'risk-types',
      title: '库存异常分布',
      span: 8,
      option: heatmap(types, ['高风险', '中风险', '低风险'], {
        unit: '项',
        cellKey: (row, x) => `${row.key}:${['HIGH', 'MEDIUM', 'LOW'][x]}`,
      }),
      rows: risks.map((row, index) => ({
        key: `${row.riskType}-${index}`,
        groupKey: `${row.riskType}:${row.riskLevel}`,
        name: row.dimensionName,
        kind: 'inventory',
        code: row.dimensionCode,
        cells: {
          异常: riskTypeName(row.riskType),
          风险等级: riskLevelName(row.riskLevel),
          说明: row.description,
          观测时间: row.observedAt || '—',
        },
      })),
      empty: stockUnavailable ? '库存快照暂无记录，无法评估异常' : '当前筛选无重点库存异常',
      note: '按接口已返回的风险项统计，不代表全量库存风险',
    })
    const replenish = (stockUnavailable ? [] : data.inventoryReplenishment || []).filter(
      (row) => !options.inventoryUnit || row.unitCode === options.inventoryUnit,
    )
    const plot = replenish.map((row) => ({
      key: row.productCode,
      name: row.productName,
      values: [row.availableQuantity, row.inTransitQuantity, row.suggestedProcurementQuantity],
    }))
    figures.push({
      id: 'risk-replenishment',
      title: '风险商品补货',
      span: 12,
      option: heatmap(plot, ['可用库存', '在途', '建议补货'], {
        unit: unitName(options.inventoryUnit),
      }),
      rows: replenishmentDetails(replenish),
      empty: stockUnavailable ? '库存快照暂无记录，无法计算补货量' : '当前筛选无补货建议',
      emptyAction: 'inventory',
    })
  } else if (section === 'activity') {
    const campaigns = [
      { name: '方便面开学季促销', sales: 65000, cost: 12500, reach: 280, order: 76, budget: 18000 },
      { name: '台球周边联名活动', sales: 52000, cost: 7600, reach: 180, order: 49, budget: 12000 },
      { name: '粉面菜蛋试吃转化', sales: 38000, cost: 10800, reach: 340, order: 53, budget: 16000 },
    ]
    const totals = campaigns.reduce(
      (sum, row) => ({
        sales: sum.sales + row.sales,
        cost: sum.cost + row.cost,
        reach: sum.reach + row.reach,
        order: sum.order + row.order,
      }),
      { sales: 0, cost: 0, reach: 0, order: 0 },
    )
    kpis = [
      { label: '活动成交', value: amount(totals.sales), color: chartColors[0], sample: true },
      { label: '活动费用', value: amount(totals.cost), color: chartColors[2], sample: true },
      {
        label: '费用产出比',
        value: `${(totals.sales / totals.cost).toFixed(2)}倍`,
        color: chartColors[1],
        sample: true,
        definition: '活动销售额 / 活动费用；不是净利润ROI。',
      },
      {
        label: '触达转化率',
        value: percent(ratio(totals.order, totals.reach)),
        color: chartColors[1],
        sample: true,
      },
    ]
    const plot = campaigns.map((row) => ({
      key: row.name,
      name: row.name,
      values: [row.sales, row.cost],
    }))
    const records = campaigns.map((row) => ({
      key: row.name,
      name: row.name,
      sample: true,
      cells: {
        活动销售额: exactAmount(row.sales),
        费用: exactAmount(row.cost),
        费用产出比: `${(row.sales / row.cost).toFixed(2)}倍`,
        触达客户: count(row.reach),
        下单客户: count(row.order),
        预算: exactAmount(row.budget),
      },
    }))
    figures.push({
      id: 'campaigns',
      title: '活动销售分布',
      span: 8,
      sample: true,
      option: pareto(plot, '活动销售额'),
      rows: records,
      note: '独立活动样例，不计入真实销售汇总',
    })
    const conversion = campaigns.map((row) => ({
      key: row.name,
      name: row.name,
      values: [ratio(row.order, row.reach)],
    }))
    figures.push({
      id: 'conversion',
      title: '活动转化对比',
      span: 4,
      sample: true,
      option: bars(conversion, [{ name: '触达转化率', color: chartColors[1] }], { unit: '%' }),
      rows: records,
    })
    const budget = campaigns.map((row) => ({
      key: row.name,
      name: row.name,
      values: [row.cost, row.budget - row.cost],
    }))
    figures.push({
      id: 'campaign-budget',
      title: '活动预算执行',
      span: 6,
      sample: true,
      option: heatmap(budget, ['已使用', '剩余预算'], { money: true }),
      rows: records,
    })
    const returns = campaigns.map((row) => ({
      key: row.name,
      name: row.name,
      values: [row.sales / row.cost],
    }))
    figures.push({
      id: 'campaign-return',
      title: '活动费用产出比',
      span: 6,
      sample: true,
      option: bars(returns, [{ name: '费用产出比', color: chartColors[1] }], { unit: '倍' }),
      rows: records,
    })
  }

  if (options.analysis) {
    const extra = operatingAnalysisFigures(options.analysis, section)
    if (section === 'product-sales') figures.unshift(...extra)
    else figures.push(...extra)
  }
  if (options.costScopeLimited) {
    kpis = kpis.map((row) =>
      ['经营成本', '经营结余', '成本率'].includes(row.label)
        ? {
            ...row,
            value: '—',
            sample: false,
            definition: '城市成本不按销售人员、客户类型或订单来源分摊',
          }
        : row,
    )
    figures
      .filter((figure) =>
        ['cost-bridge', 'city-costs', 'cost-structure', 'human-cost'].includes(figure.id),
      )
      .forEach((figure) => {
        figure.rows = []
        figure.option = { series: [] }
        figure.compact = true
        figure.sample = false
        figure.breakdown = undefined
        figure.note = undefined
        figure.empty = '城市成本不按销售人员、客户类型或订单来源分摊'
        figure.emptyAction = 'cost'
      })
  }
  if (options.inventoryScopeLimited && ['product-inventory', 'inventory-risk'].includes(section)) {
    kpis = kpis.map((row) => ({ ...row, value: '—' }))
    figures.forEach((figure) => {
      figure.rows = []
      figure.option = { series: [] }
      figure.compact = true
      figure.empty = '当前库存口径不支持所选业务筛选'
      figure.emptyAction = 'inventory'
    })
  }
  const unavailable = new Set(options.unavailableSubjects || [])
  const restrictedFigures: [string, string[], string][] = [
    [
      'CITY_COST',
      [
        'cost-bridge',
        'cost-structure',
        'city-costs',
        'human-cost',
        'sku-costs',
        'sku-reference-cost',
      ],
      '当前数据范围暂不支持城市成本汇总',
    ],
    ['LEGACY_TARGETS', ['targets'], '当前数据范围暂不支持目标完成率汇总'],
    [
      'LEGACY_CUSTOMER_ACTIVITY',
      ['customer-risk', 'segments', 'segment-value', 'customer-value', 'churn'],
      '当前数据范围暂不支持客户分层与活跃度汇总',
    ],
    ['LEGACY_PERIOD_RECEIPTS', ['receipt-trend'], '当前数据范围暂不支持按到账时间汇总'],
  ]
  if (unavailable.has('INVENTORY') && ['product-inventory', 'inventory-risk'].includes(section)) {
    restrictedFigures.push([
      'INVENTORY',
      figures.map((figure) => figure.id),
      '当前账号尚无可用的仓库数据范围',
    ])
    kpis = kpis.map((row) => ({ ...row, value: '—', sample: false }))
  }
  if (unavailable.has('CITY_COST')) {
    kpis = kpis.map((row) =>
      ['经营成本', '经营结余', '成本率'].includes(row.label)
        ? { ...row, value: '—', sample: false, definition: '当前数据范围暂不支持城市成本汇总' }
        : row,
    )
  }
  for (const [subject, ids, message] of restrictedFigures) {
    if (!unavailable.has(subject)) continue
    let retained = false
    for (let index = 0; index < figures.length; index++) {
      if (!ids.includes(figures[index].id)) continue
      if (retained) {
        figures.splice(index--, 1)
        continue
      }
      figures[index] = {
        ...figures[index],
        rows: [],
        option: { series: [] },
        compact: true,
        sample: false,
        breakdown: undefined,
        smallMultiples: undefined,
        note: undefined,
        empty: message,
        emptyAction: undefined,
      }
      retained = true
    }
  }
  const actions: CockpitAction[] = []
  const riskCity = [...(data.paymentRiskCityRanking || [])].sort(
    (a, b) => b.unpaidAmount - a.unpaidAmount,
  )[0]
  if (riskCity?.unpaidAmount > 0)
    actions.push({
      label: `${riskCity.dimensionName}逾期回款跟进`,
      value: amount(riskCity.unpaidAmount),
      section: 'payment-risk',
      row: rankingRows([riskCity], 'city')[0],
    })
  const followups = unavailable.has('LEGACY_CUSTOMER_ACTIVITY')
    ? []
    : [...(data.customerChurnRiskRanking || [])]
        .filter((row) => !row.lastOrderTime || row.inactiveDays >= 30)
        .sort(
          (a, b) =>
            b.unpaidAmount - a.unpaidAmount ||
            b.salesAmount - a.salesAmount ||
            a.customerCode.localeCompare(b.customerCode),
        )
        .slice(0, section === 'customer' ? 3 : 1)
  for (const churn of followups)
    actions.push({
      label: `客户「${churn.customerName}」${churn.lastOrderTime ? '回访' : '首单跟进'}`,
      value: churn.lastOrderTime ? `${churn.inactiveDays}天未下单` : '尚未下单',
      context: [
        churn.regionName,
        churn.ownerStaffName ? `责任销售 ${churn.ownerStaffName}` : '责任销售待分配',
      ]
        .filter(Boolean)
        .join(' · '),
      section: 'customer',
      row: customerDetails([churn])[0],
    })
  const replenish = (data.inventoryReplenishment || []).find(
    (row) => row.suggestedProcurementQuantity > 0,
  )
  if (replenish && !stockUnavailable && !options.inventoryScopeLimited)
    actions.push({
      label: `${replenish.productName}补货`,
      value: `${count(replenish.suggestedProcurementQuantity)}${unitName(replenish.unitCode)}`,
      section: 'product-inventory',
      row: replenishmentDetails([replenish])[0],
    })
  const relevantActions = actions.filter(
    (action) =>
      ['overview', 'city-operating'].includes(section) ||
      (['sales', 'sales-collection', 'payment-risk'].includes(section) &&
        action.section === 'payment-risk') ||
      (section === 'customer' && action.section === 'customer') ||
      (['product-inventory', 'inventory-risk'].includes(section) &&
        action.section === 'product-inventory'),
  )
  return { figures, kpis, actions: relevantActions }
}

function customerDetails(rows: SupplyDashboardOverview['customerActivityRanking']): DetailRow[] {
  return rows.map((row) => ({
    key: row.customerCode,
    name: row.customerName,
    kind: 'customer',
    code: row.customerCode,
    regionCode: row.regionCode,
    ownerStaffCode: row.ownerStaffCode,
    cells: {
      城市: row.regionName || '—',
      责任销售: row.ownerStaffName || row.ownerStaffCode || '未分配',
      分层: row.segmentName,
      销售额: exactAmount(row.salesAmount),
      待回款: exactAmount(row.unpaidAmount),
      活跃度: count(row.activityScore),
      未下单天数: row.lastOrderTime ? count(row.inactiveDays) : '尚未下单',
      最近下单: row.lastOrderTime ? businessDate(row.lastOrderTime) : '无历史订单',
    },
  }))
}
function replenishmentDetails(
  rows: SupplyDashboardOverview['inventoryReplenishment'],
): DetailRow[] {
  return rows.map((row) => ({
    key: row.productCode,
    code: row.productCode,
    name: row.productName,
    kind: 'inventory',
    cells: {
      单位: unitName(row.unitCode),
      日销: count(row.dailySalesQuantity),
      可用库存: count(row.availableQuantity),
      在途: count(row.inTransitQuantity),
      可售天数: row.dailySalesQuantity > 0 ? count(row.coverageDays) : '无日销',
      建议补货: count(row.suggestedProcurementQuantity),
      风险等级: riskLevelName(row.riskLevel),
    },
  }))
}
export function unitName(code: string): string {
  return reportUnitName(code)
}
function riskLevelName(code: string): string {
  return (
    ({ HIGH: '高危', MEDIUM: '预警', LOW: '低风险', NORMAL: '正常' } as Record<string, string>)[
      code
    ] || '待核对'
  )
}
function riskTypeName(code: string): string {
  return (
    (
      {
        LOW_AVAILABLE: '可用库存不足',
        LOCKED_STOCK: '库存锁定',
        STALE_INVENTORY: '历史库存',
        NEGATIVE_AVAILABLE: '负可用库存',
        LOCKED_EXCEEDS_ON_HAND: '锁定超过在库',
        INACTIVE_INVENTORY: '长期未动销',
      } as Record<string, string>
    )[code] || code
  )
}
