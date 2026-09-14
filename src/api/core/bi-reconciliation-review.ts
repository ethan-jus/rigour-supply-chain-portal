import { apiClient } from './client'

export type ReviewDecimal = string | number | null
export type ReconciliationUnitEvidence =
  'EXPLICIT' | 'COLUMN_INFERRED' | 'UNKNOWN' | 'SYSTEM' | 'MIXED' | 'OPERATOR_CONFIRMED'
export type ReconciliationAssociationEvidence =
  | 'SOURCE_RECORD'
  | 'SOURCE_CODE'
  | 'EXACT_NAME_SPEC'
  | 'UNLINKED'
  | 'SYSTEM'
  | 'MIXED'
  | 'OPERATOR_CONFIRMED'
export interface ReconciliationVersion {
  batchId: string
  fileName: string
  checksum: string
  sourceUrl: string | null
  uploadedAt: string
  importStatus: string
  rowCount: number
  onlineEvidence?: {
    captureId?: string
    sourceId: string
    startedAt: string
    completedAt: string
    complete: boolean
    filtered: boolean
    pageCount: number
    recordCount: number
    atomic: boolean
  } | null
}
export interface ReconciliationFact {
  confirmedUnitCode?: string | null
  key: string
  orderNo: string | null
  kind: 'ORDER' | 'SKU'
  city: string | null
  sales: string | null
  customer: string | null
  product: string | null
  specification: string | null
  unit: string | null
  rawUnit?: string | null
  unitCode?: string | null
  systemLineId?: string | null
  unitEvidence?: ReconciliationUnitEvidence | null
  associationEvidence?: ReconciliationAssociationEvidence | null
  sourceRecordId?: string | null
  sourceProductId?: string | null
  sourceProductCode?: string | null
  orderDate: string | null
  amount: ReviewDecimal
  paid: ReviewDecimal
  unpaid: ReviewDecimal
  quantity: ReviewDecimal
  updatedAt: string | null
  sourceRows: string | null
  excludedRefund: boolean
  uncertainties: string[]
}
export interface ReconciliationRow {
  key: string
  orderNo: string | null
  kind: 'ORDER' | 'SKU'
  city: string | null
  sales: string | null
  status: string
  financialStatus?: string | null
  quantityStatus?: string | null
  associationStatus?: string | null
  versionStatus: string
  source: ReconciliationFact | null
  business: ReconciliationFact | null
  bi: ReconciliationFact | null
  previous: ReconciliationFact | null
  issues: string[]
}
export interface ReconciliationSummary {
  count: number
  matched: number
  differences: number
  unverified: number
  excluded: number
  sourceAmount: ReviewDecimal
  businessAmount: ReviewDecimal
  biAmount: ReviewDecimal
  sourcePaid: ReviewDecimal
  businessPaid: ReviewDecimal
  biPaid: ReviewDecimal
}
export interface ReconciliationPage {
  id: string
  from: string
  to: string
  capturedAt: string
  completedAt: string
  sourceVersion: ReconciliationVersion
  previousVersion: ReconciliationVersion | null
  onlineStatus: string
  status: string
  sourceDeclaredComplete: boolean
  sourceExportedAt: string | null
  notices: string[]
  summary: ReconciliationSummary
  cities: { name: string; summary: ReconciliationSummary }[]
  sales: { name: string; summary: ReconciliationSummary }[]
  total: number
  page: number
  pageSize: number
  rows: ReconciliationRow[]
}
export interface ReconciliationCommand {
  batchId?: string
  onlineCaptureId?: string
  previousBatchId?: string
  from: string
  to: string
  sourceExportedAt?: string
  sourceDeclaredComplete: boolean
}
export interface OnlineReconciliationSource {
  id: string
  name: string
  filtered: boolean
}
export interface OnlineReconciliationCapture {
  id: string
  sourceId: string
  sourceName: string
  sourceUrl: string
  startedAt: string
  completedAt: string
  complete: boolean
  filtered: boolean
  checksum: string
  recordCount: number
  pageCount: number
}
export interface ReconciliationQuery {
  kind: 'ORDER' | 'SKU'
  status?: string
  city?: string
  sales?: string
  orderNo?: string
  keyword?: string
  page: number
  pageSize: number
}
export interface ReconciliationHistory {
  id: string
  fileName: string
  capturedAt: string
  status: string
}
const base = '/analytics/reconciliation-reviews'
export const getOnlineReconciliationSources = () =>
  apiClient.get<OnlineReconciliationSource[], OnlineReconciliationSource[]>(
    '/integration/feishu/reconciliation-sources',
    { stayOnUnauthorized: true },
  )
export const captureOnlineReconciliationSource = (sourceId: string) =>
  apiClient.post<OnlineReconciliationCapture, OnlineReconciliationCapture>(
    '/integration/feishu/reconciliation-captures',
    { sourceId },
    { timeout: 180000, stayOnUnauthorized: true },
  )
export const getReconciliationHistory = () =>
  apiClient.get<ReconciliationHistory[], ReconciliationHistory[]>(base, {
    stayOnUnauthorized: true,
  })
export const captureReconciliationReview = (command: ReconciliationCommand) =>
  apiClient.post<ReconciliationPage, ReconciliationPage>(base, command, {
    timeout: 180000,
    stayOnUnauthorized: true,
  })
export const getReconciliationReview = (id: string, query: ReconciliationQuery) =>
  apiClient.get<ReconciliationPage, ReconciliationPage>(`${base}/${encodeURIComponent(id)}`, {
    params: query,
    stayOnUnauthorized: true,
  })
