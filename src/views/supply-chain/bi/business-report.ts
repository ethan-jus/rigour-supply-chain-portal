import type {
  CityProductReportView,
  CityProductReportRow,
  ReportDecimal,
} from '@/api/core/bi-city-product-report'
import { decimalSum, reportCellText, type ReportLabels } from './city-product-export'
import { reportDecimalText, reportQuantityText, reportUnitName } from './report-format'
import { businessMonth } from '@/utils/business-date'
export { businessMonth, businessDate } from '@/utils/business-date'

export type BusinessReportKind = 'operating' | 'monthly'
export interface BusinessColumn {
  key: string
  label: string
  type?: 'money' | 'quantity' | 'count' | 'percent'
  group?: string
}
export interface BusinessRow {
  kind: 'detail' | 'subtotal' | 'total'
  values: Record<string, string | number | null>
}
export interface BusinessTable {
  title: string
  columns: BusinessColumn[]
  rows: BusinessRow[]
  notes: string[]
}
export const businessReportNames: Record<BusinessReportKind, string> = {
  operating: '城市经营汇总',
  monthly: '城市单品月报',
}

function monthsInReport(report: CityProductReportView) {
  const first = businessMonth(report.from)
  const last = businessMonth(report.to)
  const result: string[] = []
  let cursor = first
  while (cursor <= last) {
    if (result.length >= 120) throw new Error('月度报表最多支持120个月，请缩小日期范围')
    result.push(cursor)
    const [year, month] = cursor.split('-').map(Number)
    cursor = `${month === 12 ? year! + 1 : year}-${String(month === 12 ? 1 : month! + 1).padStart(2, '0')}`
  }
  return result
}

const rowIdentity = (row: CityProductReportRow) =>
  JSON.stringify([
    row.regionCode,
    row.categoryId ?? row.categoryCode ?? row.categoryName,
    row.productId ?? row.productCode ?? row.productName,
    row.skuId ?? row.skuCode,
    row.unitCode,
    row.brandId ?? row.brandName,
  ])
const cityName = (row: CityProductReportRow, labels: ReportLabels) =>
  reportCellText(row, { key: 'regionName', label: '' }, labels)
const categoryName = (row: CityProductReportRow, labels: ReportLabels) =>
  reportCellText(row, { key: 'categoryName', label: '' }, labels)
const categoryIdentity = (row: CityProductReportRow) =>
  row.categoryId ?? row.categoryCode ?? row.categoryName ?? ''
const knownSum = (values: ReportDecimal[]) => decimalSum(values)
function sumAll(values: ReportDecimal[]) {
  return values.some((v) => v == null) ? null : (decimalSum(values) ?? '0')
}

function quantities(rows: CityProductReportRow[]) {
  const groups = new Map<string | null, ReportDecimal[]>()
  for (const row of rows)
    for (const item of row.quantities) {
      const values = groups.get(item.unitCode) ?? []
      values.push(item.quantity)
      groups.set(item.unitCode, values)
    }
  return (
    [...groups]
      .map(
        ([unit, values]) =>
          `${reportQuantityText(sumAll(values)) || '未提供'} ${reportUnitName(unit)}`,
      )
      .join('；') || '0'
  )
}

function negate(value: ReportDecimal) {
  const text = reportDecimalText(value)
  return text.startsWith('-') ? text.slice(1) : `-${text}`
}

