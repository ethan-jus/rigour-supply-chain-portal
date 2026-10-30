import { apiClient } from './client'
export type CostCategory =
  | 'logistics'
  | 'marketing'
  | 'warehouse-rentals'
  | 'office-rentals'
  | 'expenses'
  | 'purchases'
  | 'losses'
export interface CostQuery {
  begin: number
  step: number
  sourceSystem?: string
  missingAmount?: boolean
  payerCode?: string
  documentNo?: string
  title?: string
  remark?: string
  trackingNo?: string
  sourceDocumentNo?: string
  costMonth?: string
  supplierName?: string
  lossReason?: string
  ownerName?: string
  payeeName?: string
  landlordName?: string
  objectName?: string
  productName?: string
  specification?: string
  senderName?: string
  receiverName?: string
  carrierName?: string
  departmentId?: number
  contractNo?: string
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
  sourceSystem?: string | null
  originalNo?: string | null
  documentDate?: string | null
  originAddress?: string | null
  destinationAddress?: string | null
  warehouseTypeCode?: string | null
  targetWarehouseTypeCode?: string | null
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
  warehouseTypeCode?: string
  regionCode?: string
  address?: string
  name?: string
}
export type ExpenseCostCategory =
  'expense' | 'office' | 'warehouse' | 'freight' | 'marketing' | 'purchase'
export interface ExpenseCourier {
  contents: string
  recipientName: string
  companyName: string
  trackingNo: string
}
export interface CostExpenseDetails {
  costCategory: ExpenseCostCategory
  purpose: string
  courier?: ExpenseCourier | null
  payeeName?: string | null
  itemName?: string | null
  quantity?: number | null
  unit?: string | null
  unitPrice?: number | null
  amountReason?: string | null
  tripReference?: string | null
  startDate?: string | null
  endDate?: string | null
  departure?: string | null
  destination?: string | null
  evidenceNo?: string | null
  noEvidenceReason?: string | null
  freightLeg?: string | null
  relatedCost?: { source: 'ERP' | 'ORDER'; category: string; id: string; revision: number } | null
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
  costMonth?: string | null
  ownerName?: string | null
  payeeName?: string | null
  expense?: CostExpenseDetails | null
  goods?: CostGoods | null
  marketing?: { channelName: string; serviceFrom: string | null; serviceTo: string | null } | null
  externalDocuments?: CostExternalDocument[]
  logistics: {
    externalDocuments?: CostExternalDocument[]
    supplierId?: string | null
    customerId?: string | null
    entryMode?: 'LINKED' | 'MANUAL' | 'MIXED' | 'NONE'
    noSourceReason?: string
    manualPartyReason?: string
    deliveryStops?: { sourceId: string; customerName: string; address: string }[]
    senderName?: string
    receiverName?: string
    originAddress?: string
    destinationAddress?: string
    sourceWarehouseId?: string | null
    targetWarehouseId?: string | null
    externalDocumentNo?: string
    legCode: string
    sourceIds: string[]
    voucherIds: string[]
    carrierName: string
    trackingNo: string
    transportMethodCode: string
    payerCode: string
  } | null
  rental: {
    premisesType?: string
    premisesName?: string
    address?: string
    landlordName?: string
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
  createdBy?: string
  updatedBy?: string
  updatedTime: string
}
export interface CostPage {
  total: number
  begin: number
  step: number
  confirmedAmount?: number
  registeredAmount?: number
  missingAmountCount?: number
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
  costMonth?: string | null
  expense?: CostExpenseDetails | null
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
  createdTime?: string
  createdBy?: string
  updatedBy?: string
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
      : `/erp/costs/${category === 'office-rentals' ? 'warehouse-rentals' : category}`
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
    createdTime: row.createdTime || '',
  }
}
const scopedQuery = (category: CostCategory, params: CostQuery): CostQuery =>
  category === 'office-rentals'
    ? { ...params, typeCode: 'OFFICE' }
    : category === 'warehouse-rentals'
      ? { ...params, typeCode: params.typeCode || 'WAREHOUSE' }
      : params

