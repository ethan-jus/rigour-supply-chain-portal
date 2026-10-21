import type { PayrollAppliedRuleView } from './PayrollAppliedRuleView'
import type { PayrollProductSnapshotView } from './PayrollProductSnapshotView'
import type { PayrollOrderSettlementView } from './PayrollOrderSettlementView'
export interface PayrollCommissionTraceView {
  settlement?: PayrollOrderSettlementView | null
  product?: PayrollProductSnapshotView | null
  appliedRule?: PayrollAppliedRuleView | null
  orderDate?: string | null
  orderId: string
  cityCode: string
  variantId: number | null
  baseAmount: number | null
  rate: number | null
  method: string
  fullyPaidDate: string
  refundedAmount: number | null
  ruleCode: string
  schemeVersionId: string
  originalLineId: string
}
