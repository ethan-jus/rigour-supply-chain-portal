import type { CostCategory } from './CostCategory'
import type { CostPeriod } from './CostPeriod'

export interface CostMeta {
  metricVersion: string
  snapshotId: string
  generatedAt: string
  effectiveCutoff: string
  period: CostPeriod
  includedSources: string[]
  excludedScopes: string[]
  comparisonAvailable: boolean
  comparisonReason: string | null
  dataState: string
  exportAllowed: boolean
  availableCategories: CostCategory[]
  /** 尚未计入成本的有效待完善单据数量，不包含金额。 */
  pendingCounts?: Partial<Record<CostCategory, number>>
}
