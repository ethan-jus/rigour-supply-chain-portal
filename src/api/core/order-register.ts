import { apiClient } from './client'

/**
 * 订单注册读接口（V2）。
 *
 * BASE /api/v1/orders/register，契约见 outputs/order-v2-20260917 下的
 * implementation-plan.md 与 backend-design.md。后端尚未联调时，页面按本文件的
 * camelCase 契约实现，并保留 mock/合约测试。
 */
export const ORDER_REGISTER_BASE_PATH = '/orders/register'

/** 历史覆盖提示；缺失范围明确标识，不把未知历史当作零余额。 */
export interface OrderRegisterCoverage {
  historyComplete?: boolean | null
  coverageFrom?: string | null
  message?: string | null
}

export interface OrderRegisterCommonQuery {
  begin: number
  step: number
  orderNo?: string
  customerId?: string | number
  customerName?: string
  customerCode?: string
  regionCode?: string
  ownerEmployeeCode?: string
  departmentId?: number
  orderDateFrom?: string
  orderDateTo?: string
  createdBy?: string
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
}

export interface OrderRegisterOrderQuery extends OrderRegisterCommonQuery {
  orderStatusCode?: string
  paymentStatusCode?: string
  hasUnpaid?: boolean
}

export interface OrderRegisterLineQuery extends OrderRegisterCommonQuery {
  productKeyword?: string
  productCode?: string
}

export interface OrderRegisterPaymentQuery extends OrderRegisterCommonQuery {
  paymentNo?: string
  transactionNo?: string
  paymentStatusCode?: string
  paymentTimeFrom?: string
  paymentTimeTo?: string
}

export interface OrderRegisterOrderItem {
  id: string
  orderNo: string
  legacyOrderNo: string | null
  sourceSystemCode: string | null
  sourceOrderNo: string | null
  orderNumberState: string | null
  customerId: string | null
  customerCode: string | null
  customerName: string | null
  regionCode: string | null
  regionName: string | null
  ownerEmployeeCode: string | null
  ownerEmployeeName: string | null
  departmentId: number | null
  departmentName: string | null
  orderStatusCode: string
  paymentStatusCode: string
  originalAmount: number | null
  payableAmount: number | null
  paidAmount: number | null
  unpaidAmount: number | null
  checkedAmount: number | null
  orderDate: string
  shipmentTime: string | null
  createdBy: string | null
  createdTime: string | null
  updatedBy: string | null
  updatedTime: string | null
  syncedBy: string | null
  syncedAt: string | null
  revision: number
}

export interface OrderRegisterOrderTotals {
  originalAmount: number
  payableAmount: number
  paidAmount: number
  unpaidAmount: number
  checkedAmount: number
}

export interface OrderRegisterOrderPage {
  total: number
  begin: number
  step: number
  items: OrderRegisterOrderItem[]
  totals: OrderRegisterOrderTotals
  coverage: OrderRegisterCoverage | null
}

export interface OrderRegisterLineItem {
  id: string
  orderId: string
  orderNo: string
  sourceSystemCode: string | null
  customerId: string | null
  customerCode: string | null
  customerName: string | null
  regionCode: string | null
  regionName: string | null
  ownerEmployeeCode: string | null
  ownerEmployeeName: string | null
  departmentId: number | null
  departmentName: string | null
  orderDate: string
  lineNo: number
  sourceLineId: string | null
  productId: string | null
  productVariantId: string | null
  productCode: string | null
  skuCode: string | null
  productName: string | null
  specification: string | null
  unit: string | null
  quantity: number
  unitPrice: number
  lineAmount: number
}

export interface OrderRegisterLineTotals {
  lineAmount: number
}

export interface OrderRegisterLinePage {
  total: number
  begin: number
  step: number
  items: OrderRegisterLineItem[]
  totals: OrderRegisterLineTotals
  coverage: OrderRegisterCoverage | null
}

export interface OrderRegisterPaymentItem {
  id: string
  paymentNo: string
  sourceRecordId: string | null
  orderId: string
  orderNo: string
  customerId: string | null
  customerName: string | null
  regionCode: string | null
  regionName: string | null
  ownerEmployeeCode: string | null
  ownerEmployeeName: string | null
  departmentId: number | null
  departmentName: string | null
  orderDate: string | null
  orderAmount: number | null
  paidAmount: number
  paymentStatusCode: string
  paymentTime: string | null
  transactionNo: string | null
  /** 订单登记接口返回原始凭证对象键；详情接口才返回带临时 URL 的附件视图。 */
  attachments: string[]
  createdBy: string | null
  createdTime: string | null
  updatedBy: string | null
  updatedTime: string | null
  syncedBy: string | null
  syncedAt: string | null
  checkedBy: string | null
  checkedAt: string | null
  revision: number
}

export interface OrderRegisterPaymentTotals {
  receivedAmount: number
  checkedAmount: number
  pendingDocumentAmount: number
  cancelledDocumentAmount: number
  relatedOrderAmount: number
}

