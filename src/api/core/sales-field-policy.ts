import { apiClient } from './client'
import type { VisitPolicyPublication } from './sales-visit-policy'

export interface FieldPolicy {
  policyCode: string
  policyName: string
  timezoneId: string
  businessDayCutoff: string
  standardWorkMinutes: number
  minimumWorkMinutes: number
  allowResume: boolean
  workHoursEnabled: boolean
  allowAdjustment: boolean
  adjustmentDeadlineHours: number | null
  locationEnabled: boolean
  locationSampleIntervalSeconds: number
  locationUploadIntervalSeconds: number
  minimumLocationAccuracyMeters: number | null
  offlineUploadDeadlineMinutes: number
  scopeType: string
  scopeId: string | null
  publish: boolean
  expectedVersion: number
}
export interface FieldPolicyVersion {
  id: string
  versionNo: number
  publishStatus: string
  createdAt: string
  effectiveFrom: string | null
  policy: FieldPolicy
}
export const salesFieldPolicyApi = {
  list: () => apiClient.get<FieldPolicyVersion[]>('/sales/admin/field-policies', { stayOnUnauthorized: true, errorFeedback: 'inline' }),
  teams: () => apiClient.get<{ id: string; name: string }[]>('/sales/admin/field-policies/teams', { stayOnUnauthorized: true, errorFeedback: 'inline' }),
  publish: (policy: FieldPolicy) => apiClient.put<VisitPolicyPublication>(
    '/sales/admin/field-policies', { ...policy, publish: true },
    { stayOnUnauthorized: true, errorFeedback: 'inline' },
  ),
}
