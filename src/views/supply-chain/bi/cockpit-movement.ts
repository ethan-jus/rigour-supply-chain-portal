import type { SupplyDashboardRankingItem } from '@/api/core/bi'
import type { Figure } from './cockpit-model'
import { exactAmount, lines, numeric } from './cockpit-charts'
import { concreteDimension } from './cockpit-scope'

export function salesMovementFigure(
  current: SupplyDashboardRankingItem[],
  previous: SupplyDashboardRankingItem[],
  field: 'salesAmount' | 'paidAmount',
  previousFrom: string,
  previousTo: string,
): Figure | null {
  if (!previous.length) return null
  const before = new Map(previous.map((row) => [row.dimensionCode, row]))
  const eligible = current.filter(
    (row) => concreteDimension(row.dimensionCode) && before.has(row.dimensionCode),
  )
  const source = [...eligible].sort(
    (a, b) =>
      Math.abs(numeric(b[field]) - numeric(before.get(b.dimensionCode)?.[field])) -
      Math.abs(numeric(a[field]) - numeric(before.get(a.dimensionCode)?.[field])),
  )
  if (!source.length) return null
  const lead = source.slice(0, 6)
  const label = field === 'salesAmount' ? '销售额' : '订单累计回款'
  const plot = ['前期', '本期'].map((period, index) => ({
    key: period,
    name: period,
    seriesKeys: lead.map((row) => row.dimensionCode),
    values: lead.map((row) => (index ? row[field] : before.get(row.dimensionCode)![field])),
  }))
  const option = lines(
    plot,
    lead.map((row) => ({ name: row.dimensionName })),
  )
  return {
    id: 'sales-movement',
    title: `${label}变化 · 销售人员`,
    span: 12,
    height: 290,
    option: {
      ...option,
      series: (option.series as { type: string }[]).map((series) => ({
        ...series,
        areaStyle: undefined,
        symbolSize: 9,
        lineStyle: { width: 2 },
      })),
    },
    rows: source.map((row) => ({
      key: row.dimensionCode,
      code: row.dimensionCode,
      name: row.dimensionName,
      kind: 'sales',
      regionCode: row.regionCode,
      ownerStaffCode: row.dimensionCode,
      cells: {
        城市: row.regionName || '未归属城市',
        [`前期${label}`]: exactAmount(before.get(row.dimensionCode)![field]),
        [`本期${label}`]: exactAmount(row[field]),
        增减金额: exactAmount(row[field] - before.get(row.dimensionCode)![field]),
      },
    })),
    note: `前期 ${previousFrom.slice(0, 10)} 至 ${previousTo.slice(0, 10)}；展示两期均有记录且变动最大的6人，明细保留全部可比人员`,
  }
}
