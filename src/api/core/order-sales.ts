import { apiClient } from './client'

export interface OrderPage<T> {
  total: number
  begin: number
  step: number
  items: T[]
}

export interface SalesOrderQuery {
  begin: number
  step: number
  orderNo?: string
  sourceOrderNo?: string
  customerName?: string
  contactPhone?: string
  regionCode?: string
  ownerSalesUserId?: string
  ownerStaffCode?: string
  orderStatusCode?: string
  paymentStatusCode?: string
  outboundStatusCode?: string
  orderDateFrom?: string
  orderDateTo?: string
}

export interface SalesOrderLineCommand {
  productId: string | number
  productVariantId: string | number
  productCodeSnapshot?: string | null
  skuCodeSnapshot?: string | null
  productNameSnapshot: string
  specificationSnapshot?: string | null
  unitCode: string
  quantity: number
  unitPrice: number
  discountRate?: number | null
  discountAmount?: number | null
  remark?: string | null
}

export interface SalesOrderCommand {
  customerId: string | number
  customerCodeSnapshot?: string | null
  customerNameSnapshot: string
  contactNameSnapshot?: string | null
  contactPhoneSnapshot?: string | null
  regionCode?: string | null
  ownerSalesUserId?: string | null
  ownerSalesName?: string | null
  ownerStaffCode?: string | null
  ownerStaffNameSnapshot?: string | null
  orderDate?: string | null
  orderTypeCode?: string | null
  paymentMethodCode?: string | null
  discountRate?: number | null
  discountAmount?: number | null
  remark?: string | null
  lines: SalesOrderLineCommand[]
  submit?: boolean
  revision?: number | null
}

export interface SalesOrderSummary {
  id: string
  orderNo: string
  sourceSystemCode: string | null
  sourceOrderNo: string | null
  customerId: string
  customerNameSnapshot: string
  contactPhoneSnapshot: string | null
  regionCode: string | null
  ownerSalesUserId: string | null
  ownerSalesName: string | null
  ownerStaffCode: string | null
  ownerStaffNameSnapshot: string | null
  orderDate: string
  orderStatusCode: string
  paymentStatusCode: string
  outboundStatusCode: string
  totalQuantity: number
  payableAmount: number
  paidAmount: number
  unpaidAmount: number
  revision: number
  updatedTime: string
}

export interface SalesOrderLineView {
  id: string
  lineNo: number
  productId: string
  productVariantId: string
  productCodeSnapshot: string | null
  skuCodeSnapshot: string | null
  productNameSnapshot: string
  specificationSnapshot: string | null
  unitCode: string
  quantity: number
  unitPrice: number
  discountRate: number | null
  discountAmount: number
  lineAmount: number
  remark: string | null
}

export interface SalesOrderDetail extends SalesOrderSummary {
  customerCodeSnapshot: string | null
  contactNameSnapshot: string | null
  orderTypeCode: string | null
  paymentMethodCode: string | null
  originalAmount: number
  discountRate: number | null
  discountAmount: number
  remark: string | null
  createdBy: string | null
  createdTime: string
  updatedBy: string | null
  lines: SalesOrderLineView[]
}

export interface SalesOrderStockOutCommand {
  warehouseId: string | number
  stockOutTime?: string | null
  remark?: string | null
  revision: number
}

export interface SalesOrderStockOutResult {
  stockOutOrderId: string
  stockOutNo: string
  stockOutTime: string
  salesOrder: SalesOrderDetail
}

export interface SalesShipmentQuery {
  begin: number
  step: number
  shipmentNo?: string
  salesOrderNo?: string
  customerName?: string
  trackingNo?: string
  shipmentStatusCode?: string
  shipTimeFrom?: string
  shipTimeTo?: string
}

export interface SalesShipmentSummary {
  id: string
  shipmentNo: string
  salesOrderId: string | null
  salesOrderNoSnapshot: string | null
  customerId: string | null
  customerCodeSnapshot: string | null
  customerNameSnapshot: string | null
  contactPhoneSnapshot: string | null
  regionCode: string | null
  ownerStaffCode: string | null
  warehouseId: string | null
  stockOutOrderId: string | null
  stockOutNo: string | null
  shipmentStatusCode: string
  logisticsCompany: string | null
  trackingNo: string | null
  shipTime: string | null
  totalQuantity: number
  revision: number
  updatedTime: string
}

