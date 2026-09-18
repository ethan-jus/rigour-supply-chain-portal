import { apiClient } from './client'

export interface MemberCustomer {
  customerId: string | number
  customerName: string
  customerCode: string
  customerType: string | null
  customerTypeName?: string | null
  status: string
  regionCode: string | null
  regionName: string | null
  employeeCode: string | null
  employeeName: string | null
  revision: number
}
export interface ResponsibilityTarget {
  userId: string
  employeeCode: string
  employeeName: string
}
export interface MemberCustomerFilters {
  customerTypes: { code: string; name: string }[]
  regions: { code: string; name: string }[]
  statuses: { code: string; name: string }[]
}
export interface MemberCustomerPage {
  items: MemberCustomer[]
  total: number
  page: number
  size: number
  target: ResponsibilityTarget
  filters?: MemberCustomerFilters
}
export interface MemberCustomerQuery {
  mode: 'OWNED' | 'CANDIDATES'
  customerType?: string
  regionCode?: string
  status?: string
  keyword: string
  page: number
  size: number
}
export interface MemberCustomerCommand {
  operation: 'ASSIGN' | 'RELEASE'
  customers: { customerId: string | number; revision: number }[]
  reason: string
}
export interface MemberCustomerPreview {
  previewToken: string
  expiresAt: string
  target: ResponsibilityTarget
  operation: MemberCustomerCommand['operation']
  items: {
    customerId: string | number
    customerName: string
    regionCode: string | null
    regionName: string | null
    oldEmployeeCode: string | null
    oldEmployeeName: string | null
    newEmployeeCode: string | null
    newEmployeeName: string | null
    revision: number
  }[]
  count: number
}
const base = (userId: string) =>
  `/crm/internal-customers/responsibility-members/${encodeURIComponent(userId)}`
export const memberCustomerApi = {
  list: (userId: string, query: MemberCustomerQuery) =>
    apiClient.get<MemberCustomerPage>(`${base(userId)}/customers`, { params: query }),
  preview: (userId: string, command: MemberCustomerCommand) =>
    apiClient.post<MemberCustomerPreview>(`${base(userId)}/preview`, command),
  apply: (userId: string, previewToken: string) =>
    apiClient.post<{ affectedCount: number }>(`${base(userId)}/apply`, { previewToken }),
}
