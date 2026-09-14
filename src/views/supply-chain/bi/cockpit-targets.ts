import type { SupplyDashboardTargetCompletionItem } from '@/api/core/bi'
import type { Figure } from './cockpit-model'
import { exactAmount, heatmap, percent, ratio } from './cockpit-charts'

const metricNames: Record<string, string> = {
  SALES_AMOUNT: '销售额',
  PAID_AMOUNT: '回款额',
  CONTACTED_CUSTOMER: '建联客户',
  COOPERATED_CUSTOMER: '合作客户',
}

export function targetCompletionFigure(
  source: SupplyDashboardTargetCompletionItem[],
  city: boolean,
  span: Figure['span'],
): Figure {
  const metrics = [...new Set(source.map((row) => row.metricCode.toUpperCase()))]
  const people = new Map<
    string,
    {
      name: string
      metrics: Map<
        string,
        {
          actual: number | null
          target: number
          partial: boolean
          coverage?: string
        }
      >
    }
  >()
  for (const row of source) {
    const person = people.get(row.dimensionCode) || { name: row.dimensionName, metrics: new Map() }
    const code = row.metricCode.toUpperCase()
    const values = person.metrics.get(code) || { actual: null, target: 0, partial: false }
    if (Number.isFinite(row.actualValue)) values.actual = (values.actual ?? 0) + row.actualValue
    if (Number.isFinite(row.targetValue) && row.targetValue > 0) values.target += row.targetValue
    if (row.configuredMonthCount != null && row.periodMonthCount != null) {
      values.partial ||= row.configuredMonthCount < row.periodMonthCount
      values.coverage = `${row.configuredMonthCount}/${row.periodMonthCount}个月`
    }
    person.metrics.set(code, values)
    people.set(row.dimensionCode, person)
  }
  const names = metrics.map(
    (code) =>
      metricNames[code] ||
      source.find((row) => row.metricCode.toUpperCase() === code)?.metricName ||
      code,
  )
  const plot = [...people].map(([key, person]) => ({
    key,
    name: person.name,
    values: metrics.map((code) => {
      const value = person.metrics.get(code)
      return value?.actual != null ? ratio(value.actual, value.target) : null
    }),
  }))
  const configured = plot.some((row) => row.values.some((value) => value != null))
  const partial = [...people.values()].some((person) =>
    [...person.metrics.values()].some((value) => value.partial),
  )
  const option = heatmap(plot, names, {
    missingLabel: '未配置',
    cellKey: (row, x) => JSON.stringify([row.key, metrics[x]]),
  })
  const cell = (raw: unknown) => {
    const point = (raw as { data: { value: number[] } }).data.value
    const person = people.get(plot[point[1]]?.key)
    return { point, person, value: person?.metrics.get(metrics[point[0]]) }
  }
  option.tooltip = {
    trigger: 'item',
    confine: true,
    renderMode: 'richText',
    formatter: (raw: unknown) => {
      const { point, person, value } = cell(raw)
      const rate = value?.actual == null ? null : ratio(value.actual, value.target)
      const coverage = value?.coverage
        ? `\n目标覆盖 ${value.coverage}${value.partial ? '，部分月份未配置' : ''}`
        : ''
      return `${person?.name || ''}\n${names[point[0]]} ${value?.target ? percent(rate) : '未配置'}${coverage}`
    },
  }
  const series = option.series as { label: { formatter: (raw: unknown) => string } }[]
  series[0].label.formatter = (raw) => {
    const { point, value } = cell(raw)
    return `${percent(point[2])}${value?.partial ? '*' : ''}`
  }
  return {
    id: 'targets',
    title: city ? '城市目标达成与缺口' : '销售目标达成与缺口',
    span: configured ? 12 : span,
    compact: !configured,
    height: Math.max(210, Math.min(plot.length, 8) * 30 + 85),
    option,
    rows: [...people].flatMap(([code, person]) =>
      metrics.flatMap((metric, i) => {
        const value = person.metrics.get(metric)
        if (!value) return []
        const format = metric.endsWith('_AMOUNT')
          ? exactAmount
          : (number: number | null) =>
              number == null ? '—' : number.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
        return [
          {
            key: JSON.stringify([code, metric]),
            groupKey: code,
            name: person.name,
            kind: 'target' as const,
            code,
            regionCode: city ? code : undefined,
            ownerStaffCode: city ? undefined : code,
            cells: {
              指标: names[i],
              实际: format(value.actual),
              目标: value.target > 0 ? format(value.target) : '未配置',
              达成率: percent(value.actual == null ? null : ratio(value.actual, value.target)),
              目标覆盖: value.coverage
                ? `${value.coverage}${value.partial ? ' · 部分月份未配置' : ''}`
                : '未提供月份覆盖',
              统计口径:
                metric === 'CONTACTED_CUSTOMER'
                  ? '当前有效建联客户存量，仅单月比较'
                  : metric === 'COOPERATED_CUSTOMER'
                    ? '已配置月份内去重下单客户'
                    : metric === 'PAID_AMOUNT'
                      ? '已配置月份内订单的累计回款'
                      : '已配置月份内订单销售额',
              缺口:
                value.target > 0
                  ? value.actual == null
                    ? '—'
                    : format(Math.max(0, value.target - value.actual))
                  : '未配置',
            },
          },
        ]
      }),
    ),
    empty: '当前期间尚无目标配置',
    emptyAction: 'target',
    note: configured
      ? `达成率按已配置月份计算${partial ? '；* 部分月份未配置' : ''}；建联为当前存量，合作为期间去重下单客户`
      : undefined,
  }
}
