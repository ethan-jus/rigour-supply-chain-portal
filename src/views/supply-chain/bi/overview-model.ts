import type { EChartsCoreOption } from 'echarts/core'
import type { SupplyDashboardOverview, SupplyDashboardOperatingAnalysis } from '@/api/core/bi'
import { businessDate, businessDateRange, businessMonthRange } from '@/utils/business-date'
import { finite, meetingMetric, percentage, rate } from './meeting-model'

export function overviewPeriods(year: number, month: number | null, now = new Date()) {
  const today = businessDate(now)
  const key = `${year}-${String(month || 1).padStart(2, '0')}`
  const [from, end] = month ? businessMonthRange(key) : [`${year}-01-01`, `${year}-12-31`]
  if (from! > today) throw new Error('所选期间尚未开始')
  const to = end! < today ? end! : today
  const previousKey = month
    ? new Date(Date.parse(from!) - 86400000).toISOString().slice(0, 7)
    : `${year - 1}`
  const [oldFrom, oldEnd] = month
    ? businessMonthRange(previousKey)
    : [`${previousKey}-01-01`, `${previousKey}-12-31`]
  const aligned = month ? `${previousKey}-${to.slice(8)}` : `${previousKey}${to.slice(4)}`
  // Clamp Feb 29 when comparing a leap year with a non-leap year.
  const oldMonthEnd = businessMonthRange(aligned.slice(0, 7))[1]
  const oldTo = to === end ? oldEnd! : aligned > oldMonthEnd ? oldMonthEnd : aligned
  return {
    current: businessDateRange(from!, to),
    previous: businessDateRange(oldFrom!, oldTo),
    end: end!,
    partial: to < end!,
  }
}

export function periodBuckets(
  data: SupplyDashboardOverview | null,
  annual: boolean,
  receipt: boolean,
) {
  const size = annual ? 12 : 4
  const values: (number | null)[] = Array.from({ length: size }, () => null)
  if (!data || meetingMetric(data, receipt ? 'receipt_amount' : 'sales_amount') == null)
    return values
  const cutoff = businessDate(data.to)
  const elapsed = annual
    ? Number(cutoff.slice(5, 7))
    : Math.min(4, Math.ceil(Number(cutoff.slice(8)) / 7))
  for (let i = 0; i < elapsed; i++) values[i] = 0
  for (const point of receipt ? data.collectionTrend : data.salesTrend) {
    const day = point.period.slice(0, 10)
    if (day > cutoff || day < businessDate(data.from) || finite(point.value) == null) continue
    const index = annual
      ? Number(day.slice(5, 7)) - 1
      : Math.min(3, Math.floor((Number(day.slice(8)) - 1) / 7))
    if (index >= 0 && index < elapsed) values[index] = (values[index] || 0) + point.value
  }
  return values
}

