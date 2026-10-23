import type { CostScope } from './CostScope'
import type { CostCategory } from './CostCategory'

export interface CostQuery {
  year?: number
  month?: number
  compare?: 'previous' | 'yoy'
  city?: string
  scope?: CostScope
  category?: CostCategory
  dimension?: string
  dimensionKey?: string
  status?: string
  payment?: string
  search?: string
  periodSide?: 'current' | 'previous'
  page?: number
  size?: number
  snapshotId?: string
  missingAmount?: boolean
}
