import { apiClient } from './client'
import type { ErpInternalPage } from './erp-internal'

export interface ProcurementOrderSummary {
  id: string
  procurementNo: string
  supplierId: string
  supplierName: string
  targetWarehouseId: string
  targetWarehouseName: string
  statusCode: string
  expectedArrivalTime: string | null
  totalQuantity: number
  totalAmount: number
  lineCount: number
  revision: number
  updatedTime: string
}

export interface ProcurementOrderLine {
  id: string
  lineNo: number
  productId: string
  productVariantId: string
  productCode: string | null
  variantCode: string | null
  productName: string
  unitCode: string
  quantity: number
  unitPrice: number
  lineAmount: number
  receivedQuantity: number
  remark: string | null
}

export interface ProcurementOrderDetail extends ProcurementOrderSummary {
  lines: ProcurementOrderLine[]
  remark: string | null
  createdBy: string | null
  createdTime: string
  updatedBy: string | null
}

export interface ProcurementOrderLineCommand {
  productId: string | number
  productVariantId: string | number
  quantity: number
  unitPrice: number
  remark?: string | null
}

export interface ProcurementOrderCommand {
  submit?: boolean | null
  supplierId: string | number
  targetWarehouseId: string | number
  expectedArrivalTime?: string | null
  lines: ProcurementOrderLineCommand[]
  remark?: string | null
  revision?: number | null
}

export interface ProcurementStockInLineCommand {
  procurementOrderLineId: string | number
  quantity: number
  remark?: string | null
}

export interface ProcurementStockInCommand {
  procurementOrderId: string | number
  procurementRevision: number
  stockInTime?: string | null
  lines: ProcurementStockInLineCommand[]
  remark?: string | null
}

export interface StockInOrderSummary {
  id: string
  stockInNo: string
  stockInTypeCode: string
  procurementOrderId: string | null
  procurementNo: string | null
  transferOrderId: string | null
  transferOrderNo: string | null
  warehouseId: string
  warehouseName: string
  supplierId: string | null
  supplierName: string | null
  statusCode: string
  stockInTime: string | null
  totalQuantity: number
  totalAmount: number
  lineCount: number
  revision: number
  updatedTime: string
}

export interface StockInOrderLine {
  id: string
  lineNo: number
  procurementOrderLineId: string | null
  transferOrderLineId: string | null
  productId: string
  productVariantId: string
  productCode: string | null
  variantCode: string | null
  productName: string
  unitCode: string
  quantity: number
  unitPrice: number
  amount: number
  remark: string | null
}

export interface StockInOrderDetail extends StockInOrderSummary {
  lines: StockInOrderLine[]
  remark: string | null
  createdBy: string | null
  createdTime: string
  updatedBy: string | null
}

export interface StockOutOrderSummary {
  id: string
  stockOutNo: string
  stockOutTypeCode: string
  warehouseId: string
  warehouseName: string
  salesOrderId: string | null
  salesOrderNo: string | null
  transferOrderId: string | null
  transferOrderNo: string | null
  customerId: string | null
  customerNameSnapshot: string | null
  statusCode: string
  stockOutTime: string | null
  totalQuantity: number
  lineCount: number
  revision: number
  updatedTime: string
}

export interface StockOutOrderLine {
  id: string
  lineNo: number
  salesOrderLineId: string | null
  transferOrderLineId: string | null
  productId: string
  productVariantId: string
  productCodeSnapshot: string | null
  variantCodeSnapshot: string | null
  productNameSnapshot: string
  unitCode: string
  quantity: number
  remark: string | null
}

export interface StockOutOrderDetail extends StockOutOrderSummary {
  lines: StockOutOrderLine[]
  remark: string | null
  createdBy: string | null
  createdTime: string
  updatedBy: string | null
}

export interface TransferOrderSummary {
  id: string
  transferNo: string
  sourceWarehouseId: string
  sourceWarehouseName: string
  targetWarehouseId: string
  targetWarehouseName: string
  statusCode: string
  stockOutTime: string | null
  stockInTime: string | null
  stockOutOrderId: string | null
  stockOutNo: string | null
  stockInOrderId: string | null
  stockInNo: string | null
  totalQuantity: number
  lineCount: number
  revision: number
  updatedTime: string
}

export interface TransferOrderLine {
  id: string
  lineNo: number
  productId: string
  productVariantId: string
  productCode: string | null
  variantCode: string | null
  productName: string
  unitCode: string
  quantity: number
  remark: string | null
}

export interface TransferOrderDetail extends TransferOrderSummary {
  lines: TransferOrderLine[]
  remark: string | null
  createdBy: string | null
  createdTime: string
  updatedBy: string | null
}

export interface TransferOrderLineCommand {
  productId: string | number
  productVariantId: string | number
  quantity: number
  remark?: string | null
}

export interface TransferOrderCommand {
  sourceWarehouseId: string | number
  targetWarehouseId: string | number
  lines: TransferOrderLineCommand[]
  remark?: string | null
  revision?: number | null
}

export interface TransferStockOutCommand {
  revision: number
  stockOutTime?: string | null
  remark?: string | null
}

