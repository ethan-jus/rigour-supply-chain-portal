import type { PayrollInput } from '../../payroll'
import type { PayrollSchemeFactsCommand } from '../../payroll-scheme/models/PayrollSchemeFactsCommand'

export interface PayrollDeterminationCommand {
  input: PayrollInput
  facts: PayrollSchemeFactsCommand | null
}
