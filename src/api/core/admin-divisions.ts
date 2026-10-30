import { apiClient } from '@/api'

export interface AdminArea {
  code: string
  name: string
  level: 'PROVINCE' | 'PREFECTURE' | 'COUNTY'
  parentCode: string | null
  regionCode: string | null
}

export interface AdminDivisionCatalog {
  version: string
  sourceName: string
  sourceRef: string
  nodes: AdminArea[]
}

export const adminDivisionApi = {
  catalog: () => apiClient.get<AdminDivisionCatalog>('/management/supply/admin-divisions'),
}
