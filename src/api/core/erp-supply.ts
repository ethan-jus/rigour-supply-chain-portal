import { apiClient } from './client'
import type { ErpPage } from './erp-product'

export type ErpSupplyObjectType =
  | 'SUPPLIER'
  | 'PURCHASE_ORDER'
  | 'PURCHASE_RETURN'
  | 'WAREHOUSING_RECEIPT'
  | 'WAREHOUSE'
  | 'INVENTORY'

export interface ErpSupplyQuery {
  begin: number
  step: number
  q?: string
  status?: string
  /** 库存查询支持逗号分隔的多个仓库编码。 */
  warehouseCode?: string
}

export interface ErpSupplierView {
  id: string
  sourceSupplierId: string | null
  sourceSupplierGuid: string | null
  supplierCode: string
  name: string
  areaName: string | null
  address: string | null
  contactName: string | null
  mobile: string | null
  phone: string | null
  email: string | null
  accountName: string | null
  bankName: string | null
  bankAccount: string | null
  invoiceTitle: string | null
  taxpayerNumber: string | null
  remark: string | null
  sourceUpdatedAt: string | null
  syncedAt: string | null
}

export interface ErpWarehouseView {
  id: string
  sourceWarehouseId: string | null
  sourceWarehouseGuid: string | null
  warehouseCode: string
  name: string
  sourceStatus: string | null
  sourceStatusCode: string | null
  defaultFlag: boolean
  acreage: number | null
  phone: string | null
  address: string | null
  collaboratorSourceId: string | null
  remark: string | null
  internalStatus: string
  ownershipState: string
  syncedAt: string | null
}

export interface ErpPurchaseOrderView {
  id: string
  sourcePurchaseId: string | null
  purchaseOrderNo: string
  supplierSourceId: string | null
  supplierCode: string | null
  supplierName: string | null
  warehouseCode: string | null
  warehouseName: string | null
  warehouseSourceId: string | null
  staffSourceId: string | null
  staffName: string | null
  sourceStatus: string | null
  sourceStatusName: string | null
  paymentStatus: string | null
  paymentStatusName: string | null
  internalStatus: string
  totalAmount: number
  paidAmount: number
  goodsCount: number
  downloaded: boolean | null
  remark: string | null
  internalCommunication: string | null
  deliveryAt: string | null
  sourceCreatedAt: string | null
  sourceUpdatedAt: string | null
  lineCount: number
  syncedAt: string | null
}

export interface ErpPurchaseOrderLineView {
  sourceLineId: string | null
  sourceGoodsId: string | null
  sourceGoodsGuid: string | null
  goodsCode: string | null
  goodsName: string | null
  optionsId: string | null
  optionsGoodsCode: string | null
  optionsSummary: string | null
  baseQuantity: number
  unitPrice: number
  purchaseUnitCode: string | null
  purchaseUnitName: string | null
  purchaseUnitQuantity: number
  warehousedQuantity: number
  returnedQuantity: number
  remark: string | null
  sourceFields: Record<string, unknown>
}

export interface ErpPurchaseOrderDetailView {
  erpId: string
  sourceId: string | null
  number: string
  supplierSourceId: string | null
  supplierCode: string | null
  supplierName: string | null
  warehouseSourceId: string | null
  warehouseCode: string | null
  warehouseName: string | null
  staffSourceId: string | null
  staffName: string | null
  sourceStatus: string | null
  sourceStatusName: string | null
  paymentStatus: string | null
  paymentStatusName: string | null
  deliveryAt: string | null
  sourceCreatedAt: string | null
  sourceUpdatedAt: string | null
  totalAmount: number
  paidAmount: number
  goodsCount: number
  downloaded: boolean | null
  remark: string | null
  internalCommunication: string | null
  sourceFields: Record<string, unknown>
  lines: ErpPurchaseOrderLineView[]
}

