import { apiClient } from './client'
import { ORDER_REGISTER_BASE_PATH } from './order-register'
export interface AuditEvidence { key: string; amount: number | null; transactionNo: string | null; note: string | null }
export interface AuditPayment { id: string; paymentNo: string; orderId: string; orderNo: string; customer: string; salesperson: string; amount: number; time: string | null; status: string; excluded: boolean; primaryTransaction: string | null; attachmentKeys: string[]; evidence: AuditEvidence[] }
export interface AuditReview { id: string; fingerprint: string; conclusion: string; note: string; actor: string; time: string; paymentIds: string[] }
export interface AuditGroup { key: string; kind: string; transactionNo: string | null; imageKey: string | null; result: string; reasons: string[]; voucherAmount: number | null; allocatedAmount: number; excessAmount: number | null; unresolvedPayments: number; payments: AuditPayment[]; fingerprint: string; reviews: AuditReview[]; reviewStale: boolean }
export interface VoucherAuditScan { scannedAt: string; paymentsScanned: number; paymentsWithEvidence: number; counts: Record<string, number>; groups: AuditGroup[] }
export const scanPaymentVouchers = () => apiClient.get<VoucherAuditScan>(`${ORDER_REGISTER_BASE_PATH}/payments/voucher-audit`, { stayOnUnauthorized: true, timeout: 120000 })
export const reviewPaymentVouchers = (request: { groupKey: string; fingerprint: string; conclusion: string; note: string }) => apiClient.post<AuditReview>(`${ORDER_REGISTER_BASE_PATH}/payments/voucher-audit/reviews`, request)
