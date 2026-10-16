import type { PayrollSchemeDefinition } from './PayrollSchemeDefinition'

export interface PayrollSchemeSaveCommand {
  requestId: string
  revision: number | null
  schemeId: string | null
  definition: PayrollSchemeDefinition
  reason: string
}
