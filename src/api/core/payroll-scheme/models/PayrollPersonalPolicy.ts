export interface PayrollPersonalPolicy {
  exemptDays: string[]
  allowanceVersionId: string | null
  probationUntil: string | null
  probationBasePercent: number | null
  protectionUntil: string | null
  salaryChangeDate: string | null
  baseAfterChange: number | null
  performanceAfterChange: number | null
}
