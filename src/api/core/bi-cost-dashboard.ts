import { apiClient } from './client'
import type { CostQuery } from './bi-cost-dashboard/models/CostQuery'
import type { CostReport } from './bi-cost-dashboard/models/CostReport'
import type { CostRecords } from './bi-cost-dashboard/models/CostRecords'
import type { CostDetail } from './bi-cost-dashboard/models/CostDetail'
import type { CostExport } from './bi-cost-dashboard/models/CostExport'

export type { CostScope } from './bi-cost-dashboard/models/CostScope'
export type { CostCategory } from './bi-cost-dashboard/models/CostCategory'
export type { CostQuery } from './bi-cost-dashboard/models/CostQuery'
export type { CostChoice } from './bi-cost-dashboard/models/CostChoice'
export type { CostMeta } from './bi-cost-dashboard/models/CostMeta'
export type { CostMetric } from './bi-cost-dashboard/models/CostMetric'
export type { CostGroup } from './bi-cost-dashboard/models/CostGroup'
export type { CostCell } from './bi-cost-dashboard/models/CostCell'
export type { CostChange } from './bi-cost-dashboard/models/CostChange'
export type { CostReport } from './bi-cost-dashboard/models/CostReport'
export type { CostRecord } from './bi-cost-dashboard/models/CostRecord'
export type { CostRecords } from './bi-cost-dashboard/models/CostRecords'
export type { CostDetail } from './bi-cost-dashboard/models/CostDetail'
export type { CostExport } from './bi-cost-dashboard/models/CostExport'
export type { CostPeriod } from './bi-cost-dashboard/models/CostPeriod'
export type { CostPoint } from './bi-cost-dashboard/models/CostPoint'
export type { CostMonth } from './bi-cost-dashboard/models/CostMonth'
export type { CostRecordSummary } from './bi-cost-dashboard/models/CostRecordSummary'

const ROOT = '/analytics/supply/cost-dashboard'
export const getCostReport = (params: CostQuery, signal?: AbortSignal) =>
  apiClient.get<CostReport>(`${ROOT}/overview`, { params, signal })
export const getCostRecords = (params: CostQuery, signal?: AbortSignal) =>
  apiClient.get<CostRecords>(`${ROOT}/records`, { params, signal })
export const getCostWorkspace = (params: CostQuery, signal?: AbortSignal) =>
  apiClient.get<{ report: CostReport; records: CostRecords }>(`${ROOT}/workspace`, {
    params,
    signal,
  })
export const getCostDetail = (
  source: string,
  id: string,
  params: CostQuery,
  signal?: AbortSignal,
) =>
  apiClient.get<CostDetail>(
    `${ROOT}/records/${encodeURIComponent(source)}/${encodeURIComponent(id)}`,
    { params, signal },
  )
export const createCostExport = (query: CostQuery) =>
  apiClient.post<CostExport>(`${ROOT}/exports`, { query })
export const getCostExport = (id: string) =>
  apiClient.get<CostExport>(`${ROOT}/exports/${encodeURIComponent(id)}`)
export const cancelCostExport = (id: string) =>
  apiClient.delete(`${ROOT}/exports/${encodeURIComponent(id)}`)
export const downloadCostExport = (id: string) =>
  apiClient.get<Blob>(`${ROOT}/exports/${encodeURIComponent(id)}/download`, {
    responseType: 'blob',
  })
