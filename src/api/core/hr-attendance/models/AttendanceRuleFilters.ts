export interface AttendanceRuleFilters {
  month: string
  departmentId?: number
  status: '' | 'LOCKED' | 'UNLOCKED'
}
