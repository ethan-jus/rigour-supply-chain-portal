import type {
  CityProductReportRow,
  CityProductReportQuery,
  CityProductReportView,
  CityProductSupplyView,
} from '@/api/core/bi-city-product-report'
import { decimalSum } from './city-product-export'
import { businessDate } from './business-report'
import { reportMoneyText, reportUnitName } from './report-format'

export type ProductMetric = 'salesAmount' | 'paidAmount' | 'quantity'

export function investigationMoney(value: string | number | null) {
  if (value == null) return '未提供'
  return Math.abs(Number(value)) >= 10000
    ? `¥${reportMoneyText(Number(value) / 10000)}万`
    : `¥${reportMoneyText(value)}`
}

export function productMatrix(
  report: CityProductReportView,
  options: { unitCode?: string; offset?: number; limit?: number; metric?: ProductMetric } = {},
) {
  const groups = new Map<string, { label: string; sales: number; rows: CityProductReportRow[] }>()
  for (const row of report.rows) {
    if (options.unitCode && row.unitCode !== options.unitCode) continue
    const key = JSON.stringify([row.productId, row.skuId, row.unitCode, row.brandId])
    const group = groups.get(key) ?? {
      label: [
        row.productName || '商品名称待核对',
        row.specification,
        row.brandName,
        reportUnitName(row.unitCode),
      ]
        .filter(Boolean)
        .join(' · '),
      sales: 0,
      rows: [],
    }
    group.rows.push(row)
    group.sales += Number(row.salesAmount ?? 0)
    groups.set(key, group)
  }
  const ordered = [...groups.values()].sort((a, b) => b.sales - a.sales)
  const offset = options.offset ?? 0
  const limit = options.limit ?? 20
  const products = ordered.slice(offset, offset + limit)
  const cities = [
    ...new Map(
      report.rows.map((row) => [row.regionCode, row.regionName || '城市待核对']),
    ).entries(),
  ]
  const points = products.flatMap((product, x) =>
    cities.flatMap(([city], y) => {
      const rows = product.rows.filter((row) => row.regionCode === city)
      if (!rows.length) return []
      return [
        {
          x,
          y,
          row: rows[0]!,
          salesAmount: rows.some((row) => row.salesAmount == null)
            ? null
            : decimalSum(rows.map((row) => row.salesAmount)),
          quantity: rows.some((row) => row.quantity == null)
            ? null
            : decimalSum(rows.map((row) => row.quantity)),
          paidAmount: rows.every((row) => row.paidAmount == null)
            ? null
            : decimalSum(rows.map((row) => row.paidAmount)),
          incomplete: rows.some((row) => row.unallocatedOrderCount > 0 || row.paidAmount == null),
        },
      ]
    }),
  )
  return { products, cities, points, total: groups.size, limited: groups.size > limit }
}

function monthsInRange(start: string, end: string) {
  const from = businessDate(start).slice(0, 7)
  const to = businessDate(end).slice(0, 7)
  const months: string[] = []
  for (let cursor = from; cursor <= to && months.length < 1200;) {
    months.push(cursor)
    const [year, month] = cursor.split('-').map(Number)
    cursor = month === 12 ? `${year! + 1}-01` : `${year}-${String(month! + 1).padStart(2, '0')}`
  }
  return months
}

/** Absent months are gaps, not zero trading or zero collections. */
export function productMonthlyTrend(report: CityProductReportView, unitCode?: string) {
  return monthsInRange(report.from, report.to).map((month) => {
    const rows = (report.monthlyRows ?? [])
      .filter((row) => row.month === month && (!unitCode || row.metrics.unitCode === unitCode))
      .map((row) => row.metrics)
    const completeSum = (key: 'salesAmount' | 'quantity') =>
      !rows.length || rows.some((row) => row[key] == null)
        ? null
        : decimalSum(rows.map((row) => row[key]))
    return {
      month,
      salesAmount: completeSum('salesAmount'),
      paidAmount: decimalSum(rows.map((row) => row.paidAmount)),
      quantity: completeSum('quantity'),
      incomplete: rows.some((row) => row.paidAmount == null || row.unallocatedOrderCount > 0),
    }
  })
}

export interface SupplyEvidence {
  query: CityProductReportQuery
  warehouseId: string
  warehouseName: string
  snapshot: CityProductSupplyView | null
  loading: boolean
  error: string
}

export function supplyEvidenceBlockedReason(
  evidence: SupplyEvidence,
  query: CityProductReportQuery,
) {
  if (!evidence.warehouseId) return '未选择供货仓库'
  if (evidence.loading) return '库存与采购仍在查询，请等待核查完成'
  if (evidence.error) return evidence.error
  if (!evidence.snapshot) return '供货核查尚未完成'
  if (evidence.snapshot.truncated) return '供货核查结果未完整，不能作为报批附件'
  for (const key of ['from', 'to', 'productId', 'skuId'] as const)
    if (String(query[key] ?? '') !== String(evidence.query[key] ?? ''))
      return '供货核查范围已变化，请重新核查'
  const snapshot = evidence.snapshot
  if (
    new Date(snapshot.from).getTime() !== new Date(query.from!).getTime() ||
    new Date(snapshot.to).getTime() !== new Date(query.to!).getTime()
  )
    return '供货核查期间与报表不一致'
  if (
    snapshot.stocks.some(
      (row) =>
        row.warehouseId !== evidence.warehouseId ||
        row.productId !== String(query.productId) ||
        (query.skuId && row.skuId !== String(query.skuId)),
    ) ||
    snapshot.operations.some(
      (row) =>
        row.productId !== String(query.productId) ||
        (query.skuId && row.skuId !== String(query.skuId)),
    )
  )
    return '供货核查返回了范围外数据，请重新核查'
  return ''
}

/** 只标识可以直接比较的相同ERP主键和原始单位，不将起订量解释为箱桶换算。 */
export function supplyComparability(
  stock: CityProductSupplyView['stocks'][number],
  sales: CityProductReportRow[],
) {
  if (!stock.skuId || !stock.unitCode || ['UNKNOWN', 'MULTI'].includes(stock.unitCode))
    return 'MISSING_MAPPING'
  const matchingSku = sales.filter(
    (row) => row.productId === stock.productId && row.skuId === stock.skuId,
  )
  if (!matchingSku.length) return 'NO_SALES'
  return matchingSku.every((row) => row.unitCode === stock.unitCode) ? 'SAME_UNIT' : 'UNIT_MISMATCH'
}

export function supplyOperationsForUnit(
  data: CityProductSupplyView,
  skuId: string,
  unitCode: string,
) {
  if (!skuId || !unitCode || ['UNKNOWN', 'MULTI'].includes(unitCode)) return []
  const rows = data.operations.filter((row) => row.skuId === skuId && row.unitCode === unitCode)
  if (!rows.length || !data.from || !data.to) return rows
  return monthsInRange(data.from, data.to).map(
    (month) =>
      rows.find((row) => row.month === month) ?? {
        productId: rows[0]!.productId,
        skuId,
        unitCode,
        month,
        procurementQuantity: null,
        shippedQuantity: null,
        syncedAt: null,
      },
  )
}
