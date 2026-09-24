import type { EChartsCoreOption } from 'echarts/core'
import type {
  SupplyDashboardOverview,
  SupplyDashboardQuery,
  SupplyDashboardTargetCompletionItem,
  SupplyDashboardDataTrust,
  SupplyDashboardOperatingAnalysis,
} from '@/api/core/bi'
import { businessDate, businessDateRange, businessMonthRange } from '@/utils/business-date'

export const meetingPages = ['经营总览', '目标达成', '城市经营', '客户与商品', '回款风险']
export interface MeetingSnapshot {
  current: SupplyDashboardOverview
  previous: SupplyDashboardOverview | null
  query: SupplyDashboardQuery
  previousQuery: SupplyDashboardQuery
  trust: SupplyDashboardDataTrust | null
  comparisonError?: string
  trustError?: string
  analysis?: SupplyDashboardOperatingAnalysis | null
  previousAnalysis?: SupplyDashboardOperatingAnalysis | null
  analysisError?: string
}
export interface MeetingRow {
  code: string
  name: string
  amount: number | null
  previous?: number | null
  paid?: number | null
  unpaid?: number | null
  orders?: number | null
  customers?: number | null
}

/** Calendar arithmetic is UTC-only; query instants retain Shanghai business-day boundaries. */
export function meetingPeriods(month: string, now = new Date()) {
  const today = businessDate(now)
  const [start, end] = businessMonthRange(month)
  if (month > today.slice(0, 7)) throw new Error('不能查看未来月份')
  const yesterday = new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10)
  const to = month === today.slice(0, 7) ? yesterday : end
  if (to < start) throw new Error('本月尚无完整业务日，请选择上月')
  const previousMonth = new Date(Date.parse(start) - 86400000).toISOString().slice(0, 7)
  const [previousStart, previousEnd] = businessMonthRange(previousMonth)
  const comparisonTo = to === end ? previousEnd : `${previousMonth}-${to.slice(8)}`
  return {
    current: businessDateRange(start, to),
    previous: businessDateRange(
      previousStart,
      comparisonTo > previousEnd ? previousEnd : comparisonTo,
    ),
  }
}

export const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null
export function meetingMetric(data: SupplyDashboardOverview | null | undefined, code: string) {
  const sourceCode = code === 'receipt_amount' ? 'ORDER_PAYMENT_RECORD' : 'ORDER_SALES_ORDER'
  const source = data?.freshness?.find((row) => row.sourceCode === sourceCode)
  if (source && source.status !== 'READY') return null
  return finite(data?.metrics?.find((row) => row.metricCode === code)?.value)
}
export const money = (value: number | null | undefined) =>
  value == null
    ? '—'
    : (value / 10000).toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
export const moneyYuan = (value: number | null | undefined) =>
  value == null
    ? '—'
    : value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const count = (value: number | null | undefined) =>
  value == null ? '—' : value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
export const rate = (actual: number | null, target: number | null) =>
  actual == null || target == null || target <= 0 ? null : (actual / target) * 100
