import { apiClient } from './client'

export interface HrPage<T> {
  total: number
  begin: number
  step: number
  items: T[]
}

export interface HrEmployeeRecord {
  id: string
  employeeCode: string
  employeeName: string
  mobile: string | null
  email: string | null
  employmentStatus: string
  jobCategory: string | null
  positionCode: string | null
  positionName: string | null
  departmentName: string | null
  leaderEmployeeCode: string | null
  leaderName: string | null
  regionName: string | null
  cityName: string | null
  sourceSystem: string | null
  sourceDocumentNo: string | null
  sourceCreatedAt: string | null
  sourceUpdatedAt: string | null
  entryDate: string | null
  leaveDate: string | null
  remark: string | null
  revision: number
  createdBy: string | null
  createdTime: string | null
  updatedBy: string | null
  updatedTime: string | null
}

export interface HrPositionRecord {
  id: string
  positionCode: string
  positionName: string
  positionType: string
  statusCode: string
  sourceSystem: string | null
  remark: string | null
  revision: number
  createdBy: string | null
  createdTime: string | null
  updatedBy: string | null
  updatedTime: string | null
}

export interface HrPositionCommand {
  positionName: string
  positionType: string
  statusCode?: string | null
  sourceSystem?: string | null
  remark?: string | null
  revision?: number | null
}

export interface HrEmployeeQuery {
  begin: number
  step: number
  keyword?: string
  employeeCode?: string
  employeeName?: string
  mobile?: string
  employmentStatus?: string
  jobCategory?: string
  positionName?: string
  regionName?: string
  cityName?: string
  sourceSystem?: string
}

export interface HrPositionQuery {
  begin: number
  step: number
  positionCode?: string
  positionName?: string
  positionType?: string
  statusCode?: string
  sourceSystem?: string
}

const HR_BASE_PATH = '/hr'

export function getHrEmployees(params: HrEmployeeQuery) {
  return apiClient.get<HrPage<HrEmployeeRecord>>(`${HR_BASE_PATH}/employees`, {
    params,
    stayOnUnauthorized: true,
  })
}

export function getHrEmployee(id: string | number) {
  return apiClient.get<HrEmployeeRecord>(
    `${HR_BASE_PATH}/employees/${encodeURIComponent(String(id))}`,
    { stayOnUnauthorized: true },
  )
}

export function getHrPositions(params: HrPositionQuery) {
  return apiClient.get<HrPage<HrPositionRecord>>(`${HR_BASE_PATH}/positions`, {
    params,
    stayOnUnauthorized: true,
  })
}

export function getHrPosition(id: string | number) {
  return apiClient.get<HrPositionRecord>(
    `${HR_BASE_PATH}/positions/${encodeURIComponent(String(id))}`,
    { stayOnUnauthorized: true },
  )
}

export function createHrPosition(command: HrPositionCommand) {
  return apiClient.post<HrPositionRecord>(`${HR_BASE_PATH}/positions`, command, {
    stayOnUnauthorized: true,
  })
}

export function updateHrPosition(id: string | number, command: HrPositionCommand) {
  return apiClient.put<HrPositionRecord>(
    `${HR_BASE_PATH}/positions/${encodeURIComponent(String(id))}`,
    command,
    { stayOnUnauthorized: true },
  )
}

export function deleteHrPosition(id: string | number, revision: number) {
  return apiClient.delete<void>(
    `${HR_BASE_PATH}/positions/${encodeURIComponent(String(id))}`,
    { params: { revision }, stayOnUnauthorized: true },
  )
}
