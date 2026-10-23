import type { PayrollCommissionProduct } from './PayrollCommissionProduct'
export interface PayrollCommissionCategory {
  key: string
  name: string
  orderCount: number
  /** 商品行及提成角色对应的快照记录条数，含待核定记录；不是商品件数。 */
  lineCount: number
  amount: number | null
  knownAmount: number
  pendingCount: number
  products: PayrollCommissionProduct[]
}
