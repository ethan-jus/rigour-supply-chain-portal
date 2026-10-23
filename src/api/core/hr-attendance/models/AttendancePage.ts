export interface AttendancePage<T> {
  total: number
  begin: number
  step: number
  items: T[]
}
