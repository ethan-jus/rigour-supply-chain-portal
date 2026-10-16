import type { PayrollMetricActual } from './PayrollMetricActual'

export interface PayrollSchemeFactsView {
  revision: number
  performanceBase: number | null
  metrics: PayrollMetricActual[]
  reason: string
}
