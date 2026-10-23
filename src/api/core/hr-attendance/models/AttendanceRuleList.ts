import type { AttendanceRuleListRow } from './AttendanceRuleListRow'
import type { AttendancePage } from './AttendancePage'

export interface AttendanceRuleList {
  month: string
  companyExpectedDays: number | null
  configuredDepartmentIds: number[]
  lockedDepartmentIds: number[]
  page: AttendancePage<AttendanceRuleListRow>
}
