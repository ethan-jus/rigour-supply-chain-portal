import type { PayrollMetricStep } from './PayrollMetricStep'

export interface PayrollMetricDefinition {
  code: string
  name: string
  source: string
  target: number | null
  weight: number | null
  steps: PayrollMetricStep[]
  cap: number | null
  cityMetric?: string | null
  scoringMode?: 'ACTUAL' | 'TIERED' | null
}
