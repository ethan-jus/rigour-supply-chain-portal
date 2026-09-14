import { businessDateTime } from '@/utils/business-date'
import type {
  CityProductAllocationMode,
  CityProductOrderTrace,
  CityProductReportRow,
  CityProductReportView,
  ReportDecimal,
} from '@/api/core/bi-city-product-report'
import {
  reportDecimalText,
  reportMoneyText,
  reportQuantityText,
  reportUnitName,
  reportSourceName,
} from './report-format'
export { reportDecimalText } from './report-format'

export function cityProductQuantityNotice(
  report: CityProductReportView | null | undefined,
): string {
  return report?.orderTrace.some((order) => order.sourceSystemCode === 'FEISHU')
    ? '包含飞书导入订单，数量沿用系统原记录，交易单位/包装换算尚未核验；不得直接作为订货箱数。'
    : ''
}

export interface ReportLabels {
  categories?: readonly { id: string | number; categoryName: string }[]
  region?: readonly { value: string; label: string }[]
  owner?: readonly { value: string; label: string }[]
  customerType?: readonly { value: string; label: string }[]
  source?: readonly { value: string; label: string }[]
  brand?: readonly { value: string; label: string }[]
  product?: readonly { value: string; label: string }[]
  sku?: readonly { value: string; label: string }[]
}

export function reportOptionLabel(
  options: ReportLabels['region'],
  code: unknown,
  missing = '未提供名称',
) {
  return options?.find((item) => item.value === String(code))?.label || missing
}

const allocationStatusLabels: Record<string, string> = {
  EXACT: '精确归属',
  PROPORTIONAL: '比例分摊',
  PARTIAL: '部分归属',
  UNALLOCATED: '未归属',
  MIXED_ITEMS: '混合商品未分摊',
  UNKNOWN_DIMENSION: '归属信息不完整',
  MISSING_LINES: '缺少商品明细',
  INVALID_LINE: '商品明细不完整',
  REFUND_REVIEW: '退款待核对',
  NEGATIVE_LINE: '负数明细待核对',
  ORDER_BALANCE_REVIEW: '订单收款余额待核对',
  ZERO_DENOMINATOR: '商品金额为零',
  EXTRA_CHARGE_OR_MISSING_LINES: '额外费用或缺少明细待核对',
  LINE_TOTAL_REVIEW: '商品合计待核对',
}

export type CityProductExportKind = 'categoryRows' | 'rows' | 'orderTrace'
export type CityProductDetailRow = CityProductReportRow | CityProductOrderTrace
export interface CityProductColumn {
  key: string
  label: string
  decimal?: boolean
}

export const cityProductExportOptions: { value: CityProductExportKind; label: string }[] = [
  { value: 'categoryRows', label: '城市分类' },
  { value: 'rows', label: '商品SKU单位' },
  { value: 'orderTrace', label: '订单核对' },
]
export const allocationModeLabels: Record<CityProductAllocationMode, string> = {
  EXACT_ONLY: '不分摊（仅精确归属）',
  PROPORTIONAL: '按商品金额比例分摊',
}
export const cityProductMetricDefinitions = [
  '订货数量来源订单行，未扣退货，不是净出库销量；不同单位分别统计。',
  '商品销售额可能未减整单优惠。',
  '扣退款行金额不包含整单优惠，与商品销售额、已归属应收额不是同一指标。',
  '金额按元四舍五入保留两位。汇总先按原始精度计算再舍入，可能与逐行显示金额之和存在分位尾差。',
  '精确归属表示整单唯一归入该分类或商品，不代表商品付款核销；分类可归属不代表每个商品均可归属。',
  '比例分摊先按整单分类金额分配净应收和回款，再分到商品和单位；分类、品牌、商品、SKU筛选均不改变整单分母。',
  '退款额来自订单退款按行分摊快照，不代表商品实际退款；退款、负数、缺行、零金额及收付不平的订单保留待核对，不强行分摊。',
  '整单累计已收等于选中范围已归属、范围外已归属和未归属回款之和；整单金额可能含其他分类，不能当作选中分类金额。',
] as const

