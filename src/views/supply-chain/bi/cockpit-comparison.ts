import type { BiComparison, BiComparisonValues } from '@/api/core/bi-comparison'
import type { Figure } from './cockpit-model'
import { amount, exactAmount, waterfall, type PlotRow } from './cockpit-charts'

export const comparisonSections = [
  'overview',
  'sales',
  'sales-collection',
  'city-operating',
  'payment-risk',
]
export function comparisonLabel(data: BiComparison | undefined, label: string): string {
  if (!data) return ''
  const field = ({ 销售额: 'salesAmount', 回款额: 'paidAmount', 待回款: 'unpaidAmount' } as const)[
    label as '销售额'
  ]
  if (!field) return ''
  const current = Number(data.current[field]),
    previous = Number(data.previous[field])
  if (![current, previous].every(Number.isFinite)) return ''
  if (!data.previous.orderCount) return '前期无订单'
  if (previous === 0) return current === 0 ? '较前期持平' : `较前期增加 ${amount(current)}`
  const change = ((current - previous) / Math.abs(previous)) * 100
  return `较前期 ${change > 0 ? '+' : ''}${change.toFixed(2)}%`
}
export function growthFigure(data: BiComparison): Figure {
  const cities = [...data.cities].sort(
    (a, b) =>
      Math.abs(b.current.salesAmount - b.previous.salesAmount) -
      Math.abs(a.current.salesAmount - a.previous.salesAmount),
  )
  const lead = cities.slice(0, 6)
  const remainder = cities.slice(6)
  const plot: PlotRow[] = [
    { key: 'previous', name: '前期销售', values: [data.previous.salesAmount] },
    ...lead.map((city) => ({
      key: city.regionCode,
      name: city.regionName,
      values: [city.current.salesAmount - city.previous.salesAmount],
    })),
  ]
  if (remainder.length)
    plot.push({
      key: 'other',
      name: '其他城市',
      values: [
        remainder.reduce(
          (sum, city) => sum + city.current.salesAmount - city.previous.salesAmount,
          0,
        ),
      ],
    })
  plot.push({ key: 'current', name: '本期销售', values: [data.current.salesAmount] })
  const cells = (current: BiComparisonValues, previous: BiComparisonValues) => ({
    本期销售额: exactAmount(current.salesAmount),
    前期销售额: exactAmount(previous.salesAmount),
    增减金额: exactAmount(current.salesAmount - previous.salesAmount),
    本期累计回款: exactAmount(current.paidAmount),
    本期待回款: exactAmount(current.unpaidAmount),
  })
  return {
    id: 'sales-growth',
    title: '销售增减来源',
    span: 12,
    option: waterfall(plot),
    height: 300,
    empty: data.current.orderCount || data.previous.orderCount ? undefined : '两个期间均无订单',
    note: `前期 ${data.previousFrom.slice(0, 10)} 至 ${data.previousTo.slice(0, 10)}；相邻等长订单期间，回款均累计至当前快照。`,
    rows: [
      {
        key: 'previous',
        name: '前期合计',
        cells: {
          销售额: exactAmount(data.previous.salesAmount),
          订单数: String(data.previous.orderCount),
        },
      },
      ...cities.map((city) => ({
        key: city.regionCode,
        code: city.regionCode,
        regionCode: city.regionCode,
        name: city.regionName,
        kind: 'city' as const,
        cells: cells(city.current, city.previous),
      })),
      {
        key: 'current',
        name: '本期合计',
        cells: {
          销售额: exactAmount(data.current.salesAmount),
          订单数: String(data.current.orderCount),
        },
      },
    ],
  }
}
