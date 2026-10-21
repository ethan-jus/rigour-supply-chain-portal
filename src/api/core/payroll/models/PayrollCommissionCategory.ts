import type { PayrollCommissionProduct } from './PayrollCommissionProduct'
export interface PayrollCommissionCategory {
  key: string
  name: string
  orderCount: number
  lineCount: number
  amount: number | null
  knownAmount: number
  pendingCount: number
  products: PayrollCommissionProduct[]
}