export interface OrderRegisterPaymentPage {
  total: number
  begin: number
  step: number
  items: OrderRegisterPaymentItem[]
  totals: OrderRegisterPaymentTotals
  coverage: OrderRegisterCoverage | null
}

export type OrderPeriodGroupBy = 'region' | 'customer' | 'employee'

export interface OrderPeriodQuery {
  dateFrom: string
  dateTo: string
  groupBy?: OrderPeriodGroupBy
  customerId?: string | number
  customerName?: string
  customerCode?: string
  regionCode?: string
  ownerEmployeeCode?: string
  departmentId?: number
}

export interface OrderPeriodRow {
  key: string
  label: string
  periodOrderAmount: number
  periodReceivedAmount: number
  periodRefundAmount: number
  periodNetReceivedAmount: number
  endingUnpaidAmount: number
}

export interface OrderPeriodTotals {
  periodOrderAmount: number
  periodReceivedAmount: number
  periodRefundAmount: number
  periodNetReceivedAmount: number
  endingUnpaidAmount: number
}

export interface OrderPeriodView {
  dateFrom: string
  dateTo: string
  groupBy: OrderPeriodGroupBy
  totals: OrderPeriodTotals
  rows: OrderPeriodRow[]
  coverage: OrderRegisterCoverage | null
}

export interface OrderReceivablesQuery {
  asOfDate: string
  hasUnpaid?: boolean
  customerId?: string | number
  customerName?: string
  customerCode?: string
  regionCode?: string
  ownerEmployeeCode?: string
  departmentId?: number
  orderDateFrom?: string
  orderDateTo?: string
}

export interface OrderReceivablesRow {
  orderId: string
  orderNo: string
  customerId: string | null
  customerCode: string | null
  customerName: string | null
  regionCode: string | null
  regionName: string | null
  ownerEmployeeCode: string | null
  ownerEmployeeName: string | null
  departmentId: number | null
  departmentName: string | null
  orderDate: string
  receivableAmount: number | null
  netReceivedAmount: number | null
  unpaidAmount: number | null
  overpaidAmount: number | null
  historyComplete: boolean | null
  coverageFrom: string | null
}

export interface OrderReceivablesTotals {
  receivableAmount: number | null
  netReceivedAmount: number | null
  unpaidAmount: number | null
  overpaidAmount: number | null
}

export interface OrderReceivablesView {
  asOfDate: string
  totals: OrderReceivablesTotals
  items: OrderReceivablesRow[]
  coverage: OrderRegisterCoverage | null
}

const readOptions = { stayOnUnauthorized: true }

export const getOrderRegisterOrders = (params: OrderRegisterOrderQuery) =>
  apiClient.get<OrderRegisterOrderPage>(`${ORDER_REGISTER_BASE_PATH}/orders`, {
    params,
    ...readOptions,
  })

export const getOrderRegisterLines = (params: OrderRegisterLineQuery) =>
  apiClient.get<OrderRegisterLinePage>(`${ORDER_REGISTER_BASE_PATH}/lines`, {
    params,
    ...readOptions,
  })

export const getOrderRegisterPayments = (params: OrderRegisterPaymentQuery) =>
  apiClient.get<OrderRegisterPaymentPage>(`${ORDER_REGISTER_BASE_PATH}/payments`, {
    params,
    ...readOptions,
  })

export const getOrderRegisterPeriod = (params: OrderPeriodQuery) =>
  apiClient.get<OrderPeriodView>(`${ORDER_REGISTER_BASE_PATH}/statistics/period`, {
    params,
    ...readOptions,
  })

export const getOrderRegisterReceivables = (params: OrderReceivablesQuery) =>
  apiClient.get<OrderReceivablesView>(`${ORDER_REGISTER_BASE_PATH}/statistics/receivables`, {
    params,
    ...readOptions,
  })

/** 创建人下拉数据源；契约补充项，后端尚未实现时页面降级为空列表并提示。 */
export const getOrderRegisterCreators = () =>
  apiClient.get<string[]>(`${ORDER_REGISTER_BASE_PATH}/creators`, readOptions)

export type OrderRegisterExportKind = 'orders' | 'lines' | 'payments' | 'period' | 'receivables'

export function exportOrderRegisterCsv(
  kind: OrderRegisterExportKind,
  params: Record<string, unknown>,
) {
  const path = kind === 'period'
    ? `${ORDER_REGISTER_BASE_PATH}/statistics/period/export`
    : kind === 'receivables'
      ? `${ORDER_REGISTER_BASE_PATH}/statistics/receivables/export`
      : `${ORDER_REGISTER_BASE_PATH}/${kind}/export`
  return apiClient.get<Blob>(path, {
    params,
    responseType: 'blob',
    timeout: 180000,
    stayOnUnauthorized: true,
  })
}
