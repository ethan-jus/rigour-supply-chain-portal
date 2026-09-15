import { apiClient } from './client'

export interface CustomerAttributeQuery {
  from?: string
  to?: string
  regionCode?: string
  ownerStaffCode?: string
}
export interface CustomerAttributeItem {
  name: string
  missing: boolean
  customerCount: number
  orderingCustomerCount: number | null
  orderCount: number | null
  salesAmount: number | string | null
  paidAmount: number | string | null
}
export interface CustomerAttributeAnalytics {
  status: 'NOT_READY' | 'EMPTY' | 'READY'
  syncedAt: string | null
  from: string
  to: string
  sources: CustomerAttributeItem[]
  businessCategories: CustomerAttributeItem[]
}
export function getCustomerAttributeAnalytics(query: CustomerAttributeQuery) {
  const { from, to, regionCode, ownerStaffCode } = query
  return apiClient.get<CustomerAttributeAnalytics>(
    '/analytics/supply/dashboard/customer-attributes',
    {
      params: { from, to, regionCode, ownerStaffCode },
    },
  )
}
