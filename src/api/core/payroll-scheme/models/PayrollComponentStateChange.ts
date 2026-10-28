export interface PayrollComponentStateChange {
  retired?: boolean
  replacedDepartmentIds?: number[]
  revision: number
  effectiveMonth: string
  enabled: boolean
  reason: string
  actor: string
  time: string
}
