import { apiClient } from './client'
import type { EmployeeAnalyticsQuery } from './bi-employees'

export interface VisitAnalytics {
  status: 'NOT_READY' | 'EMPTY' | 'READY'
  syncedAt: string | null
  from: string
  to: string
  summary: {
    visits: number
    contactedStores: number
    visitingPeople: number
    repeatStores: number
    approvedVisits: number
    pendingVisits: number
    flaggedVisits: number
    unlinkedEmployeeVisits: number
    crmLinkedStores: number
  } | null
  days: { date: string; visits: number; contactedStores: number }[]
  cities: {
    regionCode: string | null
    cityName: string | null
    visits: number
    contactedStores: number
    visitingPeople: number
    crmLinkedStores: number
  }[]
  people: {
    salespersonId: string | null
    employeeCode: string | null
    employeeName: string | null
    visits: number
    contactedStores: number
    activeDays: number
    approvedVisits: number
    pendingVisits: number
    flaggedVisits: number
  }[]
}
export const getVisitAnalytics = (params: EmployeeAnalyticsQuery) =>
  apiClient.get<VisitAnalytics>('/analytics/supply/dashboard/visits', { params })
