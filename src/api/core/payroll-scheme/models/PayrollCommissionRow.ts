import type { PayrollSchemeCommissionRule } from './PayrollSchemeCommissionRule'

export interface PayrollCommissionRow {
  code: string
  name: string
  sales: PayrollSchemeCommissionRule
  manager: PayrollSchemeCommissionRule
}
