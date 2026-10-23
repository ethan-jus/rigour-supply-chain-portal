import type { PayrollComponentAction } from './PayrollComponentAction'
export interface PayrollComponentActionCommand {
  requestId: string
  action: PayrollComponentAction
  reason: string
  revision: number
  stateRevision: number
}
