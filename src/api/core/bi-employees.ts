import { apiClient } from './client'

export interface EmployeeAnalyticsQuery {
  from?: string
  to?: string
  regionCode?: string
  ownerStaffCode?: string
}

export interface EmployeeAnalytics {
  status: 'NOT_READY' | 'EMPTY' | 'READY'
  syncedAt: string | null
  from: string
  to: string
  summary: {
    total: number
    active: number
    left: number
    inactive: number
    pending: number
    joinedInPeriod: number
    leftInPeriod: number
    missingEntryDate: number
    missingDepartment: number
    unmappedCity: number
    orderingEmployees: number | null
  } | null
  months: { month: string; joined: number; left: number }[]
  cities: EmployeeStructure[]
  positions: EmployeeStructure[]
  employees: {
    employeeCode: string
    employeeName: string
    employmentStatus: string
    cityName: string | null
    positionName: string | null
    departmentName: string | null
    entryDate: string | null
    leaveDate: string | null
    customerCount: number | null
    orderCount: number | null
    salesAmount: number | string | null
    paidAmount: number | string | null
  }[]
}

export interface EmployeeStructure {
  name: string
  total: number
  active: number
  left: number
}

export function getEmployeeAnalytics(query: EmployeeAnalyticsQuery) {
  const { from, to, regionCode, ownerStaffCode } = query
  return apiClient.get<EmployeeAnalytics>('/analytics/supply/dashboard/employees', {
    params: { from, to, regionCode, ownerStaffCode },
  })
}
