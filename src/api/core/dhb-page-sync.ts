import { apiClient } from './client'
import type { DhbSyncOrchestrationResult } from './dhb-orchestration'
export type DhbPageScope =
  | 'ORDER_SALES_PACKAGE'
  | 'SALES_ORDER'
  | 'RECEIPT'
  | 'PAYMENT'
  | 'SHIPMENT'
  | 'TRANSFER'
  | 'CUSTOMER'
  | 'ADDRESS'
  | 'AREA'
  | 'CLIENT_TYPE'
  | 'CATEGORY'
  | 'BRAND'
  | 'SPECIFICATION'
  | 'TAG'
  | 'PRODUCT_SPU'
  | 'SUPPLIER'
  | 'WAREHOUSE'
  | 'PURCHASE_ORDER'
  | 'PURCHASE_RETURN'
  | 'WAREHOUSING_RECEIPT'
  | 'INVENTORY'
export interface PageSyncCommand {
  scope: DhbPageScope
  connectorId: string
  from?: string
  to?: string
  incremental?: boolean
  maxPages: number
}
export interface DhbPageSyncJob {
  jobId: string
  connectorId: string
  scope: string
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN'
  stage: string
  startedAt: string
  heartbeatAt: string
  finishedAt?: string | null
  result?: DhbSyncOrchestrationResult | null
}
export function startDhbPageSyncJob(requestId: string, command: PageSyncCommand) {
  return apiClient.post<DhbPageSyncJob>(`/integration/dhb/page-sync/jobs/${requestId}`, command, { timeout: 15000 })
}
export function getDhbPageSyncJob(jobId: string) {
  return apiClient.get<DhbPageSyncJob>(`/integration/dhb/page-sync/jobs/${jobId}`, { timeout: 15000 })
}
export function latestDhbPageSyncJob(connectorId: string, scope: DhbPageScope) {
  return apiClient.get<DhbPageSyncJob | null>('/integration/dhb/page-sync/jobs', {
    params: { connectorId, scope }, timeout: 15000,
  })
}
/** 客户采用服务端增量游标；其他对象仍须显式提供范围。 */
/** 订单包同步由服务端按 SALES_ORDER → RECEIPT → PAYMENT 依赖顺序编排并游标增量。 */
export function syncDhbPage(command: PageSyncCommand) {
  return apiClient.post<DhbSyncOrchestrationResult>('/integration/dhb/page-sync', command, {
    timeout: 600000,
  })
}
