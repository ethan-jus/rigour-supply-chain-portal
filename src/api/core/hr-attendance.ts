import { apiClient } from './client'

export interface AttendanceRule {
  month: string
  departmentId: number | null
  expectedDays: number | null
  revision: number
  companyExpectedDays: number | null
  locked: boolean
}
export type AttendanceRuleCommand = Omit<AttendanceRule, 'companyExpectedDays' | 'locked'>
export interface AttendanceRuleListRow {
  month: string
  departmentId: number | null
  departmentName: string
  expectedDays: number
  revision: number
  locked: boolean
  updatedTime: string
}
export interface AttendanceRuleFilters {
  month: string
  departmentId?: number
  status: '' | 'LOCKED' | 'UNLOCKED'
}
export interface AttendanceRuleList {
  month: string
  companyExpectedDays: number | null
  configuredDepartmentIds: number[]
  lockedDepartmentIds: number[]
  page: { total: number; begin: number; step: number; items: AttendanceRuleListRow[] }
}
export interface AttendanceRow {
  employeeCode: string
  employeeName: string
  departmentName: string | null
  expectedDays: number | null
  ruleSource: 'COMPANY' | 'DEPARTMENT' | 'UNSET'
  actualDays: number | null
  absentDays: number | null
  punchDays: number | null
  actualDaysOverride: number | null
  absentDaysOverride: number | null
  leaveTypeCode: string
  attendanceStatus: 'PENDING' | 'CONFIRMED'
  sourceStatus: 'AVAILABLE' | 'UNLINKED' | 'UNAVAILABLE' | 'FUTURE'
  dates: string[]
  reason: string
  revision: number
}
export interface AttendanceView {
  month: string
  through: string | null
  provisional: boolean
  rule: AttendanceRule
  sourceError: string | null
  page: { total: number; begin: number; step: number; items: AttendanceRow[] }
}
export interface AttendanceDepartment {
  id: number
  parentId: number | null
  departmentName: string
  sortOrder: number
}
export interface AttendanceFilters {
  month: string
  employeeName: string
  employeeCode: string
  departmentId?: number
  attendanceStatus: string
}
const root = '/hr/attendance'
const options = { stayOnUnauthorized: true }
export const getAttendanceRule = (month: string, departmentId: number | null = null) =>
  apiClient.get<AttendanceRule>(`${root}/rule`, { ...options, params: { month, departmentId } })
export const getAttendanceRules = (
  params: AttendanceRuleFilters & { begin: number; step: number },
) => apiClient.get<AttendanceRuleList>(`${root}/rules`, { ...options, params })
export const saveAttendanceRule = (data: AttendanceRuleCommand) =>
  apiClient.put<AttendanceRule>(`${root}/rule`, data, options)
export const getAttendanceDepartments = () =>
  apiClient.get<AttendanceDepartment[]>(`${root}/departments`, options)
export const getAttendance = (params: AttendanceFilters & { begin: number; step: number }) =>
  apiClient.get<AttendanceView>(root, { ...options, params })
export interface AttendanceRecordCommand {
  actualDaysOverride: number | null
  absentDaysOverride: number | null
  leaveTypeCode: string
  reason: string
  revision: number
}
export const confirmAttendanceRecord = (
  month: string,
  employeeCode: string,
  command: AttendanceRecordCommand,
) =>
  apiClient.post<void>(
    `${root}/${encodeURIComponent(month)}/${encodeURIComponent(employeeCode)}/confirm`,
    command,
    options,
  )

export const attendanceMonth = () =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date())