export interface ErpPurchaseReturnView {
  id: string
  sourceReturnId: string | null
  purchaseReturnNo: string
  supplierSourceId: string | null
  supplierCode: string | null
  supplierName: string | null
  warehouseCode: string | null
  warehouseName: string | null
  warehouseSourceId: string | null
  staffSourceId: string | null
  staffName: string | null
  sourceStatus: string | null
  sourceStatusName: string | null
  internalStatus: string
  returnAmount: number
  discountAmount: number
  reason: string | null
  sourceCreatedAt: string | null
  sendAt: string | null
  internalCommunication: string | null
  remark: string | null
  detailCount: number | null
  contactName: string | null
  contactPhone: string | null
  contactAddress: string | null
  cityIds: string[]
  cityNames: string[]
  sourceDevice: string | null
  parentReturnSourceId: string | null
  parentCompanySourceId: string | null
  downloaded: boolean | null
  lineCount: number
  syncedAt: string | null
}

export interface ErpPurchaseReturnLineView {
  sourceLineId: string | null
  sourceGoodsId: string | null
  goodsCode: string | null
  goodsName: string | null
  optionsId: string | null
  optionsGoodsCode: string | null
  optionsSummary: string | null
  requestedQuantity: number
  confirmedQuantity: number
  returnPrice: number
  confirmedPrice: number
  unitCode: string | null
  unitName: string | null
  unitQuantity: number
  confirmedUnitQuantity: number
  conversionNumber: number
  amount: number
  costPrice: number
  purchaseOrderNo: string | null
  categoryName: string | null
  brandName: string | null
  remark: string | null
  sourceFields: Record<string, unknown>
}

export interface ErpPurchaseReturnDetailView {
  erpId: string
  sourceId: string | null
  number: string
  supplierSourceId: string | null
  supplierCode: string | null
  supplierName: string | null
  warehouseSourceId: string | null
  warehouseCode: string | null
  warehouseName: string | null
  staffSourceId: string | null
  staffName: string | null
  sourceStatus: string | null
  sourceStatusName: string | null
  returnAmount: number
  discountAmount: number
  reason: string | null
  sourceCreatedAt: string | null
  sendAt: string | null
  internalCommunication: string | null
  remark: string | null
  detailCount: number | null
  contactName: string | null
  contactPhone: string | null
  contactAddress: string | null
  cityIds: string[]
  cityNames: string[]
  sourceDevice: string | null
  parentReturnSourceId: string | null
  parentCompanySourceId: string | null
  downloaded: boolean | null
  sourceFields: Record<string, unknown>
  lines: ErpPurchaseReturnLineView[]
}

export interface ErpWarehousingReceiptView {
  id: string
  sourceWarehousingId: string | null
  warehousingNo: string
  warehouseSourceId: string | null
  warehouseName: string | null
  supplierSourceId: string | null
  supplierName: string | null
  typeId: string | null
  typeName: string | null
  sourceStatus: string | null
  sourceStatusName: string | null
  internalStatus: string
  staffName: string | null
  clientSourceId: string | null
  accountSourceId: string | null
  collaboratorSourceId: string | null
  collaboratorName: string | null
  logisticsSourceId: string | null
  expressNumber: string | null
  totalAmount: number
  costAmount: number
  freightAmount: number
  storageAt: string | null
  sourceCreatedAt: string | null
  sourceUpdatedAt: string | null
  remark: string | null
  apiFlag: boolean | null
  splitType: string | null
  lineCount: number
  syncedAt: string | null
}

export interface ErpWarehousingLineView {
  sourceLineId: string | null
  sourceGoodsId: string | null
  goodsCode: string | null
  goodsName: string | null
  optionsId: string | null
  optionsGoodsCode: string | null
  optionsSummary: string | null
  baseQuantity: number
  unitQuantity: number
  unitCode: string | null
  unitName: string | null
  conversionNumber: number
  costPrice: number
  unitCostPrice: number
  purchasePrice: number
  wholesalePrice: number
  allocation: string | null
  barcode: string | null
  goodsModel: string | null
  sourceRealQuantity: number | null
  sourceAvailableQuantity: number | null
  collaboratorSourceId: string | null
  collaboratorName: string | null
  remark: string | null
  sourceFields: Record<string, unknown>
}

