import { apiClient } from './client'

export interface FollowupPeriod {
  from: string
  through: string
  ownerCode?: string
}

export type FollowupReason = 'VISITED_NO_ORDER' | 'REORDER' | 'RESTOCK' | 'VERIFICATION'

export interface StoreFollowupEvidence {
  storeId: string
  name: string
  city: string | null
  ownerCode: string | null
  ownerName: string | null
  reason: Exclude<FollowupReason, 'RESTOCK'>
  lastVisitAt: string | null
  lastOrderAt: string | null
  orderId: string | null
}

export interface RestockCommitment {
  id: string
  storeId: string | null
  profileId: string
  employee: string | null
  salesperson: string
  store: string | null
  city: string | null
  due: string
  visitDate: string
  visitId: string
}

export function getStoreFollowupEvidence(
  params: FollowupPeriod & { view: 'MINE' | 'TEAM'; cursor?: string; size: number },
  signal: AbortSignal,
) {
  return apiClient.get<{ items: StoreFollowupEvidence[]; nextCursor: string | null }>(
    '/crm/stores/followup-evidence',
    { params, signal, errorFeedback: 'inline', cacheBypass: true },
  )
}

export function getRestockCommitments(
  params: FollowupPeriod & { page: number; size: number },
  signal: AbortSignal,
) {
  return apiClient.get<RestockCommitment[]>('/sales/management/customer-followups/restock', {
    params: { ...params, status: 'PLANNED' },
    signal,
    errorFeedback: 'inline',
    cacheBypass: true,
  })
}
