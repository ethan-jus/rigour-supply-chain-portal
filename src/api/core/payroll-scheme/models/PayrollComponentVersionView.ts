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
}
