export interface AttendanceRule {
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
