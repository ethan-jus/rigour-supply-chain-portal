import { apiClient } from './client'
import type { SupplyDashboardQuery } from './bi'

export type CityProductAllocationMode = 'EXACT_ONLY' | 'PROPORTIONAL'
export type ReportDecimal = number | string | null
export interface CityProductUnitQuantity {
  unitCode: string | null
  quantity: ReportDecimal
}
export interface CityProductReportQuery extends SupplyDashboardQuery {
  allocationMode?: CityProductAllocationMode
  brandId?: string | number
  productId?: string | number
  skuId?: string | number
}

/** Mirrors analytics-bi-api CityProductReportView; decimal strings retain supplied precision. */
export interface CityProductReportRow {
  regionCode: string | null
  regionName: string | null
  categoryId: string | null
  categoryCode: string | null
  categoryName: string | null
  productId: string | null
  productCode: string | null
  productName: string | null
  specification?: string | null
  brandId?: string | null
  brandName?: string | null
  skuId: string | null
  skuCode: string | null
  unitCode: string | null
  quantity: ReportDecimal
  quantities: CityProductUnitQuantity[]
  salesAmount: ReportDecimal
  salesNetAmount: ReportDecimal
  refundAmount: ReportDecimal
  receivableAmount: ReportDecimal
  /** Attributable receipts, including allocatedPaidAmount; null is not zero. */
  paidAmount: ReportDecimal
  allocatedPaidAmount: ReportDecimal
  allocationStatus: string | null
  unallocatedOrderCount: number
  orderCount: number
  customerCount: number
  sample?: boolean
}

export interface CityProductOrderTrace {
  orderId: string
  orderNo: string | null
  sourceOrderNo: string | null
  sourceSystemCode: string | null
  regionCode: string | null
  regionName: string | null
  ownerStaffCode: string | null
  customerId: string | null
  customerName?: string | null
  ownerStaffName?: string | null
  orderDate: string | null
  lineCount: number
  selectedLineCount: number
  total: ReportDecimal
  lineTotal: ReportDecimal
  selectedLineTotal: ReportDecimal
  orderAdjustmentAmount: ReportDecimal
  paid: ReportDecimal
  unpaid: ReportDecimal
  selectedReceivableAmount: ReportDecimal
  selectedPaidAmount: ReportDecimal
  allocatedPaidAmount: ReportDecimal
  excludedPaidAmount: ReportDecimal
  unallocatedPaidAmount: ReportDecimal
  status: string | null
  categoryStatus: string | null
  sample?: boolean
}

export interface CityProductReportSummary {
  orderCount: number
  customerCount: number
  unallocatedOrderCount: number
  categoryPaidAmount: ReportDecimal
  unallocatedCategoryOrderCount: number
  quantities: CityProductUnitQuantity[]
  salesAmount: ReportDecimal
  salesNetAmount: ReportDecimal
  refundAmount: ReportDecimal
  orderPayableAmount: ReportDecimal
  orderPaidAmount: ReportDecimal
  orderUnpaidAmount: ReportDecimal
  receivableAmount: ReportDecimal
  paidAmount: ReportDecimal
  allocatedPaidAmount: ReportDecimal
  excludedPaidAmount: ReportDecimal
  unallocatedPaidAmount: ReportDecimal
  sample?: boolean
}

export interface CityProductReportView {
  from: string
  to: string
  generatedAt?: string | null
  dataUpdatedAt?: string | null
  allocationMode: CityProductAllocationMode
  rows: CityProductReportRow[]
  categoryRows: CityProductReportRow[]
  orderTrace: CityProductOrderTrace[]
  summary: CityProductReportSummary | null
  truncated: boolean
  exportBlocked: boolean
  definitions: string[]
  /** Available after the monthly-report API upgrade; absence is not an empty month. */
  monthlyRows?: { month: string; metrics: CityProductReportRow }[]
  customerArchives?: {
    regionCode: string | null
    regionName: string | null
    customerCount: number
  }[]
  sample?: boolean
}

export const getCityProductReport = (query: CityProductReportQuery) =>
  apiClient.get<CityProductReportView, CityProductReportView>(
    '/analytics/supply/dashboard/city-product-report',
    {
      params: { ...query, allocationMode: query.allocationMode ?? 'EXACT_ONLY' },
      stayOnUnauthorized: true,
    },
  )

export interface CityProductSupplyQuery {
  from: string
  to: string
  productId: string
  warehouseId: string
  skuId?: string
}
export interface CityProductSupplyView {
  generatedAt: string
  from: string
  to: string
  inventoryStatus: {
    status: 'FRESH' | 'STALE' | 'FAILED' | 'RUNNING' | 'UNAVAILABLE'
    lastSuccessAt: string | null
  }
  operationStatus: CityProductSupplyView['inventoryStatus']
  stocks: {
    warehouseId: string
    warehouseName: string | null
    warehouseRegionCode: string | null
    productId: string
    productName: string | null
    skuId: string | null
    specification: string | null
    unitCode: string | null
    availableQuantity: ReportDecimal
    lockedQuantity: ReportDecimal
    inTransitQuantity: ReportDecimal
    syncedAt: string | null
  }[]
  operations: {
    productId: string
    skuId: string | null
    unitCode: string | null
    month: string
    procurementQuantity: ReportDecimal
    shippedQuantity: ReportDecimal
    syncedAt: string | null
  }[]
  truncated: boolean
}
export const getCityProductSupply = (query: CityProductSupplyQuery) =>
  apiClient.get<CityProductSupplyView, CityProductSupplyView>(
    '/analytics/supply/dashboard/city-product-report/supply',
    { params: query, stayOnUnauthorized: true },
  )
