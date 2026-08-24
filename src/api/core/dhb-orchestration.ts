import { apiClient } from './client'

export type DhbSyncOrchestrationStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED'
export type DhbSyncDomain = 'ERP' | 'CRM' | 'ORDER' | string

export interface DhbSyncOrchestrationCommand {
  tenantId?: string | null
  connectorId?: string | null
  maxPages?: number | null
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
  status: DhbSyncOrchestrationStatus
  steps: DhbSyncOrchestrationStep[]
}

export interface DhbSyncOrchestrationResult {
  batchId: string
  status: DhbSyncOrchestrationStatus
  elapsedSeconds: number
  tenants: DhbSyncOrchestrationTenant[]
}

const DHB_ORCHESTRATION_SYNC_PATH = '/integration/dhb/orchestration/sync'
const longRunningRequest = { timeout: 900000, stayOnUnauthorized: true }

export function syncDhbOrchestration(command: DhbSyncOrchestrationCommand = {}) {
  return apiClient.post<DhbSyncOrchestrationResult>(
    DHB_ORCHESTRATION_SYNC_PATH,
    command,
    longRunningRequest,
  )
}
