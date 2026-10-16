export interface PayrollMetricResultView {
  code: string
  name: string
  actual: number | null
  target: number | null
  weight: number | null
  completion: number | null
  coefficient: number | null
  contribution: number | null
  evidence: string
}
