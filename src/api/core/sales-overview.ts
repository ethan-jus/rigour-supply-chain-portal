import { apiClient } from './client'

export interface SalesOverviewQuery {
  from: string
  asOf: string
  departmentId?: number
  includeSubDepartments?: boolean
  ownerStaffCode?: string
}

export interface SalesOverviewEmployee {
  code: string | null
  name: string
  city: string | null
  booked: number
  received: number | null
  applied: number | null
  outstanding: number | null
  target: number | null
  missingTargetMonths: number
  receiptTarget: number | null
  missingReceiptTargetMonths: number
}

export interface SalesOverview {
  departments: { id: number; parentId: number | null; departmentName: string; sortOrder: number }[]
  employees: { code: string; name: string }[]
  people: SalesOverviewEmployee[]
  booked: number
  received: number | null
  applied: number | null
  outstanding: number | null
  overdue: number | null
  overdueOrders: number | null
  financeAsOf: string | null
  targetsAvailable: boolean
  canSeeCompanyCash: boolean
}

export type SalesOverviewDetailKind = 'PRODUCTS' | 'APPLICATIONS' | 'ORDERS'

export interface SalesOverviewDetail {
  id: string
  orderNo: string | null
  date: string
  name: string | null
  employee: string | null
  amount: number
  applied: number | null
}

const path = '/analytics/supply/dashboard/sales-overview'

export const getSalesOverview = (params: SalesOverviewQuery, signal: AbortSignal) =>
  apiClient.get<SalesOverview>(path, { params, signal, cacheBypass: true, errorFeedback: 'inline' })

export const getSalesOverviewDetails = (
  params: SalesOverviewQuery & { kind: SalesOverviewDetailKind; page: number; size: number },
  signal: AbortSignal,
) =>
  apiClient.get<{ items: SalesOverviewDetail[]; total: number }>(path + '/details', {
    params,
    signal,
    cacheBypass: true,
    errorFeedback: 'inline',
  })
