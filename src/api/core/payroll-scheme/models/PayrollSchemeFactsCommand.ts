import type { PayrollMetricActual } from './PayrollMetricActual'

export interface PayrollSchemeFactsCommand {
  revision: number | null
  performanceBase: number | null
  performanceCompletionPercent?: number | null
  commissionAdjustment?: number | null
  metrics: PayrollMetricActual[]
  reason: string
}