export interface SalesShipmentLineView {
  id: string
  salesOrderLineId: string | null
  lineNo: number
  productId: string | null
  productVariantId: string | null
  productCodeSnapshot: string | null
  skuCodeSnapshot: string | null
  productNameSnapshot: string | null
  specificationSnapshot: string | null
  unitCode: string | null
  shippedQuantity: number
  remark: string | null
}

export interface SalesShipmentDetail extends SalesShipmentSummary {
  remark: string | null
  createdBy: string | null
  createdTime: string
  updatedBy: string | null
  lines: SalesShipmentLineView[]
}

export interface SalesPaymentQuery {
  begin: number
  step: number
  paymentNo?: string
  salesOrderNo?: string
  customerName?: string
  collectorStaffCode?: string
  paymentMethodCode?: string
  paymentTimeFrom?: string
  paymentTimeTo?: string
}

export interface SalesPaymentSummary {
  id: string
  paymentNo: string
  orderId: string
  salesOrderNoSnapshot: string | null
  customerId: string | null
  customerCodeSnapshot: string | null
  customerNameSnapshot: string | null
  collectorStaffCode: string | null
  collectorNameSnapshot: string | null
  paymentTime: string
  paymentMethodCode: string | null
  paidAmount: number
  revision: number
  updatedTime: string
}

export interface SalesPaymentDetail extends SalesPaymentSummary {
  voucherKeys: string[]
  remark: string | null
  createdBy: string | null
  createdTime: string
  updatedBy: string | null
}

export interface SalesRefundQuery {
  begin: number
  step: number
  refundNo?: string
  salesOrderNo?: string
  customerName?: string
  refundStaffCode?: string
  refundMethodCode?: string
  refundStatusCode?: string
  refundTimeFrom?: string
  refundTimeTo?: string
}

export interface SalesRefundSummary {
  id: string
  refundNo: string
  orderId: string
  salesOrderNoSnapshot: string | null
  customerId: string | null
  customerCodeSnapshot: string | null
  customerNameSnapshot: string | null
  refundStaffCode: string | null
  refundStaffNameSnapshot: string | null
  refundTime: string
  refundMethodCode: string | null
  refundStatusCode: string
  refundAmount: number
  revision: number
  updatedTime: string
}

export interface SalesRefundDetail extends SalesRefundSummary {
  voucherKeys: string[]
  remark: string | null
  createdBy: string | null
  createdTime: string
  updatedBy: string | null
}

export interface FundDocumentQuery {
  begin: number
  step: number
  directionCode?: string
  documentNo?: string
  salesOrderNo?: string
  counterpartyName?: string
  handlerStaffCode?: string
  settlementMethodCode?: string
  businessTypeCode?: string
  documentStatusCode?: string
  occurredTimeFrom?: string
  occurredTimeTo?: string
}

export interface FundDocumentSummary {
  id: string
  documentNo: string
  directionCode: string
  relatedOrderId: string | null
  salesOrderNoSnapshot: string | null
  customerId: string | null
  customerCodeSnapshot: string | null
  customerNameSnapshot: string | null
  counterpartyTypeCode: string | null
  counterpartyCodeSnapshot: string | null
  counterpartyNameSnapshot: string | null
  handlerStaffCode: string | null
  handlerStaffNameSnapshot: string | null
  occurredTime: string
  settlementMethodCode: string | null
  businessTypeCode: string | null
  documentStatusCode: string
  amount: number
  revision: number
  updatedTime: string
}

export interface FundDocumentDetail extends FundDocumentSummary {
  voucherKeys: string[]
  remark: string | null
  createdBy: string | null
  createdTime: string
  updatedBy: string | null
}

const ORDER_BASE_PATH = '/orders/sales'
const ORDER_SHIPMENT_BASE_PATH = '/orders/sales-shipments'
const ORDER_PAYMENT_BASE_PATH = '/orders/sales-payments'
const ORDER_REFUND_BASE_PATH = '/orders/sales-refunds'
const ORDER_FUND_DOCUMENT_BASE_PATH = '/orders/fund-documents'
const options = { stayOnUnauthorized: true }

export const getSalesOrders = (params: SalesOrderQuery) =>
  apiClient.get<OrderPage<SalesOrderSummary>>(ORDER_BASE_PATH, { params, ...options })

