import type { CostCategory } from './CostCategory'

export interface CostCell {
  city: string
  cityName: string
  category: CostCategory
  current: string
  previous: string | null
  delta: string | null
  share: string | null
  count: number
}
