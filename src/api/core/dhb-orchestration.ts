import { apiClient } from './client'

export type DhbSyncOrchestrationStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'SUCCEEDED_WITH_WARNINGS'
  | 'PARTIAL'
  | 'FAILED'
  | 'SKIPPED'
export type DhbSyncDomain = 'ERP' | 'CRM' | 'ORDER' | string

export interface DhbSyncOrchestrationCommand {
  maxPages?: number | null
  includeErp?: boolean | null
  includeCrm?: boolean | null
  includeOrder?: boolean | null
  includeIam?: boolean | null
  includeDictionary?: boolean | null
  includeErpProduct?: boolean | null
  includeErpSupply?: boolean | null
}

export interface DhbSyncOrchestrationStep {
  domain: DhbSyncDomain
  objectType: string
  status: DhbSyncOrchestrationStatus
  fetched: number
  changed: number
  unmapped: number
  message: string | null
}

export interface DhbSyncOrchestrationTenant {
  tenantId: string
  connectorId: string
  status: DhbSyncOrchestrationStatus
  steps: DhbSyncOrchestrationStep[]
}

export interface DhbSyncOrchestrationResult {
  batchId: string
  status: DhbSyncOrchestrationStatus
  triggerType: string
  startedAt: string
  finishedAt: string
  tenants: DhbSyncOrchestrationTenant[]
}

export interface DhbSyncOpenIssueItem {
  sourceObjectType: string
  sourceId: string
  connectorId: string | null
  runId: string
  errorCode: string | null
  errorMessage: string | null
  checkType: string | null
  candidateSourceObjectType: string | null
  candidateSourceIds: string[]
  manualResolutionRequired: boolean
  replaySupported: boolean
  handlingAdvice: string
  updatedAt: string | null
}

export interface DhbSyncOpenIssueGroup {
  category: string
  sourceObjectType: string
  errorCode: string | null
  title: string
  actionType: string
  recordCount: number
  uniqueSourceCount: number
  handlingAdvice: string
  items: DhbSyncOpenIssueItem[]
}

export interface DhbSyncTask {
  id: string
  tenantId: string
  connectorId: string
  code: string
  objectType: string
  status: string
  lastRunAt: string | null
  nextRunAt: string | null
  version: number
}

export interface DhbSyncRunCommand {
  from?: string | null
  to?: string | null
  pageSize?: number | null
  sourceObjectType?: string | null
  sourceId?: string | null
}

export interface DhbSyncRunView {
  runId: string
  taskId: string
  status: DhbSyncOrchestrationStatus | string
  windowFrom: string | null
  windowTo: string | null
  fetchedCount: number
  acceptedCount: number
  duplicateCount: number
  rejectedCount: number
  errorCode: string | null
  errorMessage: string | null
}

export interface DhbManualResolutionCommand {
  connectorId: string
  resolutionType: string
  sourceObjectType: string
  sourceId: string
  selectedSourceObjectType: string
  selectedSourceId: string
  selectedInternalObjectType?: string | null
  selectedInternalObjectId?: number | null
  evidence?: Record<string, unknown> | null
  reason?: string | null
}

export interface DhbManualResolutionView {
  id: string
  tenantId: string
  connectorId: string
  sourceSystem: string
  resolutionType: string
  sourceObjectType: string
  sourceId: string
  selectedSourceObjectType: string
  selectedSourceId: string
  selectedInternalObjectType: string | null
  selectedInternalObjectId: number | null
  evidenceJson: string | null
  reason: string | null
  status: string
  createdAt: string
  updatedAt: string
}

export interface DhbWarehousingReceipt {
  sourceId: string
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
  storageAt: string | null
  sourceCreatedAt: string | null
  sourceUpdatedAt: string | null
  totalAmount: number | null
  costAmount: number | null
  remark: string | null
}

export interface DhbWarehousingReceiptPage {
  total: number
  items: DhbWarehousingReceipt[]
}

const DHB_ORCHESTRATION_SYNC_PATH = '/integration/dhb/orchestration/sync'
const DHB_SYNC_CENTER_OPEN_ISSUES_PATH = '/integration/dhb/sync-center/open-issues'
const DHB_SYNC_CENTER_MANUAL_RESOLUTIONS_PATH = '/integration/dhb/sync-center/manual-resolutions'
const DHB_SYNC_TASKS_PATH = '/integration/dhb/sync-tasks'
const longRunningRequest = { timeout: 900000, stayOnUnauthorized: true }
const controlRequest = { stayOnUnauthorized: true }

export function syncDhbOrchestration(command: DhbSyncOrchestrationCommand = {}) {
  return apiClient.post<DhbSyncOrchestrationResult>(
    DHB_ORCHESTRATION_SYNC_PATH,
    command,
    longRunningRequest,
  )
}

export function getDhbOpenIssues(limit = 500) {
  return apiClient.get<DhbSyncOpenIssueGroup[]>(DHB_SYNC_CENTER_OPEN_ISSUES_PATH, {
    params: { limit },
    ...controlRequest,
  })
}

export function getDhbSyncTasks() {
  return apiClient.get<DhbSyncTask[]>(DHB_SYNC_TASKS_PATH, controlRequest)
}

export function createDhbManualResolution(command: DhbManualResolutionCommand) {
  return apiClient.post<DhbManualResolutionView>(
    DHB_SYNC_CENTER_MANUAL_RESOLUTIONS_PATH,
    command,
    controlRequest,
  )
}

export function replayDhbOrderObject(taskId: string, command: DhbSyncRunCommand) {
  return apiClient.post<DhbSyncRunView>(
    `/integration/dhb/orders/sync-tasks/${encodeURIComponent(String(taskId))}/run`,
    command,
    { timeout: 240000, stayOnUnauthorized: true },
  )
}

export function queryDhbWarehousingReceipts(connectorId: string, begin = 0, step = 200) {
  return apiClient.post<DhbWarehousingReceiptPage>(
    `/integration/dhb/supply-chain/${encodeURIComponent(String(connectorId))}/warehousing-receipts/query`,
    { begin, step },
    { timeout: 240000, stayOnUnauthorized: true },
  )
}