export function operatingTable(
  report: CityProductReportView,
  labels: ReportLabels,
  categoryFiltered: boolean,
): BusinessTable {
  const categories = new Map<string, string>()
  for (const row of report.categoryRows)
    categories.set(categoryIdentity(row), categoryName(row, labels))
  const columns: BusinessColumn[] = [
    { key: 'city', label: '城市' },
    { key: 'sales', label: '商品销售额（元）', type: 'money' },
    { key: 'receivable', label: '已归属应收额（元）', type: 'money' },
    { key: 'paid', label: '已归属回款额（元）', type: 'money' },
    { key: 'allocated', label: '其中分摊回款（元）', type: 'money' },
    ...(!categoryFiltered
      ? [
          { key: 'orderAmount', label: '订单应收（元）', type: 'money' as const },
          { key: 'difference', label: '商品金额与订单应收差额（元）', type: 'money' as const },
          { key: 'orderPaid', label: '订单累计回款（元）', type: 'money' as const },
          { key: 'unpaid', label: '订单待回款（元）', type: 'money' as const },
          { key: 'rate', label: '订单回款率', type: 'percent' as const },
        ]
      : []),
    ...[...categories].map(([id, name]) => ({
      key: `category:${id}`,
      label: `${name}销售额（元）`,
      type: 'money' as const,
    })),
    { key: 'quantities', label: '订货数量（分单位，未扣退货）' },
    { key: 'orders', label: '本期订单数', type: 'count' },
    { key: 'customers', label: '本期下单客户数', type: 'count' },
    { key: 'archives', label: '当前客户档案数', type: 'count' },
    { key: 'pending', label: '待核对订单数', type: 'count' },
  ]
  const cities = new Set<string | null>([
    ...report.orderTrace.map((row) => row.regionCode),
    ...(report.customerArchives?.map((row) => row.regionCode) ?? []),
  ])
  function aggregate(city: string | null | undefined): BusinessRow {
    const items = report.categoryRows.filter((row) => city === undefined || row.regionCode === city)
    const orders = report.orderTrace.filter((row) => city === undefined || row.regionCode === city)
    const archives = report.customerArchives?.filter(
      (row) => city === undefined || row.regionCode === city,
    )
    const sales = sumAll(items.map((row) => row.salesAmount))
    const orderAmount = sumAll(orders.map((row) => row.total))
    const paid = sumAll(orders.map((row) => row.paid))
    const values: BusinessRow['values'] = {
      city:
        city === undefined
          ? '合计（当前筛选范围）'
          : items[0]
            ? cityName(items[0], labels)
            : orders[0]?.regionName || archives?.[0]?.regionName || '未归属城市',
      sales,
      receivable: items.length ? knownSum(items.map((row) => row.receivableAmount)) : '0',
      paid: items.length ? knownSum(items.map((row) => row.paidAmount)) : '0',
      allocated: knownSum(items.map((row) => row.allocatedPaidAmount)),
      orderAmount,
      orderPaid: paid,
      unpaid: sumAll(orders.map((row) => row.unpaid)),
      difference:
        sales == null || orderAmount == null ? null : decimalSum([sales, negate(orderAmount)]),
      rate:
        orderAmount == null || Number(orderAmount) === 0 || paid == null
          ? null
          : Number(paid) / Number(orderAmount),
      quantities: quantities(items),
      orders: orders.length,
      customers: new Set(orders.map((row) => row.customerId).filter(Boolean)).size,
      archives: archives == null ? null : archives.reduce((sum, row) => sum + row.customerCount, 0),
      pending: orders.filter((row) => !['EXACT', 'PROPORTIONAL'].includes(row.categoryStatus || ''))
        .length,
    }
    for (const [id] of categories)
      values[`category:${id}`] = sumAll(
        items.filter((row) => categoryIdentity(row) === id).map((row) => row.salesAmount),
      )
    return { kind: city === undefined ? 'total' : 'detail', values }
  }
  return {
    title: businessReportNames.operating,
    columns,
    rows: [...cities]
      .map(aggregate)
      .sort((a, b) => Number(b.values.sales) - Number(a.values.sales))
      .concat(aggregate(undefined)),
    notes: [
      '客户档案数为当前未删除档案，按城市、销售和客户类型筛选，不受订单日期、商品分类及订单来源影响；不等于本期下单客户。跨城市下单客户在合计中再次去重。',
      '品类来自系统ERP分类；未分类保留待核对，不按商品名字猜分类。数量保留原始单位，未自动折箱。',
      categoryFiltered
        ? '当前按商品维度筛选，金额仅限选中分类、品牌、商品或SKU；不将涉及订单的整单回款冒充选中商品回款。'
        : '订单应收、累计回款每单只计一次。商品金额与订单应收差额可能含整单优惠、费用或源数据差异，不直接认定为损失。',
      '已归属回款含分摊部分，不可与其中分摊回款相加；待核对订单存在时，已归属金额不代表全部回款。',
    ],
  }
}

