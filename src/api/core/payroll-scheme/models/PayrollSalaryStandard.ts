import type { PayrollSchemeDefinition } from './PayrollSchemeDefinition'
export interface PayrollSalaryStandard {
  baseSalary: PayrollSchemeDefinition['baseSalary']
  performanceBase: number | null
  proration: PayrollSchemeDefinition['proration']
}
