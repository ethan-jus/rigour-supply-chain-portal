import type { AttendanceExceptionPeriod } from './AttendanceExceptionPeriod'

export interface AttendanceRecordCommand {
  exceptions?: AttendanceExceptionPeriod[]
  actualDaysOverride: number | null
  absentDaysOverride: number | null
  leaveTypeCode: string
  reason: string
  revision: number
}
