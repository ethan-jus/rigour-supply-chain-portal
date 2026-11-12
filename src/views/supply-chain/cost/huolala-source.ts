import type { LalamoveOrder } from './lalamove-import'
export type Amount = string | number | null
export interface PlatformVoucher {
  id: string
  name: string
  fileKey?: string | null
  contentType?: string | null
  state: string
  savedAt?: string | null
}
export interface Facts {
  connectorId: string
  sourceEmployeeName: string | null
  sourceStaffId?: string | null
  sourceDepartmentName?: string | null
  mappedEmployeeCode: string | null
  bonusAmount?: Amount
  receipts?: PlatformVoucher[]
  billVouchers?: PlatformVoucher[]
  receiptInfo?: {
    type: number | null
    status: number | null
    backType: number | null
    expressNo: string | null
    remark: string | null
    unableToReturn: number | null
    unableReason: string | null
  } | null
  stopPhotos?: { stopIndex: number; name: string; phase: string; vouchers: PlatformVoucher[] }[]
  completeTime?: string | null
  billUpdatedTime?: string | null
  billAmount: Amount
  unpaidAmount: Amount
  refundAmount: Amount
  couponAmount: Amount
  billState: string
  issue: string | null
  stops: { name: string; address: string; contactName: string; contactPhone: string }[]
  fees: {
    code?: string
    name: string
    amount: Amount
    lineId?: string
    vouchers?: PlatformVoucher[]
  }[]
}
export type SourceOrder = Omit<LalamoveOrder, 'paidAmount'> & {
  paidAmount: Amount
  facts?: Facts | null
}
export interface ImportRow {
  id: string
  fileName: string
  revision: number
  state: string
  costId: string | null
  order: SourceOrder
  latestOrder?: SourceOrder | null
  sourceChannel?: string
  lastSyncedAt?: string | null
  sourceDifference?: boolean
  verification?: { amount: Amount; reason: string; actor?: string; verifiedAt?: string } | null
}
export const currentSource = (r: ImportRow): SourceOrder => r.latestOrder || r.order

/** 企业接口旧 pay_status 已停止维护；付款进度只依据当前平台支付金额，不借用成本确认状态。 */
export function platformPaymentStatus(source: SourceOrder): string {
  const cents = (value: Amount | undefined): number | null => {
    if (value == null || String(value).trim() === '') return null
    const n = Number(value)
    return Number.isFinite(n) && n >= 0 && Number.isSafeInteger(Math.round(n * 100))
      ? Math.round(n * 100)
      : null
  }
  const paid = cents(source.paidAmount)
  const unpaid = cents(source.facts?.unpaidAmount)
  const total = cents(source.facts?.billAmount)
  const refund = cents(source.facts?.refundAmount)
  if (paid == null || unpaid == null || total == null) return '待核对'
  // 有退款不能凭金额推断“退款中/退款成功”，也不能再次扣减账单成本。
  if ((refund != null && refund > 0) || paid + unpaid !== total) return '待核对'
  if (total === 0) return '无需付款'
  if (unpaid === 0) return '已付款'
  return paid > 0 ? '部分付款' : '未付款'
}
export const verifiedSourceAmount = (r: ImportRow): Amount =>
  r.verification?.amount ??
  (r.order.facts
    ? r.order.facts.billState === 'FINAL'
      ? r.order.facts.billAmount
      : null
    : !r.order.raw['支付方式']?.includes('月结') &&
        ['已完成', '司机完成', '已支付'].includes(r.order.status)
      ? r.order.paidAmount
      : null)
export function canGenerateSource(row: ImportRow): boolean {
  if (row.sourceDifference || verifiedSourceAmount(row) === null) return false
  if (row.verification) return true
  if (row.order.facts) return row.order.facts.billState === 'FINAL'
  return (
    !row.order.raw['支付方式']?.includes('月结') &&
    ['已完成', '司机完成', '已支付'].includes(row.order.status)
  )
}

export function sourceReceiverHints(row: ImportRow): string {
  const source = currentSource(row)
  return [
    source.raw['收货人信息'],
    ...(source.facts?.stops.slice(1) || []).flatMap((s) => [
      s.name,
      s.address,
      s.contactName,
      s.contactPhone,
    ]),
  ]
    .filter(Boolean)
    .join(' ')
}

export function deliveryAddressesDiffer(row: ImportRow, businessAddresses: string[]): boolean {
  const normalize = (value: string) => value.replace(/[\s，,。；;\-]/g, '')
  const actual = (currentSource(row).facts?.stops.slice(1) || [])
    .map((s) => normalize(s.address || ''))
    .filter(Boolean)
  const business = businessAddresses.map(normalize).filter(Boolean)
  return (
    actual.length > 0 &&
    business.length > 0 &&
    (actual.some((a) => !business.includes(a)) || business.some((a) => !actual.includes(a)))
  )
}
