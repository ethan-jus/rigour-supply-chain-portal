import type { AxiosRequestConfig } from 'axios'
import { apiClient } from './client'
import type { SupplyDashboardQuery } from './bi'
export interface SalesAnalysis {
  dailyReceipts: { period: string; value: number }[]
  people: {
    code: string
    name: string
    city: string
    employmentStatus: string | null
    sales: number
    paid: number
    receipts: number
  }[]
  goals: { code: string; month: number; metric: string; target: number }[]
  history: { amount: number; received: number } | null
  products: {
    categoryId: string
    category: string
    productId: string
    product: string
    imageUrl?: string | null
    sku: string
    quantity: number | null
    sales: number
    received: number
    receipts: number
    allocated: boolean
  }[]
  customers: { code: string; name: string; sales: number; received: number }[]
  months: { month: string; sales: number; received: number; receipts: number }[]
  receiptSplit: { currentOrders: number; historicalOrders: number; otherOrders: number } | null
  productSyncedAt: string | null
}
export const getSalesDashboardAnalysis = (
  params: SupplyDashboardQuery,
  cacheBypass = false,
  projection?: 'RANKING' | 'COMPARISON',
  feedback: Pick<AxiosRequestConfig, 'errorFeedback' | 'signal'> = {},
) =>
  apiClient.get<SalesAnalysis>('/analytics/supply/dashboard/sales-analysis', {
    params: projection ? { ...params, projection } : params,
    cacheBypass,
    ...feedback,
  })

export interface SalesDashboardSummary {
  sales: number
  receipts: number
  customers: number
  newCustomers: number
  returningCustomers: number
  annualReturningCustomers: number
}
export const getSalesDashboardSummary = (params: SupplyDashboardQuery, ownerStaffCodes: string[], cacheBypass = false) =>
  apiClient.post<SalesDashboardSummary>(
    '/analytics/supply/dashboard/sales-analysis/summary',
    { ownerStaffCodes },
    { params, cacheBypass },
  )
