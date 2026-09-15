import { apiClient } from './client'
import type { EmployeeAnalyticsQuery } from './bi-employees'

export interface CityContactAnalytics {
  status: 'NOT_READY' | 'OWNER_MAPPING_REQUIRED' | 'READY'
  syncedAt: string | null
  from: string
  to: string
  cities: {
    regionCode: string | null
    cityName: string | null
    contactedStores: number
    approvedStores: number
    pendingStores: number
    flaggedStores: number
    crmLinkedStores: number | null
    crmUnlinkedStores: number | null
  }[]
}

export function getCityContactAnalytics(query: EmployeeAnalyticsQuery) {
  const { from, to, regionCode, ownerStaffCode } = query
  return apiClient.get<CityContactAnalytics>('/analytics/supply/dashboard/city-contacts', {
    params: { from, to, regionCode, ownerStaffCode },
  })
}
