import { apiClient } from './client'

export type BiActionKind = 'COLLECTION' | 'CUSTOMER' | 'STOCK'
export type BiActionStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED'
export interface BiActionSeed {
  kind: BiActionKind
  businessRef: string
  businessLabel: string
  cityCode?: string | null
  employeeCode?: string | null
  assignee?: string | null
  note?: string
}
export interface BiActionCommand extends BiActionSeed {
  assignee: string
  dueAt: string
  note: string
}
export interface BiAction extends BiActionCommand {
  id: string
  status: BiActionStatus
  revision: number
  createdBy: string
  createdAt: string
  updatedAt: string
}
export interface BiActionUpdate {
  assignee: string
  dueAt: string
  status: BiActionStatus
  note: string
  expectedRevision: number
}
export interface BiActionQuery {
  kind?: BiActionKind
  businessRef?: string
  cityCode?: string
  employeeCode?: string
  assignee?: string
  status?: BiActionStatus
  page?: number
  pageSize?: number
}
export interface BiActionPage {
  items: BiAction[]
  total: number
  page: number
  pageSize: number
}
export interface BiActionEvent {
  id: string
  actionId: string
  revision: number
  previousStatus: BiActionStatus | null
  status: BiActionStatus
  previousAssignee: string | null
  assignee: string
  previousDueAt: string | null
  dueAt: string
  note: string
  actor: string
  occurredAt: string
}
const root = '/analytics/supply/dashboard'
const options = { stayOnUnauthorized: true }
export const getBiActions = (params: BiActionQuery) =>
  apiClient.get<BiActionPage, BiActionPage>(`${root}/actions`, { ...options, params })
export const createBiAction = (command: BiActionCommand) =>
  apiClient.post<BiAction, BiAction>(`${root}/actions`, command, options)
export const updateBiAction = (id: string, command: BiActionUpdate) =>
  apiClient.put<BiAction, BiAction>(`${root}/actions/${encodeURIComponent(id)}`, command, options)
export const getBiActionEvents = (id: string) =>
  apiClient.get<BiActionEvent[], BiActionEvent[]>(
    `${root}/actions/${encodeURIComponent(id)}/events`,
    options,
  )