export const getSalesOrder = (id: string | number) =>
  apiClient.get<SalesOrderDetail>(`${ORDER_BASE_PATH}/${encodeURIComponent(String(id))}`, options)

export const createSalesOrder = (command: SalesOrderCommand) =>
  apiClient.post<SalesOrderDetail>(ORDER_BASE_PATH, command, options)

export const updateSalesOrder = (id: string | number, command: SalesOrderCommand) =>
  apiClient.put<SalesOrderDetail>(`${ORDER_BASE_PATH}/${encodeURIComponent(String(id))}`, command, options)

export const submitSalesOrder = (id: string | number, revision: number) =>
  apiClient.post<SalesOrderDetail>(`${ORDER_BASE_PATH}/${encodeURIComponent(String(id))}/submissions`, null, {
    params: { revision },
    ...options,
  })

export const cancelSalesOrder = (id: string | number, revision: number) =>
  apiClient.post<SalesOrderDetail>(`${ORDER_BASE_PATH}/${encodeURIComponent(String(id))}/cancellations`, null, {
    params: { revision },
    ...options,
  })

export const confirmSalesOrderStockOut = (id: string | number, command: SalesOrderStockOutCommand) =>
  apiClient.post<SalesOrderStockOutResult>(
    `${ORDER_BASE_PATH}/${encodeURIComponent(String(id))}/stock-out-confirmations`,
    command,
    options,
  )

export const deleteSalesOrder = (id: string | number, revision: number) =>
  apiClient.delete<void>(`${ORDER_BASE_PATH}/${encodeURIComponent(String(id))}`, {
    params: { revision },
    ...options,
  })

export const getSalesShipments = (params: SalesShipmentQuery) =>
  apiClient.get<OrderPage<SalesShipmentSummary>>(ORDER_SHIPMENT_BASE_PATH, { params, ...options })

export const getSalesShipment = (id: string | number) =>
  apiClient.get<SalesShipmentDetail>(`${ORDER_SHIPMENT_BASE_PATH}/${encodeURIComponent(String(id))}`, options)

export const deleteSalesShipment = (id: string | number, revision: number) =>
  apiClient.delete<void>(`${ORDER_SHIPMENT_BASE_PATH}/${encodeURIComponent(String(id))}`, {
    params: { revision },
    ...options,
  })

export const getSalesPayments = (params: SalesPaymentQuery) =>
  apiClient.get<OrderPage<SalesPaymentSummary>>(ORDER_PAYMENT_BASE_PATH, { params, ...options })

export const getSalesPayment = (id: string | number) =>
  apiClient.get<SalesPaymentDetail>(`${ORDER_PAYMENT_BASE_PATH}/${encodeURIComponent(String(id))}`, options)

export const deleteSalesPayment = (id: string | number, revision: number) =>
  apiClient.delete<void>(`${ORDER_PAYMENT_BASE_PATH}/${encodeURIComponent(String(id))}`, {
    params: { revision },
    ...options,
  })

export const getSalesRefunds = (params: SalesRefundQuery) =>
  apiClient.get<OrderPage<SalesRefundSummary>>(ORDER_REFUND_BASE_PATH, { params, ...options })

export const getSalesRefund = (id: string | number) =>
  apiClient.get<SalesRefundDetail>(`${ORDER_REFUND_BASE_PATH}/${encodeURIComponent(String(id))}`, options)

export const deleteSalesRefund = (id: string | number, revision: number) =>
  apiClient.delete<void>(`${ORDER_REFUND_BASE_PATH}/${encodeURIComponent(String(id))}`, {
    params: { revision },
    ...options,
  })

export const getFundDocuments = (params: FundDocumentQuery) =>
  apiClient.get<OrderPage<FundDocumentSummary>>(ORDER_FUND_DOCUMENT_BASE_PATH, { params, ...options })

export const getFundDocument = (id: string | number) =>
  apiClient.get<FundDocumentDetail>(`${ORDER_FUND_DOCUMENT_BASE_PATH}/${encodeURIComponent(String(id))}`, options)

export const deleteFundDocument = (id: string | number, revision: number) =>
  apiClient.delete<void>(`${ORDER_FUND_DOCUMENT_BASE_PATH}/${encodeURIComponent(String(id))}`, {
    params: { revision },
    ...options,
  })
