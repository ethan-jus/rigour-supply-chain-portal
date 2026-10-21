export interface PayrollMetricStep {
  lower: number | null
  upper: number | null
  lowerInclusive: boolean
  upperInclusive: boolean
  mode: string
  coefficient: number | null
}
