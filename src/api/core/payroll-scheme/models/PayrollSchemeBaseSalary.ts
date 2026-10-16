import type { PayrollSalaryTier } from './PayrollSalaryTier'

export interface PayrollSchemeBaseSalary {
  mode: string
  fixedAmount: number | null
  tiers: PayrollSalaryTier[]
  firstMonthTier: string
}
