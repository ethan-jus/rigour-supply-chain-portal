export interface PayrollOrderSettlementView {
  orderAmount: number | null
  paidAmount: number | null
  refundedAmount: number | null
  through: string
}
