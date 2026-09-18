import { apiClient } from './client'
export interface AttributionSnapshot {
  employeeCode: string
  employeeName: string
  departmentId: string | number | null
  departmentName: string | null
  departmentPath: (string | number)[]
  regionCode: string | null
  regionPath: string[]
}
export interface AttributionAdjustment {
  id: string
  status: 'PENDING' | 'APPLIED' | 'REJECTED'
  expectedOrderRevision: number
  expectedSnapshotRevision: number
  before: Record<string, unknown>
  proposed: AttributionSnapshot
  evidenceRef: string
  evidenceText: string
  reason: string
  proposedBy: string
  proposedAt: string
  reviewedBy: string | null
  reviewedAt: string | null
  reviewReason: string | null
}
export interface AttributionReviewContext {
  orderId: string | number
  orderNo: string
  sourceSystemCode: string | null
  sourceOrderNo: string | null
  orderRevision: number
  snapshotRevision: number
  current: { order: Record<string, unknown>; snapshot: Record<string, unknown> }
  adjustments: AttributionAdjustment[]
}
export interface AttributionPropose {
  orderRevision: number
  snapshotRevision: number
  proposed: AttributionSnapshot
  evidenceRef: string
  evidenceText: string
  reason: string
}
const base = (id: string | number) =>
  `/orders/sales/${encodeURIComponent(String(id))}/attribution-reviews`
export const attributionReviewApi = {
  context: (id: string | number) => apiClient.get<AttributionReviewContext>(base(id)),
  propose: (id: string | number, c: AttributionPropose) =>
    apiClient.post<AttributionAdjustment>(base(id), c),
  decide: (id: string | number, reviewId: string, approve: boolean, reason: string) =>
    apiClient.post<AttributionAdjustment>(
      base(id) + '/' + encodeURIComponent(reviewId) + '/decision',
      { approve, reason },
    ),
}