export interface ErpPurchaseLinkView {
  sourcePurchaseId: string | null
  purchaseOrderNo: string | null
}

export interface ErpWarehousingReceiptDetailView {
  erpId: string
  sourceId: string | null
  number: string
  warehouseSourceId: string | null
  warehouseName: string | null
  supplierSourceId: string | null
  supplierName: string | null
  typeId: string | null
  typeName: string | null
  sourceStatus: string | null
  sourceStatusName: string | null
  staffName: string | null
  clientSourceId: string | null
  accountSourceId: string | null
  collaboratorSourceId: string | null
  collaboratorName: string | null
  logisticsSourceId: string | null
  expressNumber: string | null
  storageAt: string | null
  sourceCreatedAt: string | null
  sourceUpdatedAt: string | null
  freightAmount: number
  totalAmount: number
  costAmount: number
  apiFlag: boolean | null
  splitType: string | null
  remark: string | null
  sourceFields: Record<string, unknown>
  lines: ErpWarehousingLineView[]
  purchaseLinks: ErpPurchaseLinkView[]
}

export interface ErpInventoryBalanceView {
  id: string
  warehouseCode: string | null
  warehouseName: string | null
  goodsCode: string | null
  goodsName: string | null
  optionSummary: string
  realQuantity: number
  availableQuantity: number
  reservedQuantity: number
  inTransitQuantity: number
  calculationOrigin: string
  syncedAt: string | null
}

const ERP_BASE_PATH = '/erp'
const options = { stayOnUnauthorized: true }

export const getErpSuppliers = (params: ErpSupplyQuery) =>
  apiClient.get<ErpPage<ErpSupplierView>>(`${ERP_BASE_PATH}/suppliers`, { params, ...options })
export const getErpPurchaseOrders = (params: ErpSupplyQuery) =>
  apiClient.get<ErpPage<ErpPurchaseOrderView>>(`${ERP_BASE_PATH}/purchase-orders`, { params, ...options })
export const getErpPurchaseOrder = (id: string) =>
  apiClient.get<ErpPurchaseOrderDetailView>(`${ERP_BASE_PATH}/purchase-orders/${encodeURIComponent(id)}`, options)
export const getErpPurchaseReturns = (params: ErpSupplyQuery) =>
  apiClient.get<ErpPage<ErpPurchaseReturnView>>(`${ERP_BASE_PATH}/purchase-returns`, { params, ...options })
export const getErpPurchaseReturn = (id: string) =>
  apiClient.get<ErpPurchaseReturnDetailView>(`${ERP_BASE_PATH}/purchase-returns/${encodeURIComponent(id)}`, options)
export const getErpWarehousingReceipts = (params: ErpSupplyQuery) =>
  apiClient.get<ErpPage<ErpWarehousingReceiptView>>(`${ERP_BASE_PATH}/warehousing-receipts`, { params, ...options })
export const getErpWarehousingReceipt = (id: string) =>
  apiClient.get<ErpWarehousingReceiptDetailView>(`${ERP_BASE_PATH}/warehousing-receipts/${encodeURIComponent(id)}`, options)
export const getErpWarehouses = (params: ErpSupplyQuery) =>
  apiClient.get<ErpPage<ErpWarehouseView>>(`${ERP_BASE_PATH}/warehouses`, { params, ...options })
export const getErpInventoryBalances = (params: ErpSupplyQuery) =>
  apiClient.get<ErpPage<ErpInventoryBalanceView>>(`${ERP_BASE_PATH}/inventory-balances`, { params, ...options })
