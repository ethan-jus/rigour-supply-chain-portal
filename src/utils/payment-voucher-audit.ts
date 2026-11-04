import type { AuditGroup, AuditPayment } from '@/api/core/payment-voucher-audit'
import { displayDateTime } from './business-date'
import { businessDictionaryLabel } from './business-dictionary'
export const auditStatusLabel = (code: string) => businessDictionaryLabel('ORDER', 'PAYMENT_VOUCHER_AUDIT_STATUS', code)
export const auditReasonLabel = (code: string) => businessDictionaryLabel('ORDER', 'PAYMENT_VOUCHER_AUDIT_REASON', code)
export function auditConclusionLabel(code?: string) {
  const normalized = code === 'NORMAL_COMBINED' ? 'NORMAL' : code === 'CONFIRMED_DUPLICATE' ? 'ABNORMAL' : code === 'NEED_EVIDENCE' ? 'PENDING_REVIEW' : code
  return normalized ? auditStatusLabel(normalized) : '—'
}
export function filterAuditGroups(groups: AuditGroup[], filters: { result: string; keyword: string; salesperson: string; customer: string; dates: string[]; review: string; reason?: string; voucherDates?: string[] }) {
  return groups.filter(g => {
    if (filters.result === 'ATTENTION' ? g.auditStatusCode === 'NORMAL' : filters.result && filters.result !== g.auditStatusCode) return false
    if (filters.reason && !g.reasonCodes.includes(filters.reason)) return false
    if (filters.review === 'PENDING' && g.reviews.length && !g.reviewStale) return false
    if (filters.review === 'STALE' && !g.reviewStale) return false
    if (filters.keyword && ![g.transactionNo, ...g.payments.flatMap(p => [p.paymentNo, p.orderNo])].some(s => s?.includes(filters.keyword.trim()))) return false
    // 先聚合所有月份，再选出含符合条件回款的组；不截断金额。
    return g.payments.some(p => (!filters.salesperson || p.salesperson?.includes(filters.salesperson)) && (!filters.customer || p.customer?.includes(filters.customer)) && (!filters.voucherDates?.length || matchedVoucherTimes(g, p).some(e => displayDateTime(e.paidTime).slice(0, 10) >= filters.voucherDates![0] && displayDateTime(e.paidTime).slice(0, 10) <= filters.voucherDates![1])) && (!filters.dates.length || (!!p.time && displayDateTime(p.time).slice(0, 10) >= filters.dates[0] && displayDateTime(p.time).slice(0, 10) <= filters.dates[1])))
  })
}

export function voucherTimeText(value?: string | null, precision?: string | null) {
  const text = displayDateTime(value)
  return precision === 'DAY' ? text.slice(0, 10) : precision === 'MINUTE' ? text.slice(0, 16) : text
}
function imageIdentity(key: string) {
  if (!key.includes('/fund-attachments/') && !key.includes('/voucher-audit-20261009/')) return key
  return key.match(/(?:^|\/)([a-f0-9]{64})\.[a-z0-9]+$/i)?.[1]?.toLowerCase() || key
}
export function matchedVoucherTimes(group: AuditGroup, payment?: AuditPayment) {
  return (payment ? [payment] : group.payments).filter(p => !p.excluded).flatMap(p => p.evidence.filter(e =>
    !!e.paidTime && Number.isFinite(Date.parse(e.paidTime)) && p.attachmentKeys.includes(e.key) &&
    (group.kind === 'TRANSACTION' ? e.transactionNo?.trim().toUpperCase() === group.transactionNo?.trim().toUpperCase()
      : group.kind === 'IMAGE' ? !!group.imageKey && imageIdentity(e.key) === imageIdentity(group.imageKey) : true)))
}
export function voucherTimeLabels(group: AuditGroup) {
  return [...new Set(matchedVoucherTimes(group).map(e => voucherTimeText(e.paidTime, e.paidTimePrecision)))].sort()
}
export function sortVoucherGroups(groups: AuditGroup[], direction: string | null) {
  if (!direction) return groups
  const value = (g: AuditGroup) => {
    const times = matchedVoucherTimes(g).map(e => Date.parse(e.paidTime!))
    return times.length ? (direction === 'ascending' ? Math.min(...times) : Math.max(...times)) : null
  }
  return [...groups].sort((a, b) => {
    const x = value(a), y = value(b)
    if (x === null || y === null) return x === y ? a.key.localeCompare(b.key) : x === null ? 1 : -1
    return (direction === 'ascending' ? x - y : y - x) || a.key.localeCompare(b.key)
  })
}
