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
  regionName?: string | null
  cityName?: string | null
  customerSourceName?: string | null
  businessCategoryName?: string | null
  ownerSalesUserId: string | null
  ownerSalesName: string | null
  ownerEmployeeCode?: string | null
  ownerEmployeeNameSnapshot?: string | null
  settlementTypeCode: string | null
  statusCode: string
  sourceSystemCode?: string | null
  sourceDocumentNo?: string | null
  sourceCreatedAt?: string | null
  sourceUpdatedAt?: string | null
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
  ownerEmployeeCode?: string | null
  ownerEmployeeNameSnapshot?: string | null
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
  ownerEmployeeCode?: string
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
  revision?: number | null
}

export interface CrmCustomerAreaCommand {
  areaName: string
  parentAreaCode?: string | null
  status?: string | null
  revision?: number | null
}

export interface ShippingAddressSummaryView {
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
  status: string
  sourceUpdatedAt: string | null
  syncedAt: string | null
  sourcePresence: string | null
  sourceAbsentAt: string | null
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

export async function getAllCrmCustomerAreas(): Promise<CrmDictionaryView[]> {
  const items: CrmDictionaryView[] = []
  let total = Number.POSITIVE_INFINITY
  while (items.length < total) {
    const page = await getCrmCustomerAreas({ begin: items.length, step: 200 })
    if (page.begin !== items.length || (page.total > items.length && !page.items.length)) {
      throw new Error('归属地区返回不完整，请重新载入')
    }
    items.push(...page.items)
    total = page.total
  }
  return items
}

export function createCrmCustomerArea(command: CrmCustomerAreaCommand) {
  return apiClient.post<CrmDictionaryView>(`${CRM_BASE_PATH}/customer-areas`, command, {
    stayOnUnauthorized: true,
  })
}

export function updateCrmCustomerArea(id: string | number, command: CrmCustomerAreaCommand) {
  return apiClient.put<CrmDictionaryView>(
    `${CRM_BASE_PATH}/customer-areas/${encodeURIComponent(String(id))}`,
    command,
    { stayOnUnauthorized: true },
  )
}

export function deleteCrmCustomerArea(id: string | number, revision: number) {
  return apiClient.delete<void>(
    `${CRM_BASE_PATH}/customer-areas/${encodeURIComponent(String(id))}`,
    { params: { revision }, stayOnUnauthorized: true },
  )
}

export function getCrmShippingAddresses(params: { begin?: number; step?: number; q?: string } = {}) {
  return apiClient.get<CrmPage<ShippingAddressSummaryView>>(`${CRM_BASE_PATH}/shipping-addresses`, {
    params: { begin: 0, step: 20, ...params },
    stayOnUnauthorized: true,
  })
}
