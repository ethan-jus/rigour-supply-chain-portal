import { apiClient } from './client'

/** CRM 分页结果；所有查询都只读取 CRM 本地规范表。 */
export interface CrmPage<T> {
  total: number
  begin: number
  step: number
  items: T[]
}

export interface InternalCrmCustomerSummary {
  id: string
  customerCode: string
  customerName: string
  contactName: string | null
  contactPhone: string | null
  customerTypeCode: string | null
  regionCode: string | null
  ownerSalesUserId: string | null
  ownerSalesName: string | null
  ownerStaffCode?: string | null
  ownerStaffNameSnapshot?: string | null
  settlementTypeCode: string | null
  statusCode: string
  revision: number
  updatedTime: string
}

export interface InternalCrmCustomerDetail extends InternalCrmCustomerSummary {
  address: string | null
  remark: string | null
  createdBy: string | null
  createdTime: string
  updatedBy: string | null
}

export interface InternalCrmCustomerCommand {
  customerName: string
  contactName?: string | null
  contactPhone?: string | null
  customerTypeCode?: string | null
  regionCode?: string | null
  ownerSalesUserId?: string | null
  ownerSalesName?: string | null
  ownerStaffCode?: string | null
  ownerStaffNameSnapshot?: string | null
  settlementTypeCode?: string | null
  address?: string | null
  statusCode?: string | null
  remark?: string | null
  revision?: number | null
}

export interface InternalCrmCustomerQuery {
  begin: number
  step: number
  customerCode?: string
  customerName?: string
  contactPhone?: string
  customerTypeCode?: string
  regionCode?: string
  ownerSalesUserId?: string
  ownerStaffCode?: string
  statusCode?: string
}

export interface CrmDictionaryView {
  id: string
  code: string
  name: string
  status: string
  syncedAt: string | null
  parentId: string | null
  parentCode: string | null
  sourcePresence?: string | null
  sourceAbsentAt?: string | null
}

const CRM_BASE_PATH = '/crm'

export function getInternalCrmCustomers(params: InternalCrmCustomerQuery) {
  return apiClient.get<CrmPage<InternalCrmCustomerSummary>>(`${CRM_BASE_PATH}/internal-customers`, {
    params,
    stayOnUnauthorized: true,
  })
}

export function getInternalCrmCustomer(id: string | number) {
  return apiClient.get<InternalCrmCustomerDetail>(`${CRM_BASE_PATH}/internal-customers/${encodeURIComponent(String(id))}`, {
    stayOnUnauthorized: true,
  })
}

export function createInternalCrmCustomer(command: InternalCrmCustomerCommand) {
  return apiClient.post<InternalCrmCustomerDetail>(`${CRM_BASE_PATH}/internal-customers`, command, {
    stayOnUnauthorized: true,
  })
}

export function updateInternalCrmCustomer(id: string | number, command: InternalCrmCustomerCommand) {
  return apiClient.put<InternalCrmCustomerDetail>(
    `${CRM_BASE_PATH}/internal-customers/${encodeURIComponent(String(id))}`,
    command,
    { stayOnUnauthorized: true },
  )
}

export function deleteInternalCrmCustomer(id: string | number, revision: number) {
  return apiClient.delete<void>(`${CRM_BASE_PATH}/internal-customers/${encodeURIComponent(String(id))}`, {
    params: { revision },
    stayOnUnauthorized: true,
  })
}

export function getCrmCustomerTypes(params: { begin?: number; step?: number; q?: string } = {}) {
  return apiClient.get<CrmPage<CrmDictionaryView>>(`${CRM_BASE_PATH}/customer-types`, {
    params: { begin: 0, step: 200, ...params },
    stayOnUnauthorized: true,
  })
}

export function getCrmCustomerAreas(params: { begin?: number; step?: number; q?: string } = {}) {
  return apiClient.get<CrmPage<CrmDictionaryView>>(`${CRM_BASE_PATH}/customer-areas`, {
    params: { begin: 0, step: 200, ...params },
    stayOnUnauthorized: true,
  })
}
