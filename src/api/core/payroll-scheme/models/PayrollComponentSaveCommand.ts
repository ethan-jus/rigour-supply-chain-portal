import type { PayrollComponentDefinition } from './PayrollComponentDefinition'
export interface PayrollComponentSaveCommand {
  requestId: string
  previousId: string | null
  definition: PayrollComponentDefinition
  reason: string
}
