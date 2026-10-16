import type { PayrollMetricStep } from './PayrollMetricStep'
import type { PayrollMetricDefinition } from './PayrollMetricDefinition'
import type { PayrollProtectionPolicy } from './PayrollProtectionPolicy'

export interface PayrollManagerPolicy {
  metrics: PayrollMetricDefinition[]
  protection: PayrollProtectionPolicy
  cap: number | null
  steps: PayrollMetricStep[]
}
