import type { PayrollGradeBand } from './PayrollGradeBand'
import type { PayrollSchemeDefinition } from './PayrollSchemeDefinition'
export interface PayrollPerformanceStandard {
  mode: string
  sales: PayrollSchemeDefinition['sales']
  manager: PayrollSchemeDefinition['manager']
  grades: PayrollGradeBand[]
}