const scopeColumns: CityProductColumn[] = [
  { key: 'regionName', label: '城市名称' },
  { key: 'categoryName', label: '分类名称' },
]
const amountColumns: CityProductColumn[] = [
  { key: 'unitCode', label: '原始单位' },
  { key: 'quantity', label: '订货数量（未扣退货）', decimal: true },
  { key: 'quantities', label: '订货数量（分单位，未扣退货）' },
  { key: 'salesAmount', label: '商品销售额（元）', decimal: true },
  { key: 'salesNetAmount', label: '扣退款行金额（元）', decimal: true },
  { key: 'refundAmount', label: '退款额（元）', decimal: true },
  { key: 'receivableAmount', label: '已归属应收额（元）', decimal: true },
  { key: 'paidAmount', label: '已归属回款额（元）', decimal: true },
  { key: 'allocatedPaidAmount', label: '其中分摊回款（元）', decimal: true },
  { key: 'unallocatedOrderCount', label: '待核对订单数', decimal: true },
  { key: 'attributionStatus', label: '回款核对状态' },
  { key: 'allocationStatus', label: '归属状态' },
  { key: 'orderCount', label: '订单数', decimal: true },
  { key: 'customerCount', label: '客户数', decimal: true },
]
const categoryColumnOrder = [
  'regionName',
  'categoryName',
  'quantities',
  'salesAmount',
  'receivableAmount',
  'paidAmount',
  'allocatedPaidAmount',
  'attributionStatus',
  'unallocatedOrderCount',
  'orderCount',
  'customerCount',
]
export const cityProductColumns: Record<CityProductExportKind, readonly CityProductColumn[]> = {
  categoryRows: [
    ...categoryColumnOrder.map((key) =>
      [...scopeColumns, ...amountColumns].find((column) => column.key === key)!,
    ),
  ],
  rows: [
    ...scopeColumns,
    { key: 'productName', label: '商品名称' },
    { key: 'brandName', label: '品牌名称' },
    { key: 'specification', label: '规格' },
    ...amountColumns.filter((column) => column.key !== 'quantities'),
  ],
  orderTrace: [
    { key: 'sourceOrderNo', label: '来源订单号' },
    { key: 'sourceSystemCode', label: '来源系统' },
    { key: 'regionName', label: '城市名称' },
    { key: 'ownerStaffName', label: '责任销售' },
    { key: 'customerName', label: '客户名称' },
    { key: 'orderDate', label: '订单日期（北京时间）' },
    { key: 'lineCount', label: '整单行数', decimal: true },
    { key: 'selectedLineCount', label: '选中行数', decimal: true },
    { key: 'total', label: '整单应收（元）', decimal: true },
    { key: 'lineTotal', label: '整单商品行金额（元）', decimal: true },
    { key: 'selectedLineTotal', label: '选中商品行金额（元）', decimal: true },
    { key: 'orderAdjustmentAmount', label: '订单应收与整单行金额差额（元）', decimal: true },
    { key: 'paid', label: '整单累计已收（元）', decimal: true },
    { key: 'unpaid', label: '整单待回款（元）', decimal: true },
    { key: 'selectedReceivableAmount', label: '选中范围已归属应收额（元）', decimal: true },
    { key: 'selectedPaidAmount', label: '选中范围已归属回款额（元）', decimal: true },
    { key: 'allocatedPaidAmount', label: '其中分摊回款（元）', decimal: true },
    { key: 'excludedPaidAmount', label: '范围外已归属回款（元）', decimal: true },
    { key: 'unallocatedPaidAmount', label: '未归属回款（元）', decimal: true },
    { key: 'status', label: '商品回款归属状态' },
    { key: 'categoryStatus', label: '分类归属状态' },
  ],
}

export function reportCellText(
  row: CityProductDetailRow,
  column: CityProductColumn,
  labels: ReportLabels = {},
): string {
  if (column.key === 'quantities' && 'quantity' in row)
    return rowQuantities(row)
      .map(
        (item) =>
          `${reportUnitName(item.unitCode)}: ${reportQuantityText(item.quantity) || '未提供'}`,
      )
      .join('；')
  if (column.key === 'attributionStatus' && 'unallocatedOrderCount' in row)
    return row.unallocatedOrderCount > 0 || row.paidAmount == null ? '未完整' : '已归属'
  const value = (row as unknown as Record<string, unknown>)[column.key]
  if (column.key === 'unitCode' && 'unitCode' in row) return reportUnitName(row.unitCode)
  if (column.key === 'categoryName' && 'categoryId' in row)
    return (
      labels.categories?.find((item) => String(item.id) === row.categoryId)?.categoryName ||
      row.categoryName ||
      '未分类'
    )
  if (column.key === 'regionName')
    return row.regionName || reportOptionLabel(labels.region, row.regionCode, '未归属城市')
  if (column.key === 'ownerStaffName' && 'ownerStaffCode' in row)
    return (
      row.ownerStaffName ||
      reportOptionLabel(
        labels.owner,
        row.ownerStaffCode,
        row.ownerStaffCode ? '未提供销售姓名' : '未分配',
      )
    )
  if (column.key === 'sourceSystemCode')
    return reportSourceName(
      value == null ? null : String(value),
      reportOptionLabel(labels.source, value, ''),
    )
  if (column.key === 'orderDate') return value == null ? '' : businessDateTime(String(value))
  if (['allocationStatus', 'status', 'categoryStatus'].includes(column.key))
    return value == null ? '' : allocationStatusLabels[String(value)] || '待核对'
  return column.decimal
    ? column.label.includes('（元）')
      ? reportMoneyText(value)
      : reportQuantityText(value)
    : value == null
      ? ''
      : String(value)
}

