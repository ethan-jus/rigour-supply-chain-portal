import type { PayrollInput } from '../../payroll'
import type { PayrollSchemeFactsView } from '../../payroll-scheme/models/PayrollSchemeFactsView'

export interface PayrollDeterminationView {
  input: PayrollInput
  facts: PayrollSchemeFactsView | null
}
