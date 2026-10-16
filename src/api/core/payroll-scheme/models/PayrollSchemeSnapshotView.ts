import type { PayrollAppliedRuleView } from './PayrollAppliedRuleView'
import type { PayrollMetricResultView } from './PayrollMetricResultView'
import type { PayrollSchemeVersionView } from './PayrollSchemeVersionView'

export interface PayrollSchemeSnapshotView {
  appliedRules?: PayrollAppliedRuleView[]
  scheme: PayrollSchemeVersionView
  salaryTier: string
  achievement: number | null
  performanceBase: number | null
  metrics: PayrollMetricResultView[]
  managerCompletion?: number | null
  managerCoefficient: number | null
  protectedDays: number
  assessedDays: number
  explanations: string[]
}
