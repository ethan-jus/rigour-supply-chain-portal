import type { PayrollDetail } from '../../payroll'
export interface PayrollCommissionProduct {
  collectionAmount: number | null
  key: string
  name: string
  variantCode: string
  role: string
  unit: string
  quantity: number
  base: number | null
  rate: number | null
  method: string | null
  rule: string
  ruleCode: string
  version: number
  orderCount: number
  amount: number | null
  knownAmount: number
  pendingCount: number
  lines: PayrollDetail[]
}
