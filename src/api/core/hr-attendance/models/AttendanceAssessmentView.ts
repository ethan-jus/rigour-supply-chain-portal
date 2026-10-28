export interface AttendanceAssessmentView {
  status: 'AVAILABLE' | 'UNAVAILABLE' | 'UNLINKED' | 'NOT_APPLICABLE'
  through: string
  missingCheckins: number | null
  missingVisits: number | null
  days: {
    date: string
    checkins: number
    effectiveVisits: number
    missingCheckins: number
    missingVisits: number
    deduction: number | null
    evidenceComplete: boolean
  }[]
  message: string
}
