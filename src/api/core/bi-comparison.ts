import { apiClient } from './client'
import type { SupplyDashboardQuery } from './bi'

export interface BiComparisonValues {
  salesAmount: number
  paidAmount: number
  unpaidAmount: number
  orderCount: number
  customerCount: number
}
export interface BiComparison {
  from: string
  to: string
  previousFrom: string
  previousTo: string
  generatedAt: string
  current: BiComparisonValues
  previous: BiComparisonValues
  cities: {
    regionCode: string
    regionName: string
    current: BiComparisonValues
    previous: BiComparisonValues
  }[]
}
export const getBiComparison = (params: SupplyDashboardQuery) =>
  apiClient.get<BiComparison>('/analytics/supply/dashboard/comparison', {
    params,
    stayOnUnauthorized: true,
  })
