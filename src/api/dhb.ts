import { apiClient } from './core'

export interface DhbOrder {
  orderSn: string
  deliveryDate: string | null
  orderRemark: string | null
  orderTotal: number | null
  orderStatus: string | null
  orderDate: string | null
  orderUpdateDate: string | null
  orderUpdateTime: string | null
  orderType: string | null
  orderApi: string | null
  orderException: string | null
  orderSendType: string | null
  lastOrderAt: string | null
  clientNo: string | null
  clientGuid: string | null
  sourceDevice: string | null
  isAdminOrder: string | null
  payStatus: string | null
  clientName: string | null
  receiveName: string | null
  receiveCompany: string | null
  receivePhone: string | null
  receiveAddress: string | null
  province: string | null
  city: string | null
  district: string | null
  splitType: string | null
  splitTypeName: string | null
  detailAvailable: boolean
  syncedAt: string | null
}

export interface DhbOrderLine {
  lineId: string | null
  productGuid: string | null
  skuNo: string | null
  optionsGoodsNum: string | null
  optionsBarcode: string | null
  productName: string | null
  coding: string | null
  multiFirst: string | null
  multiSecond: string | null
  multiName: string | null
  unitPrice: number | null
  quantity: number | null
  unit: string | null
  remark: string | null
}

export interface DhbShipment {
  shipmentNo: string | null
  status: string | null
  shipmentDate: string | null
  stockUpTime: string | null
}

export interface DhbOrderPage {
  total: number
  providerTotal: number
  synchronizedCount: number
  items: DhbOrder[]
}

export interface DhbOrderDetail {
  order: DhbOrder
  lines: DhbOrderLine[]
  shipments: DhbShipment[]
  synchronizedFromProvider: boolean
}

/** 发货/退货/收付款单的本地分页参数；begin为零基偏移，step范围1..1000。 */
export interface DhbDocumentQuery {
  begin: number
  step: number
  /** 订货宝来源状态原值；不传表示全部。 */
  status?: string
  /** 关联订货宝订单号；精确匹配。 */
  orderNo?: string
  /** 来源业务开始时间，格式yyyy-MM-dd或yyyy-MM-dd HH:mm:ss，含边界。 */
  from?: string
  /** 来源业务结束时间，格式yyyy-MM-dd或yyyy-MM-dd HH:mm:ss，含边界。 */
  to?: string
}

/** 本地单据分页；total为当前租户符合条件的总数。 */
export interface DhbDocumentPage<T> { total: number; items: T[] }

/** 独立发货单；status：shipped待发货、receivedin待收货、received已收货、cancelled已取消。 */
export interface DhbShipmentDocument {
  shipmentNo: string
  orderNo: string | null
  status: string | null
  statusName: string | null
  typeName: string | null
  customerNo: string | null
  customerName: string | null
  warehouseNo: string | null
  warehouseName: string | null
  shipmentAt: string | null
  logisticsName: string | null
  trackingNo: string | null
  remark: string | null
  detailAvailable: boolean
  syncedAt: string | null
}

/** 发货商品明细；数量、单价和金额沿用订货宝来源单位。 */
export interface DhbShipmentLine {
  lineId: string
  productGuid: string | null
  skuNo: string | null
  productCode: string | null
  productName: string | null
  quantity: number | null
  unitPrice: number | null
  amount: number | null
  unit: string | null
  warehouseNo: string | null
  remark: string | null
}

export interface DhbShipmentDetail { shipment: DhbShipmentDocument; lines: DhbShipmentLine[] }

/** 退货单；status：return_audit待审核、shipp_cust待客户发货、shipped待收货、refunded待退款、finished已完成、cancelled已取消。 */
export interface DhbReturnDocument {
  returnNo: string
  orderNo: string | null
  status: string | null
  returnAmount: number | null
  settlementAmount: number | null
  returnedAt: string | null
  reason: string | null
  customerNo: string | null
  consignee: string | null
  logisticsCompany: string | null
  logisticsNo: string | null
  detailAvailable: boolean
  syncedAt: string | null
}

