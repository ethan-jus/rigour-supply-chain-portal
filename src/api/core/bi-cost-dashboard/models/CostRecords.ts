import type { CostMeta } from './CostMeta'
import type { CostRecord } from './CostRecord'
import type { CostRecordSummary } from './CostRecordSummary'

export interface CostRecords {
  meta: CostMeta
  summary: CostRecordSummary
  page: number
  size: number
  items: CostRecord[]
}