export function overviewLine(
  current: SupplyDashboardOverview | null,
  previous: SupplyDashboardOverview | null,
  annual: boolean,
  receipt: boolean,
  yuan = false,
): EChartsCoreOption {
  const monthEnd = current
    ? businessMonthRange(businessDate(current.from).slice(0, 7))[1].slice(8)
    : '月底'
  const labels = annual
    ? Array.from({ length: 12 }, (_, i) => `${i + 1}月`)
    : ['1–7日', '8–14日', '15–21日', `22–${monthEnd}日`]
  const color = receipt ? '#55efb4' : '#3288ff'
  const series = (data: SupplyDashboardOverview | null, compare: boolean) => ({
    name: compare ? (annual ? '上年同期' : '上月同期') : '本期',
    type: 'line',
    smooth: false,
    data: periodBuckets(data, annual, receipt).map((value, index, values) =>
      value == null
        ? null
        : {
            value: value / (yuan ? 1 : 10000),
            label: {
              align: index === 0 ? 'left' : index === values.length - 1 ? 'right' : 'center',
            },
          },
    ),
    symbol: 'circle',
    symbolSize: compare ? 6 : 9,
    connectNulls: false,
    itemStyle: { color: compare ? '#8ea7c5' : color },
    lineStyle: {
      color: compare ? '#8ea7c5' : color,
      width: compare ? 1.5 : 3,
      type: compare ? 'dashed' : 'solid',
    },
    label: {
      show: !compare,
      position: 'top',
      distance: 12,
      color: '#eaf3ff',
      fontSize: annual ? 12 : 15,
      formatter: (p: { value: number | null }) =>
        p.value == null
          ? ''
          : yuan
            ? p.value.toLocaleString('zh-CN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : `${p.value.toFixed(2)}万`,
    },
    labelLayout: { hideOverlap: true },
    ...(compare ? {} : { areaStyle: { color, opacity: 0.08 } }),
  })
  return {
    animation: false,
    textStyle: { fontFamily: '"PingFang SC","Microsoft YaHei",sans-serif' },
    tooltip: {
      trigger: 'axis',
      confine: true,
      renderMode: 'richText',
      valueFormatter: (v: unknown) =>
        v == null
          ? '尚未发生'
          : `${Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${yuan ? '元' : '万元'}`,
    },
    legend: { top: 0, right: 10, textStyle: { color: '#a8bcd6' } },
    grid: { left: 15, right: 40, top: 70, bottom: 15, containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      boundaryGap: false,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#34506d' } },
      axisLabel: { color: '#a8bcd6', fontSize: 13, lineHeight: 24, interval: 0 },
    },
    yAxis: {
      type: 'value',
      name: yuan ? '元' : '万元',
      nameTextStyle: { color: '#a8bcd6' },
      axisLabel: { color: '#a8bcd6' },
      splitLine: { lineStyle: { color: '#20344b' } },
      scale: false,
    },
    series: [series(current, false), ...(previous ? [series(previous, true)] : [])],
  } as EChartsCoreOption
}

export function aggregateGoals(
  analysis: SupplyDashboardOperatingAnalysis | null | undefined,
  month: number | null,
) {
  const rows = analysis?.cityMonthlyGoals?.filter((row) => month == null || row.month === month)
  if (!rows?.length) return null
  const cities = new Map<string, { code: string; name: string; sales: number; receipt: number }>()
  const totals = { sales: 0, receipt: 0, newCustomer: 0, repeatCustomer: 0, configuredCount: 0 }
  for (const row of rows) {
    totals.sales += row.salesTarget
    totals.receipt += row.receiptTarget
    totals.newCustomer += row.newCustomerTarget
    totals.repeatCustomer += row.repeatCustomerTarget
    totals.configuredCount += row.configuredCount
    const city = cities.get(row.regionCode) || {
      code: row.regionCode,
      name: row.regionName,
      sales: 0,
      receipt: 0,
    }
    city.sales += row.salesTarget
    city.receipt += row.receiptTarget
    cities.set(row.regionCode, city)
  }
  return { ...totals, cities, cityCount: cities.size }
}

// Completion colour changes continuously at 25 / 50 / 75 / 100 percent.
// Each arc/bar uses a subtle same-hue gradient, not a full rainbow at low completion.
export function completionGradient(completion: number | null) {
  const value = Math.max(0, Math.min(100, completion ?? 0))
  const stops = [
    { at: 0, rgb: [255, 91, 105] },
    { at: 25, rgb: [255, 91, 105] },
    { at: 50, rgb: [255, 168, 75] },
    { at: 75, rgb: [246, 214, 90] },
    { at: 100, rgb: [67, 224, 154] },
  ]
  const upper = stops.findIndex((stop) => stop.at >= value)
  const from = stops[Math.max(0, upper - 1)]!
  const to = stops[upper]!
  const fraction = to.at === from.at ? 0 : (value - from.at) / (to.at - from.at)
  const rgb = from.rgb.map((part, i) => Math.round(part + (to.rgb[i]! - part) * fraction))
  const end = `rgb(${rgb.join(', ')})`
  const start = `rgb(${rgb.map((part) => Math.round(part * 0.72)).join(', ')})`
  return {
    end,
    css: `linear-gradient(90deg, ${start}, ${end})`,
    chart: {
      type: 'linear' as const,
      x: 0,
      y: 1,
      x2: 1,
      y2: 0,
      colorStops: [
        { offset: 0, color: start },
        { offset: 1, color: end },
      ],
    },
  }
}

export function targetGauge(
  actual: number | null,
  target: number | null,
  width = 10,
): EChartsCoreOption {
  const completion = rate(actual, target)
  return {
    animation: false,
    series: [
      {
        type: 'gauge',
        startAngle: 220,
        endAngle: -40,
        center: ['50%', '57%'],
        radius: '92%',
        min: 0,
        max: 100,
        pointer: { show: false },
        progress: {
          show: true,
          roundCap: true,
          width,
          itemStyle: { color: completionGradient(completion).chart },
        },
        axisLine: { roundCap: true, lineStyle: { width, color: [[1, '#29465a']] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        title: { show: false },
        detail: {
          offsetCenter: [0, '4%'],
          fontSize: 27,
          fontWeight: 700,
          color: '#eaf3ff',
          formatter: () => percentage(completion),
        },
        data: [{ value: Math.max(0, Math.min(100, completion ?? 0)) }],
        silent: true,
      },
    ],
  }
}

// Cohort collection uses cumulative receipts for selected orders, never period cash inflow.
export function collectionDonut(data: SupplyDashboardOverview | null): EChartsCoreOption {
  const paid = meetingMetric(data, 'paid_amount')
  const sales = meetingMetric(data, 'sales_amount')
  const completion = rate(paid, sales)
  const filled = Math.max(0, Math.min(100, completion ?? 0))
  return {
    animation: false,
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '40%',
        style: { text: percentage(completion), fill: '#eaf3ff', fontSize: 34, fontWeight: 700 },
      },
      {
        type: 'text',
        left: 'center',
        top: '62%',
        style: {
          text: completion == null ? '暂无可计算数据' : '订单已回款',
          fill: '#9eb4cc',
          fontSize: 12,
        },
      },
    ],
    series: [
      {
        type: 'pie',
        radius: ['72%', '88%'],
        center: ['50%', '51%'],
        startAngle: 90,
        silent: true,
        label: { show: false },
        data: [
          {
            value: filled,
            name: '已回款',
            itemStyle: { color: completionGradient(completion).chart, borderRadius: 6 },
          },
          { value: 100 - filled, name: '未回款', itemStyle: { color: '#29465a' } },
        ],
      },
    ],
  }
}