export const percentage = (value: number | null) => (value == null ? '—' : `${value.toFixed(1)}%`)
export function changeLabel(current: number | null, previous: number | null) {
  if (current == null || previous == null) return '比较数据未就绪'
  if (previous === 0) return current === 0 ? '与前期持平' : '前期为零'
  const change = ((current - previous) / Math.abs(previous)) * 100
  return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`
}

/** City and salesperson targets are alternative levels, never additive. */
export function meetingTarget(
  data: SupplyDashboardOverview,
  code: 'SALES_AMOUNT' | 'PAID_AMOUNT' | 'RECEIPT_AMOUNT',
  ownerStaffCode?: string,
) {
  const source = ownerStaffCode ? data.salesTargetCompletions : data.cityTargetCompletions
  const rows = (source || []).filter((row) => row.metricCode === code)
  const unique = new Map<string, SupplyDashboardTargetCompletionItem>()
  rows.forEach((row) => unique.set(`${row.dimensionType}:${row.dimensionCode}`, row))
  const configured = [...unique.values()].filter(
    (row) => finite(row.targetValue) != null && row.targetValue > 0,
  )
  const target = configured.length
    ? configured.reduce((sum, row) => sum + row.targetValue, 0)
    : null
  const ready =
    meetingMetric(data, code === 'RECEIPT_AMOUNT' ? 'receipt_amount' : 'sales_amount') != null
  const actual =
    ready && configured.length && configured.every((row) => finite(row.actualValue) != null)
      ? configured.reduce((sum, row) => sum + row.actualValue, 0)
      : null
  const incomplete = configured.some(
    (row) =>
      row.configuredMonthCount == null ||
      row.periodMonthCount == null ||
      row.configuredMonthCount < row.periodMonthCount,
  )
  return {
    rows: [...unique.values()],
    target,
    actual,
    rate: rate(actual, target),
    incomplete,
    count: configured.length,
    level: ownerStaffCode ? '销售' : '城市',
  }
}

export function cityRows(
  current: SupplyDashboardOverview,
  previous: SupplyDashboardOverview | null,
): MeetingRow[] {
  const old = new Map((previous?.citySalesRanking || []).map((row) => [row.dimensionCode, row]))
  const now = new Map((current.citySalesRanking || []).map((row) => [row.dimensionCode, row]))
  const codes = new Set([...now.keys(), ...old.keys()])
  return [...codes]
    .map((code) => {
      const row = now.get(code)
      const prior = old.get(code)
      return {
        code,
        name: row?.dimensionName || prior?.dimensionName || '归属待核对',
        amount: row ? finite(row.salesAmount) : 0,
        previous: previous ? (prior ? finite(prior.salesAmount) : 0) : null,
        paid: row ? finite(row.paidAmount) : 0,
        unpaid: row ? finite(row.unpaidAmount) : 0,
        orders: row ? finite(row.orderCount) : 0,
        customers: row ? finite(row.customerCount) : 0,
      }
    })
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
}

const font = '"PingFang SC", "Microsoft YaHei", sans-serif'
const text = '#a8bcd6'
export function meetingLine(
  data: SupplyDashboardOverview,
  previous: SupplyDashboardOverview | null,
  receipt = false,
): EChartsCoreOption {
  const source = receipt ? data.collectionTrend : data.salesTrend
  const prior = receipt ? previous?.collectionTrend : previous?.salesTrend
  const metricCode = receipt ? 'receipt_amount' : 'sales_amount'
  const currentPresent = meetingMetric(data, metricCode) != null
  const previousPresent = meetingMetric(previous, metricCode) != null
  const currentMap = new Map(
    (source || []).map((row) => [row.period.slice(8, 10), finite(row.value)]),
  )
  const previousMap = new Map(
    (prior || []).map((row) => [row.period.slice(8, 10), finite(row.value)]),
  )
  const lastDay = Number(businessDate(data.to).slice(8))
  const previousLast = previous ? Number(businessDate(previous.to).slice(8)) : 0
  const days = Array.from({ length: lastDay }, (_, i) => String(i + 1).padStart(2, '0'))
  const series = (name: string, values: (number | null)[], color: string, dashed = false) => ({
    type: 'line',
    name,
    data: values,
    symbol: 'circle',
    symbolSize: 5,
    smooth: false,
    itemStyle: { color },
    lineStyle: { color, width: dashed ? 2 : 3, type: dashed ? 'dashed' : 'solid' },
    ...(dashed ? {} : { areaStyle: { color, opacity: 0.09 } }),
  })
  return {
    animation: false,
    textStyle: { fontFamily: font },
    tooltip: {
      trigger: 'axis',
      confine: true,
      renderMode: 'richText',
      valueFormatter: (value: unknown) => `${Number(value).toFixed(2)} 万元`,
    },
    legend: { top: 0, right: 10, textStyle: { color: text, fontSize: 14 } },
    grid: { left: 12, right: 22, top: 45, bottom: 12, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: days.map((day) => `${Number(day)}日`),
      axisLine: { lineStyle: { color: '#34506d' } },
      axisTick: { show: false },
      axisLabel: {
        color: text,
        fontSize: 17,
        hideOverlap: true,
        interval: (index: number) => index === 0 || index === lastDay - 1 || (index + 1) % 5 === 0,
      },
    },
    yAxis: {
      type: 'value',
      name: '万元',
      nameTextStyle: { color: text },
      axisLabel: { color: text, fontSize: 17 },
      splitLine: { lineStyle: { color: '#20344b' } },
    },
    series: [
      series(
        '本期',
        days.map((day) => (currentPresent ? (currentMap.get(day) ?? 0) / 10000 : null)),
        receipt ? '#46d9eb' : '#348bff',
      ),
      ...(previousPresent
        ? [
            series(
              '上月同期',
              days.map((day) =>
                Number(day) <= previousLast ? (previousMap.get(day) ?? 0) / 10000 : null,
              ),
              '#8ea7c5',
              true,
            ),
          ]
        : []),
    ],
  } as EChartsCoreOption
}

export function meetingBars(
  rows: MeetingRow[],
  signed = false,
  color = '#348bff',
): EChartsCoreOption {
  return {
    animation: false,
    textStyle: { fontFamily: font },
    tooltip: {
      trigger: 'axis',
      confine: true,
      renderMode: 'richText',
      valueFormatter: (value: unknown) => `${Number(value).toFixed(2)} 万元`,
    },
    grid: { left: 8, right: 90, top: 12, bottom: 20, containLabel: true },
    xAxis: {
      type: 'value',
      axisLabel: { color: text },
      splitLine: { lineStyle: { color: '#20344b' } },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: rows.map((row) => row.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#e2e8f0', fontSize: 20, width: 155, overflow: 'truncate' },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 26,
        data: rows.map((row) => ({
          value: row.amount == null ? null : row.amount / 10000,
          code: row.code,
          itemStyle: { color: (row.amount ?? 0) < 0 ? '#ffbe50' : color },
        })),
        label: {
          show: true,
          position: 'right',
          color: '#e2e8f0',
          fontSize: 20,
          formatter: (params: { value: number }) =>
            `${signed && params.value > 0 ? '+' : ''}${params.value.toFixed(2)}`,
        },
      },
    ],
  } as EChartsCoreOption
}
