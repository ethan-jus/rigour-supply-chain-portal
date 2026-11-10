import { apiClient } from './client'
export interface HuolalaConnection {
  id: string
  enterpriseId: string
  enterpriseName: string
  secretRef: string
  sandbox: boolean
  redirectUri: string
  enabled: boolean
  intervalMinutes: number
  startDate: string
  authStatus: string
  expiresAt: string | null
  credentialsReady: boolean
  revision: number
  lastSuccessAt: string | null
  lastError: string | null
}
export type HuolalaSettings = Pick<
  HuolalaConnection,
  'enabled' | 'intervalMinutes' | 'startDate' | 'revision'
>
export interface HuolalaEmployee {
  staffId: string
  userId: string
  name: string
  phone: string
  staffNo: string
  externalDepartmentId: string
  employeeCode: string | null
  employeeName: string | null
  departmentName: string | null
  state: string
  revision: number
}
export interface HuolalaCandidate {
  id: number
  employeeCode: string
  employeeName: string
  mobile: string
  departmentName: string | null
  employmentStatus: string
}
export interface HuolalaIssue {
  sourceType: string
  sourceId: string
  message: string
  occurredAt: string
}
export interface HuolalaRun {
  id: string
  scope: string
  status: string
  fetched: number
  accepted: number
  unchanged: number
  rejected: number
  startedAt: string | null
  finishedAt: string | null
  message: string | null
}
const base = '/integration/huolala',
  options = { stayOnUnauthorized: true }
export const huolalaApi = {
  connection: () => apiClient.get<HuolalaConnection | null>(`${base}/connection`, options),
  save: (data: HuolalaSettings) =>
    apiClient.put<HuolalaConnection>(`${base}/connection`, data, options),
  authorize: () =>
    apiClient.post<{ url: string; state: string; expiresAt: string }>(
      `${base}/authorization`,
      {},
      options,
    ),
  complete: (credential: string, state: string) =>
    apiClient.post<HuolalaConnection>(
      `${base}/authorization/complete`,
      { credential, state },
      options,
    ),
  employees: () => apiClient.get<HuolalaEmployee[]>(`${base}/employees`, options),
  candidates: (keyword: string) =>
    apiClient.get<HuolalaCandidate[]>(`${base}/employee-candidates`, {
      ...options,
      params: { keyword },
    }),
  bind: (staffId: string, employeeId: number | null, revision: number, reason: string) =>
    apiClient.post<HuolalaEmployee[]>(
      `${base}/employee-bindings`,
      { staffId, employeeId, revision, reason },
      options,
    ),
  issues: (id: string) =>
    apiClient.get<HuolalaIssue[]>(`${base}/runs/${encodeURIComponent(id)}/issues`, options),
  runs: () => apiClient.get<HuolalaRun[]>(`${base}/runs`, options),
  sync: (scope: string, from: string, to: string, orderNo?: string) =>
    apiClient.post<HuolalaRun>(`${base}/sync`, { scope, from, to, orderNo }, options),
}
