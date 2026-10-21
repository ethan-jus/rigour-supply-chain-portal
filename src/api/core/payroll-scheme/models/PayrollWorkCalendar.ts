import type { PayrollWorkWindow } from './PayrollWorkWindow'

export interface PayrollWorkCalendar {
  alternateWeekdays: number[]
  alternateAnchor: string | null
  weekdays: number[]
  workDays: string[]
  restDays: string[]
  exemptDays: string[]
  window: PayrollWorkWindow
}
