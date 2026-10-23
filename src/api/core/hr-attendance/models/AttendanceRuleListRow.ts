export interface AttendanceRuleListRow {
  month: string
  departmentId: number | null
  departmentName: string
  expectedDays: number
  revision: number
  canWrite?: boolean
  locked: boolean
  updatedTime: string
}
