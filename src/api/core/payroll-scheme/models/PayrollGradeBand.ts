export interface PayrollGradeBand {
  code: string
  name: string
  lower: number | null
  upper: number | null
  lowerInclusive: boolean
  upperInclusive: boolean
}
