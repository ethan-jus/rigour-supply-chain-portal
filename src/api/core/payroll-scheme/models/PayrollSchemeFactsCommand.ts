import type { PayrollMetricActual } from './PayrollMetricActual'

export interface PayrollSchemeFactsCommand {
  revision: number | null
  performanceBase: number | null
  metrics: PayrollMetricActual[]
  reason: string
}
