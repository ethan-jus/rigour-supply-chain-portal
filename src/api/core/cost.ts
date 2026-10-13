import { apiClient } from './client'
export type CostCategory = 'logistics' | 'marketing' | 'warehouse-rentals' | 'expenses'
export interface CostQuery {
  begin: number
  step: number
  keyword?: string
  typeCode?: string
  cityCode?: string
  statusCode?: string
  paymentStatusCode?: string
  dateFrom?: string
  dateTo?: string
  warehouseId?: string
  ownerEmployeeCode?: string
  employeeCode?: string
}
export interface CostEmployee {
  employeeCode: string
  employeeName: string
  departmentId: number | null
  departmentName: string | null
  cityName?: string | null
}
export interface CostSource {
  id: string
  documentNo: string
  sourceType: string
  cityCode: string
  warehouseId: string | null
  targetWarehouseId: string | null
  senderCode: string
  senderName: string
  receiverCode: string
  receiverName: string
  statusCode: string
}
export interface CostWarehouse {
  value: string
  label: string
}
export interface CostCommand {
  requestId: string
  revision: number | null
  title: string
  typeCode: string | null
  cityCode: string
  cityName: string
  departmentId: number | null
  ownerEmployeeCode: string | null
  costDate: string
  amount: number | null
  paymentStatusCode: string
  logistics: {
    legCode: string
    sourceIds: string[]
    voucherIds: string[]
    carrierName: string
    trackingNo: string
    transportMethodCode: string
    payerCode: string
  } | null
  rental: {
    warehouseId: string | null
    area: number | null
    contractNo: string
    leaseFrom: string
    leaseTo: string
    deposit: number | null
  } | null
  remark: string
  reason: string
}
export interface CostRecord {
  id: string
  documentNo: string
  categoryCode: string
  statusCode: string
  revision: number
  data: CostCommand
  sources: CostSource[]
  warehouseName: string | null
  ownerEmployeeName: string | null
  createdTime: string
  updatedTime: string
}
export interface CostPage {
  total: number
  begin: number
  step: number
  confirmedAmount?: number
  paidAmount?: number
  pendingCount?: number
  items: CostRecord[]
}
export interface CostAudit {
  action: string
  actorId: string
  reason: string | null
  occurredTime: string
  snapshot?: CostRecord
  snapshotJson?: string
}
interface ExpenseCommand {
  requestId: string
  revision: number | null
  title: string
  typeCode: string | null
  employeeCode: string | null
  cityCode: string
  cityName: string
  costDate: string
  amount: number | null
  paymentStatusCode: string
  remark: string
  reason: string
}
interface ExpenseRecord {
  id: string
  documentNo: string
  statusCode: string
  revision: number
  data: ExpenseCommand
  employeeName: string
  departmentId: number | null
  departmentName: string | null
  updatedTime: string
}
const options = { stayOnUnauthorized: true }
const base = (category: CostCategory) =>
  category === 'expenses'
    ? '/hr/expenses'
    : category === 'logistics'
      ? '/orders/logistics-costs'
      : `/erp/costs/${category}`
function fromExpense(row: ExpenseRecord): CostRecord {
  return {
    ...row,
    categoryCode: 'EXPENSE',
    data: {
      ...row.data,
      departmentId: row.departmentId,
      ownerEmployeeCode: row.data.employeeCode,
      logistics: null,
      rental: null,
    },
    sources: [],
    warehouseName: null,
    ownerEmployeeName: row.employeeName,
    createdTime: row.updatedTime,
  }
}
export async function getCosts(category: CostCategory, params: CostQuery): Promise<CostPage> {
  if (category !== 'expenses')
    return apiClient.get<CostPage>(base(category), { params, ...options })
  const page = await apiClient.get<{
    total: number
    begin: number
    step: number
    items: ExpenseRecord[]
  }>(base(category), { params: { ...params, employeeCode: params.ownerEmployeeCode }, ...options })
  return { ...page, items: page.items.map(fromExpense) }
}
export async function saveCost(
  category: CostCategory,
  id: string | null,
  data: CostCommand,
): Promise<CostRecord> {
  const path = `${base(category)}${id ? '/' + encodeURIComponent(id) : ''}`
  if (category !== 'expenses') {
    const { rental, logistics, ...common } = data
    const command = category === 'logistics' ? { ...common, logistics } : { ...common, rental }
    return id
      ? apiClient.put<CostRecord>(path, command, options)
      : apiClient.post<CostRecord>(path, command, options)
  }
  const command: ExpenseCommand = {
    requestId: data.requestId,
    revision: data.revision,
    title: data.title,
    typeCode: data.typeCode,
    employeeCode: data.ownerEmployeeCode,
    cityCode: data.cityCode,
    cityName: data.cityName,
    costDate: data.costDate,
    amount: data.amount,
    paymentStatusCode: data.paymentStatusCode,
    remark: data.remark,
    reason: data.reason,
  }
  return fromExpense(
    await (id
      ? apiClient.put<ExpenseRecord>(path, command, options)
      : apiClient.post<ExpenseRecord>(path, command, options)),
  )
}
export async function changeCostStatus(
  category: CostCategory,
  row: CostRecord,
  action: 'confirm' | 'void',
  reason: string,
) {
  const path = `${base(category)}/${encodeURIComponent(row.id)}/${action}`
  const command = { revision: row.revision, reason }
  if (category === 'expenses')
    return fromExpense(await apiClient.post<ExpenseRecord>(path, command, options))
  return apiClient.post<CostRecord>(path, command, options)
}
export const getCostHistory = (category: CostCategory, id: string) =>
  apiClient.get<CostAudit[]>(`${base(category)}/${encodeURIComponent(id)}/history`, options)
export const getCostSources = (legCode: string, keyword: string) =>
  apiClient.get<CostSource[]>('/orders/logistics-costs/sources', {
    params: { legCode, keyword },
    ...options,
  })
export const getCostEmployees = (category: 'marketing' | 'expenses') =>
  apiClient.get<CostEmployee[]>(`${base(category)}/employees`, options)
export const getCostWarehouses = (category: CostCategory, keyword = '') =>
  apiClient.get<CostWarehouse[]>(`${base(category)}/warehouses`, {
    params: { keyword },
    ...options,
  })

export const getCostCities = () =>
  apiClient.get<{ code: string; name: string }[]>('/crm/cost-city-references', options)
