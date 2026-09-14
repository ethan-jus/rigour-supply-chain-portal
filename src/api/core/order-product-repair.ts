import { apiClient } from './client'
import type { SalesOrderLineView } from './order-sales'
import type { ErpManagedProductDetail, ErpManagedProductSummary, ErpPage } from './erp-product'

export interface RepairSourceContext {
  sourceNamespace: string
  sourceCaptureRef: string
  sourceProductRecordId?: string
  sourceProductCode?: string
  lineId?: string
  sourceOrderNo?: string
}

export interface RepairLineCommand {
  lineId: string | number
  productCode?: string
  skuCode?: string
  bindingEvidence?: string
  sourceNamespace?: string
  sourceCaptureRef?: string
  sourceProductRecordId?: string
  sourceProductCode?: string
  sourceEvidence?: string
  confirmSourceIdentity?: boolean
  historicalTransactionUnitCode?: string
  transactionUnitEvidence?: string
  confirmHistoricalTransactionUnit?: boolean
  standardQuantity?: string | number
  standardUnitCode?: string
  conversionFactor?: string | number
  conversionEvidence?: string
  confirmHistoricalConversion?: boolean
}

export interface RepairCandidate {
  productId: string | number
  productVariantId: string | number
  productCode: string
  skuCode: string
  productName: string
  specification: string | null
  unitCode: string
  productRevision: number
  variantRevision: number
  productUpdatedTime: string | null
  variantUpdatedTime: string | null
}

export interface RepairLinePreview {
  original: SalesOrderLineView
  lineRevision: number
  requested: RepairLineCommand
  candidates: RepairCandidate[]
  proposed: RepairCandidate | null
  sourceIdentityStatus: 'UNVERIFIED' | 'OPERATOR_CONFIRMED'
  transactionUnitStatus: 'UNVERIFIED' | 'OPERATOR_CONFIRMED'
  blockers: string[]
}

export interface RepairPreview {
  previewId: string
  orderId: string | number
  orderNo: string
  expectedRevision: number
  status: 'READY' | 'BLOCKED'
  expiresAt: string
  reason: string
  createdBy: string
  createdAt: string
  lines: RepairLinePreview[]
}

export interface RepairApplied {
  previewId: string
  orderId: string | number
  revision: number
  appliedBy: string
  appliedAt: string
  lines: RepairLinePreview[]
}

export interface RepairContext {
  orderId: string | number
  orderNo: string
  sourceOrderNo: string | null
  revision: number
  lines: { original: SalesOrderLineView; revision: number; repair: RepairApplied | null }[]
  recentRepairs: RepairApplied[]
}

const path = (id: string | number) => `/orders/sales/${encodeURIComponent(String(id))}/product-repairs`
const options = { stayOnUnauthorized: true }

export const getOrderProductRepair = (id: string | number) =>
  apiClient.get<RepairContext, RepairContext>(path(id), options)

export const previewOrderProductRepair = (
  id: string | number,
  command: { revision: number; reason: string; lines: RepairLineCommand[] },
) => apiClient.post<RepairPreview, RepairPreview>(`${path(id)}/previews`, command, options)

export const applyOrderProductRepair = (id: string | number, previewId: string) =>
  apiClient.post<RepairApplied, RepairApplied>(`${path(id)}/${encodeURIComponent(previewId)}/apply`, { confirm: true }, options)

export const getRepairProducts = (productName?: string) =>
  apiClient.get<ErpPage<ErpManagedProductSummary>, ErpPage<ErpManagedProductSummary>>('/erp/product-management/products', {
    params: { begin: 0, step: 50, productName }, ...options,
  })

export const getRepairProduct = (id: string) =>
  apiClient.get<ErpManagedProductDetail, ErpManagedProductDetail>(`/erp/product-management/products/${encodeURIComponent(id)}`, options)
