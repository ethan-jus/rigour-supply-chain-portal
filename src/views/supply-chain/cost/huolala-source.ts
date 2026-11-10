import type { LalamoveOrder } from './lalamove-import'
export type Amount = string | number | null
export interface Facts {
  connectorId: string
  sourceEmployeeName: string | null
  mappedEmployeeCode: string | null
  billAmount: Amount
  unpaidAmount: Amount
  refundAmount: Amount
  couponAmount: Amount
  billState: string
  issue: string | null
  stops: { name: string; address: string; contactName: string; contactPhone: string }[]
  fees: { name: string; amount: Amount }[]
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
  sourceDifference?: boolean
  verification?: { amount: Amount; reason: string; actor?: string; verifiedAt?: string } | null
}
export const currentSource = (r: ImportRow): SourceOrder => r.latestOrder || r.order
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
