import { apiClient } from './client'

/** CRM 分页结果；所有查询都只读取 CRM 本地规范表。 */
export interface CrmPage<T> {
  total: number
  begin: number
  step: number
  items: T[]
}

export interface CrmCustomerSummary {
  id: string
  code: string | null
  name: string
  internalStatus: string
  account: string | null
  typeName: string | null
  areaName: string | null
  contactName: string | null
  phone: string | null
  staffName: string | null
  salesAssignments: CrmSalesAssignment[]
  sourceUpdatedAt: string | null
  syncedAt: string | null
  sourcePresence: string
  sourceStatus: string | null
}

export interface CrmAddress {
  id: string
  consignee: string | null
  contact: string | null
  phone: string | null
  regionText: string | null
  areaName: string | null
  addressDetail: string | null
  fullAddress: string | null
  defaultAddress: boolean
  sourceUpdatedAt: string | null
  sourceFields: Record<string, unknown>
}

export interface CrmShippingAddress {
  id: string
  customerId: string
  customerCode: string | null
  customerName: string
  sourceId: string | null
  consignee: string | null
  contact: string | null
  phone: string | null
  regionText: string | null
  areaName: string | null
  addressDetail: string | null
  fullAddress: string | null
  defaultAddress: boolean
  status: string | null
  sourceUpdatedAt: string | null
  syncedAt: string | null
  sourcePresence: string
}

export interface CrmCustomerDetail {
  id: string
  code: string | null
  name: string
  internalStatus: string
  account: string | null
  typeName: string | null
  areaName: string | null
  city: string | null
  inviter: string | null
  remark: string | null
  contactName: string | null
  phone: string | null
  email: string | null
  address: string | null
  settlementMode: string | null
  staffName: string | null
  salesAssignments: CrmSalesAssignment[]
  sourceStatus: string | null
  sourceCreatedAt: string | null
  sourceUpdatedAt: string | null
  syncedAt: string | null
  sourcePresence: string
  shippingAddresses: CrmAddress[]
  sourceFields: Record<string, unknown>
  source: CrmCustomerSource
}

export interface CrmCustomerSource {
  clientGuid: string | null
  typeId: string | null
  areaId: string | null
  areaGuid: string | null
  statusCode: string | null
  clearingFormCode: string | null
}

export interface CrmSalesAssignment {
  assignmentType: 'PRIMARY' | 'SECONDARY' | 'SERVICE' | string
  sourceStaffId: string | null
  staffName: string | null
}

export interface CrmDictionaryItem {
  id: string
  code: string | null
  name: string
  status: string
  syncedAt: string | null
  parentId?: string | null
  parentCode?: string | null
}

export interface CrmExternalStaff {
  id: string
  sourceStaffId: string | null
  accountId: string | null
  accountName: string | null
  staffType: string | null
  staffName: string
  title: string | null
  branchName: string | null
  accountMobile: string | null
  mobile: string | null
  email: string | null
  roleName: string | null
  sourceStatus: string | null
  sourceUpdatedAt: string | null
  syncedAt: string | null
}

export interface CrmCustomerQuery {
  begin: number
  step: number
  q?: string
  status?: string
}

export interface CrmDictionaryQuery {
  begin: number
  step: number
  q?: string
}

export type CrmSyncObjectType =
  | 'ALL'
  | 'CUSTOMER_TYPE'
  | 'CUSTOMER_AREA'
  | 'STAFF'
  | 'CUSTOMER'
  | 'ADDRESS'

export interface CrmSyncObjectResult {
  runId: string
  objectType: Exclude<CrmSyncObjectType, 'ALL'>
  status: string
  fetched: number
  created: number
  changed: number
  repaired: number
  duplicates: number
  absent: number
  rejected: number
  unmapped: number
  dictionaryRevisions: Record<string, number>
  pages: number
  finishedAt: string | null
}

export interface CrmSyncResult {
  batchId: string
  status: string
  objects: CrmSyncObjectResult[]
}

const CRM_BASE_PATH = '/crm'
const longRunningRequest = { timeout: 300000, stayOnUnauthorized: true }

export function getCrmCustomers(params: CrmCustomerQuery) {
  return apiClient.get<CrmPage<CrmCustomerSummary>>(`${CRM_BASE_PATH}/customers`, {
    params,
    stayOnUnauthorized: true,
  })
}

export function getCrmCustomer(id: string) {
  return apiClient.get<CrmCustomerDetail>(`${CRM_BASE_PATH}/customers/${id}`, {
    stayOnUnauthorized: true,
  })
}

export function getCrmShippingAddresses(params: CrmDictionaryQuery) {
  return apiClient.get<CrmPage<CrmShippingAddress>>(`${CRM_BASE_PATH}/shipping-addresses`, {
    params,
    stayOnUnauthorized: true,
  })
}

export function getCrmCustomerTypes(params: CrmDictionaryQuery) {
  return apiClient.get<CrmPage<CrmDictionaryItem>>(`${CRM_BASE_PATH}/customer-types`, {
    params,
    stayOnUnauthorized: true,
  })
}

export function getCrmCustomerAreas(params: CrmDictionaryQuery) {
  return apiClient.get<CrmPage<CrmDictionaryItem>>(`${CRM_BASE_PATH}/customer-areas`, {
    params,
    stayOnUnauthorized: true,
  })
}

export function getCrmExternalStaff(params: CrmDictionaryQuery) {
  return apiClient.get<CrmPage<CrmExternalStaff>>(`${CRM_BASE_PATH}/external-staff`, {
    params,
    stayOnUnauthorized: true,
  })
}

/** Portal 只提交同步范围和分页上限，不接触连接器、Token 或订货宝账号。 */
export function syncCrmData(objectType: CrmSyncObjectType = 'ALL', maxPages = 100) {
  return apiClient.post<CrmSyncResult>(
    `${CRM_BASE_PATH}/sync`,
    { objectType, maxPages },
    longRunningRequest,
  )
}
