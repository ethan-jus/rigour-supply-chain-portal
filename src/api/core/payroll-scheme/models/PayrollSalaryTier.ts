export interface PayrollSalaryTier {
  code: string
  name: string
  lower: number | null
  upper: number | null
  lowerInclusive: boolean
  upperInclusive: boolean
  amount: number | null
  performanceBase: number | null
}