export function cityProductExportBlockedReason(report: CityProductReportView | null): string {
  if (!report) return '尚未取得报表数据'
  if (report.exportBlocked || report.truncated)
    return '报表超过完整导出范围，请缩小日期或筛选范围后重试'
  if (
    !Array.isArray(report.rows) ||
    !Array.isArray(report.categoryRows) ||
    !Array.isArray(report.orderTrace)
  )
    return '报表明细缺失，请重新查询'
  if (
    report.sample ||
    report.summary?.sample ||
    [...report.rows, ...report.categoryRows, ...report.orderTrace].some((row) => row.sample)
  )
    return '城市商品报表不支持样例数据'
  if (!report.summary) return '报表汇总缺失，请重新查询'
  if (!report.rows.length && !report.categoryRows.length && !report.orderTrace.length)
    return '当前范围没有可导出的数据'
  return ''
}

export function decimalSum(values: ReportDecimal[]): string | null {
  const known = values.filter((value) => value != null).map(reportDecimalText)
  if (!known.length) return null
  const scale = known.reduce(
    (maximum, value) => Math.max(maximum, value.split('.')[1]?.length ?? 0),
    0,
  )
  const total = known.reduce((sum, value) => {
    const negative = value.startsWith('-')
    const [integer, fraction = ''] = value.replace(/^-/, '').split('.')
    const scaled = BigInt(integer + fraction.padEnd(scale, '0'))
    return sum + (negative ? -scaled : scaled)
  }, 0n)
  const digits = (total < 0n ? -total : total).toString().padStart(scale + 1, '0')
  return (
    (total < 0n ? '-' : '') +
    (scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}` : digits)
  )
}

/** Each amount aggregation uses one explicitly selected grain; counts are never summed. */
export function cityProductChartRows(
  report: CityProductReportView,
  kind: 'rows' | 'categoryRows' = 'rows',
) {
  const groups = new Map<string, CityProductReportRow[]>()
  for (const row of report[kind]) {
    const key = row.regionCode ?? ''
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }
  return [...groups].map(([key, rows]) => ({
    key,
    name: rows[0].regionName || key || '未归属城市',
    salesAmount: rows.some((row) => row.salesAmount == null)
      ? null
      : decimalSum(rows.map((row) => row.salesAmount)),
    paidAmount: decimalSum(rows.map((row) => row.paidAmount)),
    incomplete: rows.some((row) => row.unallocatedOrderCount > 0 || row.paidAmount == null),
  }))
}

function rowQuantities(row: CityProductReportRow) {
  return (
    row.quantities ??
    (row.unitCode != null || row.quantity != null
      ? [{ unitCode: row.unitCode, quantity: row.quantity }]
      : [])
  )
}

export function cityProductTotals(report: CityProductReportView, kind: 'rows' | 'categoryRows') {
  const rows = report[kind]
  const quantities = new Map<string | null, ReportDecimal[]>()
  for (const row of rows) {
    for (const item of rowQuantities(row)) {
      const values = quantities.get(item.unitCode) ?? []
      values.push(item.quantity)
      quantities.set(item.unitCode, values)
    }
  }
  return {
    salesAmount: rows.some((row) => row.salesAmount == null)
      ? null
      : decimalSum(rows.map((row) => row.salesAmount)),
    salesNetAmount: rows.some((row) => row.salesNetAmount == null)
      ? null
      : decimalSum(rows.map((row) => row.salesNetAmount)),
    receivableAmount: decimalSum(rows.map((row) => row.receivableAmount)),
    paidAmount:
      kind === 'categoryRows' && report.summary && 'categoryPaidAmount' in report.summary
        ? report.summary.categoryPaidAmount == null
          ? null
          : reportDecimalText(report.summary.categoryPaidAmount)
        : decimalSum(rows.map((row) => row.paidAmount)),
    allocatedPaidAmount: decimalSum(rows.map((row) => row.allocatedPaidAmount)),
    incomplete:
      (kind === 'categoryRows'
        ? (report.summary?.unallocatedCategoryOrderCount ?? 0)
        : (report.summary?.unallocatedOrderCount ?? 0)) > 0 ||
      rows.some((row) => row.unallocatedOrderCount > 0 || row.paidAmount == null),
    quantities: [...quantities].map(([unitCode, values]) => ({
      unitCode,
      quantity: values.some((value) => value == null) ? null : decimalSum(values),
    })),
  }
}