export async function getCosts(category: CostCategory, params: CostQuery): Promise<CostPage> {
  if (category !== 'expenses')
    return apiClient.get<CostPage>(base(category), {
      params: scopedQuery(category, params),
      ...options,
    })
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
    const source = { ...data }
    delete source.expense
    const {
      rental,
      logistics,
      goods,
      costMonth,
      ownerName,
      payeeName,
      marketing,
      externalDocuments,
      ...common
    } = source
    const command =
      category === 'logistics'
        ? { ...common, logistics }
        : {
            ...common,
            rental,
            goods,
            costMonth,
            ownerName,
            payeeName,
            marketing,
            externalDocuments,
          }
    return id
      ? apiClient.put<CostRecord>(path, command, options)
      : apiClient.post<CostRecord>(path, command, options)
  }
  const command: ExpenseCommand = {
    costMonth: data.costMonth,
    expense: data.expense,
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
export const getCostSources = (legCode: string, keyword: string, cityCode?: string, begin = 0) =>
  apiClient.get<CostSource[]>('/orders/logistics-costs/sources', {
    params: { legCode, keyword, cityCode, begin },
    ...options,
  })
export const getCostEmployees = (
  category: CostCategory,
  query?: { cityCode: string; cityName: string; costDate?: string },
) =>
  apiClient.get<CostEmployee[]>(
    `${base(category)}/employees`,
    query ? { ...options, params: query } : options,
  )
export const getCostWarehouses = (category: CostCategory, keyword = '') =>
  apiClient
    .get<CostWarehouse[]>(
      `/erp/costs/${category === 'office-rentals' ? 'warehouse-rentals' : category}/warehouses`,
      {
        params: { keyword },
        ...options,
      },
    )
    .then((rows) => rows.map((row) => ({ ...row, label: row.name || row.label })))

export const getCostCities = (action?: string) =>
  apiClient.get<{ code: string; name: string }[]>('/crm/cost-city-references', {
    params: { action },
    ...options,
  })

export interface CostExternalDocument {
  linkedId?: string | null
  sourceSystemName?: string
  originAddress?: string
  destinationAddress?: string
  differenceReason?: string
  sourceSystem: 'DHB' | 'MANUAL' | 'OTHER'
  documentType: string
  documentNo: string
  documentDate: string
  senderName: string
  receiverName: string
  remark: string
}
export interface CostGoods {
  externalDocument?: CostExternalDocument | null
  productId: string | null
  variantId: string | null
  productName: string
  specification: string
  unit: string
  unitPrice: number | null
  quantity: number | null
  supplierId: string | null
  supplierName: string
  warehouseId: string | null
  location: string
  purchaseOrderId: string | null
  lossReason: string
  amountReason: string
}
export interface CostReference {
  id: string
  code: string
  name: string
  productId?: string
  specification?: string
  unit?: string
}
export const getCostReferences = (
  category: CostCategory,
  kind: string,
  keyword = '',
  parentId?: string | null,
  begin = 0,
) =>
  apiClient.get<CostReference[]>(
    `/erp/costs/${category === 'office-rentals' ? 'warehouse-rentals' : category}/references/${kind}`,
    {
      params: { keyword, parentId, begin },
      ...options,
    },
  )
export const getCostPurchaseOrders = (
  category: CostCategory,
  keyword = '',
  cityCode?: string,
  begin = 0,
) =>
  apiClient.get<CostSource[]>(
    `/erp/costs/${category === 'office-rentals' ? 'warehouse-rentals' : category}/purchase-orders`,
    {
      params: { keyword, cityCode, begin },
      ...options,
    },
  )
export const getCost = async (category: CostCategory, id: string): Promise<CostRecord> => {
  const path = `${base(category)}/${encodeURIComponent(id)}`
  return category === 'expenses'
    ? fromExpense(await apiClient.get<ExpenseRecord>(path, options))
    : apiClient.get<CostRecord>(path, options)
}

export const exportCosts = (category: CostCategory, params: CostQuery) =>
  category === 'expenses'
    ? getCosts(category, params)
    : apiClient.get<CostPage>(`${base(category)}/export`, {
        params: scopedQuery(category, params),
        ...options,
      })

export interface CostAttachment {
  id: string
  fileName: string
  contentType: string
  size: number
  createdBy: string
  createdTime: string
}
export const getCostAttachments = (category: CostCategory, id: string) =>
  apiClient.get<CostAttachment[]>(
    `${base(category)}/${encodeURIComponent(id)}/attachments`,
    options,
  )
export const uploadCostAttachment = (category: CostCategory, row: CostRecord, file: File) => {
  const form = new FormData()
  form.append('file', file)
  form.append('revision', String(row.revision))
  return apiClient.post<CostAttachment>(
    `${base(category)}/${encodeURIComponent(row.id)}/attachments`,
    form,
    { ...options, headers: { 'Content-Type': 'multipart/form-data' } },
  )
}
export const getCostAttachmentUrl = (category: CostCategory, id: string, file: string) =>
  apiClient.get<string>(
    `${base(category)}/${encodeURIComponent(id)}/attachments/${encodeURIComponent(file)}/url`,
    options,
  )

export const getCostCustomers = (cityCode: string, keyword: string, begin = 0) =>
  apiClient.get<CostReference[]>('/crm/cost-customer-references', {
    params: { cityCode, keyword, begin },
    ...options,
  })
