export interface AttendanceAssessmentOverride {
  missingCheckins: number | null
  missingVisits: number | null
  reason: string
  actualCheckins?: number | null
  actualVisits?: number | null
  expectedCheckins?: number | null
  expectedVisits?: number | null
}
