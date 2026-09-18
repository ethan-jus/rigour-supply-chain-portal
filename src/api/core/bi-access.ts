import { apiClient } from './client'
export interface BiEffectiveScope {
  accessLevel: 'TENANT' | 'CITY' | 'SELF' | 'SCOPED' | 'DENIED'
  reasonCode: string
  reason: string | null
  regionCodes: string[]
  employeeCode: string | null
  ownerStaffCode: string | null
  defaultRegionCode: string | null
  defaultOwnerStaffCode: string | null
  globalGovernance: boolean
  unavailableSubjects: string[]
}
export const getBiEffectiveScope = () =>
  apiClient.get<BiEffectiveScope>('/analytics/supply-dashboard/effective-scope', {
    stayOnUnauthorized: true,
  })
