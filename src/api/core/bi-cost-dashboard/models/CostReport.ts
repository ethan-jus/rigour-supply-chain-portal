import type { CostScope } from './CostScope'
import type { CostCategory } from './CostCategory'
import type { CostChoice } from './CostChoice'
import type { CostMeta } from './CostMeta'
import type { CostMetric } from './CostMetric'
import type { CostGroup } from './CostGroup'
import type { CostCell } from './CostCell'
import type { CostChange } from './CostChange'
import type { CostRecord } from './CostRecord'
import type { CostPoint } from './CostPoint'
import type { CostMonth } from './CostMonth'

export interface CostReport {
  monthlyAmount?: string
  previousMonthlyAmount?: string
  payrollComponents: {
    key: string
    label: string
    amount: string | null
    previous: string | null
    delta: string | null
    records: number
    missingCount: number
  }[]
  majorRecords: CostRecord[]
  meta: CostMeta
  scope: CostScope
  category: CostCategory | null
  dimension: string | null
  current: CostMetric
  previous: CostMetric
  delta: string | null
  growth: string | null
  purchase: string
  loss: string
  increased: string | null
  decreased: string | null
  cities: CostChoice[]
  categories: CostGroup[]
  cityGroups: CostGroup[]
  matrix: CostCell[]
  changes: CostChange[]
  objects: CostGroup[]
  dimensionCoverage: string | null
  dimensions: CostChoice[]
  cumulative: CostPoint[]
  months: CostMonth[]
}
