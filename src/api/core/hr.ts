import { apiClient } from './client'

export interface HrPage<T> {
  total: number
  begin: number
  step: number
  items: T[]
}

export interface HrEmployeeProfile {
  graduationSchool?: string | null
  major?: string | null
  regularSalary?: string | null
  probationSalary?: string | null
  probationPeriod?: string | null
  idNumber: string | null
  contractEndDate: string | null
  education: string | null
  registeredAddress: string | null
  householdType: string | null
  residentialAddress: string | null
  bankAccount: string | null
  bankName: string | null
  socialInsurance: string | null
  emergencyContact: string | null
  emergencyPhone: string | null
}
export interface HrDepartmentOption {
  id: number
  parentId: number | null
  departmentName: string
  sortOrder: number
  statusCode: string
}
export interface HrEmployeeRecord {
  jobGrade?: string | null
  departmentId?: number | null
  departmentLeaderName?: string | null
  createdByName?: string | null
  updatedByName?: string | null
  profile?: HrEmployeeProfile | null
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
  sortOrder: number
  id: string
  positionCode: string
  positionName: string
  statusCode: string
  remark: string | null
  revision: number
  createdBy: string | null
  createdTime: string | null
  updatedBy: string | null
  updatedTime: string | null
}

export interface HrPositionCommand {
  positionCode: string
  sortOrder: number
  positionName: string
  statusCode?: string | null
  remark?: string | null
  revision?: number | null
}

export interface HrEmployeeQuery {
  positionCode?: string
  jobGrade?: string
  departmentId?: number
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
  statusCode?: string
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
  return apiClient.delete<void>(`${HR_BASE_PATH}/positions/${encodeURIComponent(String(id))}`, {
    params: { revision },
    stayOnUnauthorized: true,
  })
}

export interface HrDepartment {
  leaderEmployeeCode?: string | null
  id: number
  parentId: number | null
  departmentCode: string
  departmentName: string
  sortOrder: number
  statusCode: string
  revision: number
  leaderName: string | null
  contactPhone: string | null
  establishedDate: string | null
  createdTime: string
  createdBy: string | null
  createdByName: string | null
  updatedTime: string
  updatedBy: string | null
  updatedByName: string | null
}
export interface HrDepartmentCommand {
  parentId: number | null
  departmentName: string
  sortOrder: number
  statusCode: string
  revision: number
  leaderEmployeeCode: string | null
  contactPhone: string | null
  establishedDate: string | null
}
export interface HrEmployeeCommand {
  jobGrade?: string | null
  profile?: HrEmployeeProfile | null
  employeeName: string
  departmentId: number | null
  positionCode: string
  employmentStatus: string
  mobile: string | null
  email: string | null
  entryDate: string | null
  leaveDate: string | null
  remark: string | null
  revision: number
}
export interface HrEmployeeIdentity {
  id: number
  employeeCode: string
  employeeName: string
  employmentStatus: string
  departmentId: number | null
  departmentName: string | null
  positionCode: string | null
  positionName: string | null
  departmentAncestorIds: number[]
  employeeRevision: number
  organizationVersion: number
  accessVersion: number
  usable: boolean
  unavailableReason: string | null
}
export interface HrAssignment {
  id: number
  departmentId: number
  departmentName: string
  positionCode: string
  positionName: string
  effectiveFrom: string
  effectiveTo: string | null
}
function departmentResponse(value: unknown): HrDepartment {
  const row = value as Partial<HrDepartment> | null
  if (
    !row ||
    !Number.isSafeInteger(row.id) ||
    (row.id ?? 0) <= 0 ||
    !(row.parentId === null || Number.isSafeInteger(row.parentId)) ||
    typeof row.departmentName !== 'string' ||
    typeof row.departmentCode !== 'string' ||
    !Number.isInteger(row.sortOrder) ||
    !Number.isInteger(row.revision) ||
    !['ACTIVE', 'INACTIVE'].includes(row.statusCode ?? '')
  )
    throw new Error('部门接口未返回有效记录，请刷新列表确认，避免重复新增')
  return row as HrDepartment
}
export const hrOrganizationApi = {
  employeeDepartments: () => apiClient.get<HrDepartmentOption[]>('/hr/employee-departments'),
  departments: async () => {
    const rows = await apiClient.get<unknown>('/hr/departments')
    if (!Array.isArray(rows)) throw new Error('部门列表响应异常，请检查 HR 服务后重试')
    return rows.map(departmentResponse)
  },
  saveDepartment: async (id: number | null, command: HrDepartmentCommand) =>
    departmentResponse(
      await (id === null
        ? apiClient.post<unknown>('/hr/departments', command)
        : apiClient.put<unknown>(`/hr/departments/${id}`, command)),
    ),
  deleteDepartment: (id: number, revision: number) =>
    apiClient.delete<void>(`/hr/departments/${id}`, { params: { revision } }),
  saveEmployee: (id: string | null, command: HrEmployeeCommand) =>
    id === null
      ? apiClient.post<HrEmployeeRecord>('/hr/employees', command)
      : apiClient.put<HrEmployeeRecord>(`/hr/employees/${encodeURIComponent(id)}`, command),
  identity: (code: string) =>
    apiClient.get<HrEmployeeIdentity>(`/hr/employee-identities/${encodeURIComponent(code)}`),
  identities: (keyword: string, begin = 0, step = 20) =>
    apiClient.get<HrPage<HrEmployeeIdentity>>('/hr/employee-identities', {
      params: { keyword, begin, step },
    }),
  assignments: (id: string) =>
    apiClient.get<HrAssignment[]>(`/hr/employees/${encodeURIComponent(id)}/assignments`),
}
