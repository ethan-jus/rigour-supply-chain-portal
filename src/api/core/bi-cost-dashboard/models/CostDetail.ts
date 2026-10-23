import type { CostMeta } from './CostMeta'
import type { CostRecord } from './CostRecord'

export interface CostDetail {
  meta: CostMeta
  record: CostRecord
  dimensions: Record<string, string>
  remark: string | null
  originalNumbers: string[]
  sourceTable: string
  revision: number
  mappingState: string
  sourceRoute: string | null
}
