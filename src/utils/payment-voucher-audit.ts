import type { AuditGroup } from '@/api/core/payment-voucher-audit'
import { displayDateTime } from './business-date'
export const auditResultLabels: Record<string, string> = { EXCESS: '疑似重复计入', AMOUNT_MISMATCH: '回款与凭证不符', CONFLICT: '凭证金额冲突', IMAGE_REUSE: '同图复用待核', PENDING_ALLOCATION: '待核分配', MISSING_EVIDENCE: '缺少可核凭证', UNALLOCATED: '尚有未分配金额', BALANCED: '金额相符' }
export const auditConclusionLabels: Record<string, string> = { NORMAL_COMBINED: '正常合并付款', CONFIRMED_DUPLICATE: '确认重复计入', NEED_EVIDENCE: '待补凭证' }
export function filterAuditGroups(groups: AuditGroup[], filters: { result: string; keyword: string; salesperson: string; customer: string; dates: string[]; review: string }) {
  return groups.filter(g => {
    if (filters.result === 'ATTENTION' ? g.result === 'BALANCED' : filters.result && filters.result !== g.result) return false
    if (filters.review === 'PENDING' && g.reviews.length && !g.reviewStale) return false
    if (filters.review === 'STALE' && !g.reviewStale) return false
    if (filters.keyword && ![g.transactionNo, ...g.payments.flatMap(p => [p.paymentNo, p.orderNo])].some(s => s?.includes(filters.keyword.trim()))) return false
    // 先聚合所有月份，再选出含符合条件回款的组；不截断金额。
    return g.payments.some(p => (!filters.salesperson || p.salesperson?.includes(filters.salesperson)) && (!filters.customer || p.customer?.includes(filters.customer)) && (!filters.dates.length || (!!p.time && displayDateTime(p.time).slice(0, 10) >= filters.dates[0] && displayDateTime(p.time).slice(0, 10) <= filters.dates[1])))
  })
}
