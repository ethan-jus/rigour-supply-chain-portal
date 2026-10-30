export interface AttendanceRule {
  createdBy?: string | null
  createdByName?: string | null
  createdTime?: string | null
  month: string
  departmentId: number | null
  expectedDays: number | null
  revision: number
  companyExpectedDays: number | null
  canWrite?: boolean
  locked: boolean
  calendarExpectedDays?: number | null
  calendarMessage?: string | null
}
