import type { PayrollComponentStateChange } from './PayrollComponentStateChange'
import type { PayrollComponentDefinition } from './PayrollComponentDefinition'
export interface PayrollComponentVersionView {
  id: string
  ruleId: string
  ruleCode: string
  version: number
  definition: PayrollComponentDefinition
  reason: string
  createdBy: string
  createdTime: string
  revision?: number
  deleted?: boolean
  stateChanges?: PayrollComponentStateChange[]
}
