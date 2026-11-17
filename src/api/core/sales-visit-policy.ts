import { apiClient } from './client'
export interface CaptureRules {
  requireLocationOnOpen: boolean
  maximumLocationAccuracyMeters: number | null
  automaticRecording: boolean
  automaticCheckout: boolean
  allowPhotoImport: boolean
  allowRecordingImport: boolean
}
export interface VisitPolicy {
  id: string
  radiusMeters: number
  minimumDwellMinutes: number
  requiredPhotoCount: number
  recordingEnabled: boolean
  minimumRecordingSeconds: number
  maximumClipGapSeconds: number
  aiAsrEnabled: boolean
  aiRelevanceEnabled: boolean
  aiDuplicateEnabled: boolean
  aiAutoConfirmThreshold: number | null
  captureRules: CaptureRules
}
export interface VisitPolicyVersion { id: string; versionNo: number; policyCode: string; publishStatus: string; scopeType: string | null; scopeId: string | null; name: string; policy: VisitPolicy; createdAt: string; createdBy: string }
export const salesVisitPolicyApi = {
  list: () => apiClient.get<VisitPolicyVersion[]>('/sales/admin/visit-policies', { stayOnUnauthorized: true }),
  publish: (expectedVersion: number, policyCode: string, name: string, policy: VisitPolicy, scopeType: string, scopeId: string | null) => apiClient.put('/sales/admin/visit-policies', {
    expectedVersion, policyCode, policyName: name, requireAssignedTarget: true, allowProspectTarget: false,
    checkInRadiusMeters: policy.radiusMeters, minimumDwellMinutes: policy.minimumDwellMinutes,
    requiredPhotoCount: policy.requiredPhotoCount, recordingEnabled: policy.recordingEnabled,
    minimumRecordingSeconds: policy.minimumRecordingSeconds, maximumClipGapSeconds: policy.maximumClipGapSeconds,
    aiAsrEnabled: policy.aiAsrEnabled, aiRelevanceEnabled: policy.aiRelevanceEnabled, aiDuplicateEnabled: policy.aiDuplicateEnabled,
    aiAutoConfirmThreshold: policy.aiAutoConfirmThreshold, captureRules: { ...policy.captureRules, requireLocationOnOpen: false }, scopeType, scopeId, publish: true,
  }, { stayOnUnauthorized: true }),
}
