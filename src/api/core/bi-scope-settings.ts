import { apiClient } from './client'

export interface BiScopeSyncCommand {
  userId: string
  iamPolicyIds: string[]
  regionCodes: string[]
}
export interface BiScopeSyncResult {
  userId: string
  employeeCode: string
  regionCodes: string[]
  verifiedAt: string
  expiresAt: string
  status: string
}
const root = '/analytics/supply-dashboard/data-scopes'
export const synchronizeBiDataScope = (command: BiScopeSyncCommand) =>
  apiClient.post<BiScopeSyncResult, BiScopeSyncResult>(`${root}/synchronize`, command, { stayOnUnauthorized: true })
export const revokeBiDataScope = (userId: string) =>
  apiClient.delete<void, void>(`${root}/${encodeURIComponent(userId)}`, { stayOnUnauthorized: true })
