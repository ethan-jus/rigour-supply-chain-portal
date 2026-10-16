export interface PayrollSummary {
  total: number
  completeCount: number
  pendingCount: number
  grossPay: number
  netPay: number
  statusCounts: Record<string, number>
}