export function monthlyTable(report: CityProductReportView, labels: ReportLabels): BusinessTable {
  if (!Array.isArray(report.monthlyRows))
    throw new Error('月度报表接口尚未更新，请更新BI服务后重新查询；现有明细报表仍可导出')
  const months = monthsInReport(report)
  const metrics: BusinessColumn[] = [
    { key: 'quantity', label: '订货数量', type: 'quantity' },
    { key: 'salesAmount', label: '销售额（元）', type: 'money' },
    { key: 'paidAmount', label: '已归属回款（元）', type: 'money' },
    { key: 'allocatedPaidAmount', label: '其中分摊回款（元）', type: 'money' },
    { key: 'status', label: '回款核对状态' },
  ]
  const periods = [...months, '合计']
  const columns: BusinessColumn[] = [
    { key: 'city', label: '城市' },
    { key: 'product', label: '商品' },
    { key: 'brand', label: '品牌' },
    { key: 'category', label: '分类' },
    { key: 'specification', label: '规格' },
    { key: 'unit', label: '单位' },
    ...periods.flatMap((period) =>
      metrics.map((column) => ({ ...column, key: `${period}:${column.key}`, group: period })),
    ),
  ]
  const monthly = new Map<string, CityProductReportRow[]>()
  for (const row of report.monthlyRows) {
    if (!months.includes(row.month) || row.metrics.sample)
      throw new Error('月度数据超出所选范围或包含样例，不能导出')
    const key = `${row.month}:${rowIdentity(row.metrics)}`
    if (monthly.has(key)) throw new Error('月度商品数据重复，请重新查询')
    monthly.set(key, [row.metrics])
  }
  // Missing monthly groups must never silently become zero when a deployment returns incomplete data.
  const keys = new Set(report.rows.map(rowIdentity))
  if (report.monthlyRows.some((row) => !keys.has(rowIdentity(row.metrics))))
    throw new Error('月度商品与汇总商品不一致')
  for (const row of report.rows) {
    const parts = report.monthlyRows
      .filter((part) => rowIdentity(part.metrics) === rowIdentity(row))
      .map((part) => part.metrics)
    for (const field of ['quantity', 'salesAmount', 'paidAmount', 'allocatedPaidAmount'] as const) {
      const actual = knownSum(parts.map((part) => part[field]))
      if (
        !parts.length ||
        (actual == null) !== (row[field] == null) ||
        (actual != null && reportQuantityText(actual) !== reportQuantityText(row[field]))
      )
        throw new Error('月度数据与汇总不一致，请重新查询')
    }
  }
  function aggregate(
    items: CityProductReportRow[],
    city: string,
    kind: BusinessRow['kind'],
  ): BusinessRow {
    const first = items[0]!
    const values: BusinessRow['values'] = {
      city,
      product:
        kind === 'detail'
          ? first.productName || '未提供商品名称'
          : kind === 'total'
            ? '全部商品'
            : '城市小计',
      specification: kind === 'detail' ? first.specification || '' : '',
      brand: kind === 'detail' ? first.brandName || '品牌待核对' : '',
      category: kind === 'detail' ? categoryName(first, labels) : '',
      unit: kind === 'detail' ? reportUnitName(first.unitCode) : '分单位',
    }
    for (const period of periods) {
      const parts =
        period === '合计'
          ? items
          : items.flatMap((item) => monthly.get(`${period}:${rowIdentity(item)}`) ?? [])
      values[`${period}:quantity`] =
        kind === 'detail' ? sumAll(parts.map((row) => row.quantity)) : quantities(parts)
      values[`${period}:salesAmount`] = sumAll(parts.map((row) => row.salesAmount))
      values[`${period}:paidAmount`] = parts.length
        ? knownSum(parts.map((row) => row.paidAmount))
        : '0'
      values[`${period}:allocatedPaidAmount`] = knownSum(
        parts.map((row) => row.allocatedPaidAmount),
      )
      values[`${period}:status`] = !parts.length
        ? '无订单'
        : parts.some((row) => row.unallocatedOrderCount > 0 || row.paidAmount == null)
          ? '待核对'
          : parts.some((row) => row.allocatedPaidAmount != null)
            ? '含分摊回款'
            : '已归属'
    }
    return { kind, values }
  }
  const byCity = new Map<string | null, CityProductReportRow[]>()
  for (const row of report.rows) {
    const items = byCity.get(row.regionCode) ?? []
    items.push(row)
    byCity.set(row.regionCode, items)
  }
  const rows: BusinessRow[] = []
  for (const items of byCity.values()) {
    const name = cityName(items[0]!, labels)
    for (const row of items) rows.push(aggregate([row], name, 'detail'))
    rows.push(aggregate(items, name, 'subtotal'))
  }
  if (report.rows.length) rows.push(aggregate(report.rows, '合计（当前筛选范围）', 'total'))
  return {
    title: businessReportNames.monthly,
    columns,
    rows,
    notes: [
      '月份按北京时间订单日期划分，首末月仅含所选日期范围；回款是这些订单累计回款，不是该月现金入账。',
      '小计、合计按原始精度汇总后金额四舍五入保留两位；不同单位不混加。没有经核验的SKU包装换算时，不把桶直接当箱。',
      '空回款表示未归属，不是零回款；有已归属金额仍可能存在待核对订单。默认不分摊，仅手动选择后采用整单商品金额占比归属。',
    ],
  }
}

export function businessTable(
  report: CityProductReportView,
  kind: BusinessReportKind,
  labels: ReportLabels = {},
  categoryFiltered = false,
) {
  return kind === 'monthly'
    ? monthlyTable(report, labels)
    : operatingTable(report, labels, categoryFiltered)
}
