export interface PayrollComponentStateChange {
  revision: number
  effectiveMonth: string
  enabled: boolean
  reason: string
  actor: string
  time: string
}
