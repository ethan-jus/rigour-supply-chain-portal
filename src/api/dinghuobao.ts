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

export function getDinghuobaoOrders(params: DhbOrderQuery) {
  return apiClient.get<DhbOrderPage>(basePath, { params, ...orderRequestOptions })
}

export function getDinghuobaoOrderDetail(orderSn: string) {
  return apiClient.get<DhbOrderDetail>(`${basePath}/${encodeURIComponent(orderSn)}`, orderRequestOptions)
}
