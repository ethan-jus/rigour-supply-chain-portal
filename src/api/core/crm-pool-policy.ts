import { apiClient } from './client'
export interface PoolPolicyValues {
  firstVisitHours: number
  followupDays: number
  cooperatingDays: number
  returnCooldownHours: number
  activityDays: number
  dueSoonHours: number
}
export interface PoolPolicy extends PoolPolicyValues {
  id: string
  version: number
  description: string
  publishedAt: string
  publishedBy: string
}
const options = { stayOnUnauthorized: true, errorFeedback: 'inline' as const, cacheBypass: true }
export const crmPoolPolicyApi = {
  current: () => apiClient.get<PoolPolicy | null>('/crm/stores/policy', options),
  history: () => apiClient.get<PoolPolicy[]>('/crm/stores/policy/history', options),
  publish: (body: PoolPolicyValues & { expectedVersion: number; requestId: string; description: string }) =>
    apiClient.put<PoolPolicy>('/crm/stores/policy', body, options),
}