/** 退货商品明细；confirmedQuantity/confirmedPrice为订货宝确认后的数量和价格。 */
export interface DhbReturnLine {
  lineId: string
  productGuid: string | null
  skuNo: string | null
  productCode: string | null
  productName: string | null
  quantity: number | null
  confirmedQuantity: number | null
  unitPrice: number | null
  confirmedPrice: number | null
  unit: string | null
  warehouseNo: string | null
  warehouseName: string | null
  remark: string | null
}

export interface DhbReturnDetail { returnDocument: DhbReturnDocument; lines: DhbReturnLine[] }

/** 收付款单；documentType为RECEIPT收款/PAYMENT付款，状态为待确认、已确认或已取消。 */
export interface DhbFinancialDocument {
  documentType: 'RECEIPT' | 'PAYMENT'
  documentNo: string
  relatedDocumentNo: string | null
  orderNo: string | null
  customerNo: string | null
  businessType: string | null
  paymentMethod: string | null
  amount: number | null
  status: string | null
  transactionAt: string | null
  serialNumber: string | null
  accountName: string | null
  bankName: string | null
  accountNumber: string | null
  remark: string | null
  syncedAt: string | null
}

export interface DhbOrderQuery {
  begin: number
  step: number
  order_status_val?: string
  starttime?: string
  endtime?: string
  updateGe?: string
  updateLe?: string
  exceptionStatus?: string
  apiStatus?: string
  payStatus?: string
  splitType?: number
}

const basePath = '/orders/dhb'
const orderRequestOptions = { stayOnUnauthorized: true }

export function getDhbOrders(params: DhbOrderQuery) {
  return apiClient.get<DhbOrderPage>(basePath, { params, ...orderRequestOptions })
}

export function getDhbOrderDetail(orderSn: string) {
  return apiClient.get<DhbOrderDetail>(`${basePath}/${encodeURIComponent(orderSn)}`, orderRequestOptions)
}

/** 查询订单中心已落库的独立发货单，不实时调用订货宝。 */
export function getDinghuobaoShipments(params: DhbDocumentQuery) {
  return apiClient.get<DhbDocumentPage<DhbShipmentDocument>>(`${basePath}/shipments`, { params, ...orderRequestOptions })
}

/** 按发货单号查询本地主信息和商品明细。 */
export function getDinghuobaoShipmentDetail(shipmentNo: string) {
  return apiClient.get<DhbShipmentDetail>(`${basePath}/shipments/${encodeURIComponent(shipmentNo)}`, orderRequestOptions)
}

/** 查询订单中心已落库的退货单，不实时调用订货宝。 */
export function getDinghuobaoReturns(params: DhbDocumentQuery) {
  return apiClient.get<DhbDocumentPage<DhbReturnDocument>>(`${basePath}/returns`, { params, ...orderRequestOptions })
}

/** 按退货单号查询本地主信息和商品明细。 */
export function getDinghuobaoReturnDetail(returnNo: string) {
  return apiClient.get<DhbReturnDetail>(`${basePath}/returns/${encodeURIComponent(returnNo)}`, orderRequestOptions)
}

/** 查询本地收款单；status可选pend_receipt、pend_receipted、canceled。 */
export function getDinghuobaoReceipts(params: DhbDocumentQuery) {
  return apiClient.get<DhbDocumentPage<DhbFinancialDocument>>(`${basePath}/receipts`, { params, ...orderRequestOptions })
}

/** 查询本地付款单；status可选pend_receipt、pend_receipted、canceled。 */
export function getDinghuobaoPayments(params: DhbDocumentQuery) {
  return apiClient.get<DhbDocumentPage<DhbFinancialDocument>>(`${basePath}/payments`, { params, ...orderRequestOptions })
}
