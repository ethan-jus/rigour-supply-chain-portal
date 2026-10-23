import type { PayrollPersonalPolicy } from './PayrollPersonalPolicy'
import type { PayrollSchemeDefinition } from './PayrollSchemeDefinition'
export interface PayrollSalaryStandard {
  personalPolicy?: PayrollPersonalPolicy | null
  baseSalary: PayrollSchemeDefinition['baseSalary']
  performanceBase: number | null
  proration: PayrollSchemeDefinition['proration']
}