export interface TransferStockInCommand {
  revision: number
  stockInTime?: string | null
  remark?: string | null
}

export interface ProcurementOrderQuery {
  begin: number
  step: number
  procurementNo?: string
  supplierId?: string | number
  targetWarehouseId?: string | number
  statusCode?: string
  expectedArrivalFrom?: string
  expectedArrivalTo?: string
}

export interface StockInOrderQuery {
  begin: number
  step: number
  stockInNo?: string
  stockInTypeCode?: string
  procurementOrderId?: string | number
  warehouseId?: string | number
  supplierId?: string | number
  statusCode?: string
  stockInTimeFrom?: string
  stockInTimeTo?: string
}

export interface StockOutOrderQuery {
  begin: number
  step: number
  stockOutNo?: string
  stockOutTypeCode?: string
  warehouseId?: string | number
  salesOrderNo?: string
  transferOrderNo?: string
  customerName?: string
  statusCode?: string
  stockOutTimeFrom?: string
  stockOutTimeTo?: string
}

export interface TransferOrderQuery {
  begin: number
  step: number
  transferNo?: string
  sourceWarehouseId?: string | number
  targetWarehouseId?: string | number
  statusCode?: string
  stockOutTimeFrom?: string
  stockOutTimeTo?: string
}

const ERP_BASE_PATH = '/erp'
const options = { stayOnUnauthorized: true }

export const getProcurementOrders = (params: ProcurementOrderQuery) =>
  apiClient.get<ErpInternalPage<ProcurementOrderSummary>>(`${ERP_BASE_PATH}/procurement-orders`, { params, ...options })
export const getProcurementOrder = (id: string | number) =>
  apiClient.get<ProcurementOrderDetail>(`${ERP_BASE_PATH}/procurement-orders/${encodeURIComponent(String(id))}`, options)
export const createProcurementOrder = (command: ProcurementOrderCommand) =>
  apiClient.post<ProcurementOrderDetail>(`${ERP_BASE_PATH}/procurement-orders`, command, options)
export const updateProcurementOrder = (id: string | number, command: ProcurementOrderCommand) =>
  apiClient.put<ProcurementOrderDetail>(`${ERP_BASE_PATH}/procurement-orders/${encodeURIComponent(String(id))}`, command, options)
export const deleteProcurementOrder = (id: string | number, revision: number) =>
  apiClient.delete<void>(`${ERP_BASE_PATH}/procurement-orders/${encodeURIComponent(String(id))}`, { params: { revision }, ...options })

export const getStockInOrders = (params: StockInOrderQuery) =>
  apiClient.get<ErpInternalPage<StockInOrderSummary>>(`${ERP_BASE_PATH}/stock-in-orders`, { params, ...options })
export const getStockInOrder = (id: string | number) =>
  apiClient.get<StockInOrderDetail>(`${ERP_BASE_PATH}/stock-in-orders/${encodeURIComponent(String(id))}`, options)
export const confirmProcurementStockIn = (command: ProcurementStockInCommand) =>
  apiClient.post<StockInOrderDetail>(`${ERP_BASE_PATH}/stock-in-orders/procurement-confirmations`, command, options)

export const getStockOutOrders = (params: StockOutOrderQuery) =>
  apiClient.get<ErpInternalPage<StockOutOrderSummary>>(`${ERP_BASE_PATH}/stock-out-orders`, { params, ...options })
export const getStockOutOrder = (id: string | number) =>
  apiClient.get<StockOutOrderDetail>(`${ERP_BASE_PATH}/stock-out-orders/${encodeURIComponent(String(id))}`, options)

export const getTransferOrders = (params: TransferOrderQuery) =>
  apiClient.get<ErpInternalPage<TransferOrderSummary>>(`${ERP_BASE_PATH}/transfer-orders`, { params, ...options })
export const getTransferOrder = (id: string | number) =>
  apiClient.get<TransferOrderDetail>(`${ERP_BASE_PATH}/transfer-orders/${encodeURIComponent(String(id))}`, options)
export const createTransferOrder = (command: TransferOrderCommand) =>
  apiClient.post<TransferOrderDetail>(`${ERP_BASE_PATH}/transfer-orders`, command, options)
export const updateTransferOrder = (id: string | number, command: TransferOrderCommand) =>
  apiClient.put<TransferOrderDetail>(`${ERP_BASE_PATH}/transfer-orders/${encodeURIComponent(String(id))}`, command, options)
export const deleteTransferOrder = (id: string | number, revision: number) =>
  apiClient.delete<void>(`${ERP_BASE_PATH}/transfer-orders/${encodeURIComponent(String(id))}`, { params: { revision }, ...options })
export const confirmTransferStockOut = (id: string | number, command: TransferStockOutCommand) =>
  apiClient.post<TransferOrderDetail>(`${ERP_BASE_PATH}/transfer-orders/${encodeURIComponent(String(id))}/stock-out-confirmations`, command, options)
export const confirmTransferStockIn = (id: string | number, command: TransferStockInCommand) =>
  apiClient.post<TransferOrderDetail>(`${ERP_BASE_PATH}/transfer-orders/${encodeURIComponent(String(id))}/stock-in-confirmations`, command, options)
