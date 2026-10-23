import type { CostCategory } from './CostCategory'

export interface CostChange {
  city: string
  cityName: string
  category: CostCategory
  current: string
  previous: string
  delta: string
  contribution: string
  direction: string
}
