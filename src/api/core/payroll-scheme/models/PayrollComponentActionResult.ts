import type { PayrollComponentVersionView } from './PayrollComponentVersionView'
export interface PayrollComponentActionResult {
  rule: PayrollComponentVersionView
  attendanceReviews: number
  payrollReviews: number
  action: string
  reason: string
}
