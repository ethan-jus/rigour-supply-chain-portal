import type { PayrollTargetStage } from './PayrollTargetStage'

export interface PayrollSalesPolicy {
  processPercent: number | null
  dailyCheckins: number
  checkinPenalty: number | null
  dailyVisits: number
  minimumSeconds: number
  visitPenalty: number | null
  firstMonthExempt: boolean
  targets: PayrollTargetStage[]
  checkinCountMode: 'UNIQUE_CUSTOMER' | 'RECORD'
  resultCap: number | null
}
