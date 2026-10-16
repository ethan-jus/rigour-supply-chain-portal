import type { PayrollSchemeCommissionRule } from './PayrollSchemeCommissionRule'
export interface PayrollSchemeCommissionPolicy {
  managerAttribution: string
  standardDate: string
  rules: PayrollSchemeCommissionRule[]
}
