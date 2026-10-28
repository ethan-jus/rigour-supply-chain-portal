import type { AttendanceExceptionPeriod } from './AttendanceExceptionPeriod'
import type { AttendanceAssessmentOverride } from './AttendanceAssessmentOverride'

export interface AttendanceRecordCommand {
  assessmentOverride?: AttendanceAssessmentOverride | null
  exceptions?: AttendanceExceptionPeriod[]
  actualDaysOverride: number | null
  absentDaysOverride: number | null
  leaveTypeCode: string
  reason: string
  revision: number
}
