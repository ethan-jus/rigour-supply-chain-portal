import { apiClient } from '@/api'
import type { AdminDivisionCatalog } from './admin-divisions'

export interface TerritoryArea {
  version: string
  code: string
}
export interface TerritoryDepartment {
  id: string
  name: string
  parentId: string | null
  status: string
  areas: TerritoryArea[]
}
export interface TerritoryContext {
  applicationVersion: number
  canWrite: boolean
  catalog: AdminDivisionCatalog
  departments: TerritoryDepartment[]
}
export interface TerritoryUpdate {
  applicationVersion: number
  catalogVersion: string
  areaCodes: string[]
  reason: string
}
const base = '/management/supply/store-territories'
export const storeTerritoryApi = {
  context: () => apiClient.get<TerritoryContext>(base),
  save: (department: string, command: TerritoryUpdate) =>
    apiClient.put<void>(`${base}/departments/${encodeURIComponent(department)}`, command),
}
