import type { AttendanceExceptionPeriod } from './AttendanceExceptionPeriod'

export interface AttendanceRow {
  exceptions?: AttendanceExceptionPeriod[]
  employeeCode: string
  employeeName: string
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
