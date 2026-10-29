export interface AttendanceRuleListRow {
  createdBy?: string | null
  createdByName?: string | null
  createdTime?: string | null
  month: string
  departmentId: number | null
  departmentName: string
  expectedDays: number
  revision: number
  canWrite?: boolean
  locked: boolean
  updatedTime: string
}
