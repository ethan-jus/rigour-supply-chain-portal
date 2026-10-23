import type { AttendanceRule } from './AttendanceRule'
import type { AttendanceRow } from './AttendanceRow'
import type { AttendancePage } from './AttendancePage'

export interface AttendanceView {
  month: string
  through: string | null
  provisional: boolean
  rule: AttendanceRule
  sourceError: string | null
  page: AttendancePage<AttendanceRow>
}
