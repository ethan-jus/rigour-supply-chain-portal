import type { AttendanceExceptionPeriod } from './AttendanceExceptionPeriod'

import type { AttendanceAssessmentView } from './AttendanceAssessmentView'
import type { AttendanceAssessmentOverride } from './AttendanceAssessmentOverride'

export interface AttendanceRow {
  assessmentOverride?: AttendanceAssessmentOverride | null
  assessment?: AttendanceAssessmentView | null
  exceptions?: AttendanceExceptionPeriod[]
  employeeCode: string
  employeeName: string
  entryDate?: string | null
  leaveDate?: string | null
  departmentName: string | null
  expectedDays: number | null
  ruleSource: 'COMPANY' | 'DEPARTMENT' | 'UNSET' | 'DISABLED'
  actualDays: number | null
  absentDays: number | null
  punchDays: number | null
  actualDaysOverride: number | null
  absentDaysOverride: number | null
  leaveTypeCode: string
  attendanceStatus: 'PENDING' | 'CONFIRMED'
  sourceStatus: 'AVAILABLE' | 'UNLINKED' | 'UNAVAILABLE' | 'FUTURE'
  dates: string[]
  reason: string
  revision: number
}
