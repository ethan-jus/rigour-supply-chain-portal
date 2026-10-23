import { apiClient } from './client'
import type { AttendanceRule } from './hr-attendance/models/AttendanceRule'
import type { AttendanceRuleCommand } from './hr-attendance/models/AttendanceRuleCommand'
import type { AttendanceRuleFilters } from './hr-attendance/models/AttendanceRuleFilters'
import type { AttendanceRuleList } from './hr-attendance/models/AttendanceRuleList'
import type { AttendanceRow } from './hr-attendance/models/AttendanceRow'
import type { AttendanceView } from './hr-attendance/models/AttendanceView'
import type { AttendanceDepartment } from './hr-attendance/models/AttendanceDepartment'
import type { AttendanceFilters } from './hr-attendance/models/AttendanceFilters'
import type { AttendanceRecordCommand } from './hr-attendance/models/AttendanceRecordCommand'

export type { AttendanceRule } from './hr-attendance/models/AttendanceRule'
export type { AttendanceRuleCommand } from './hr-attendance/models/AttendanceRuleCommand'
export type { AttendanceRuleListRow } from './hr-attendance/models/AttendanceRuleListRow'
export type { AttendanceRuleFilters } from './hr-attendance/models/AttendanceRuleFilters'
export type { AttendanceRuleList } from './hr-attendance/models/AttendanceRuleList'
export type { AttendanceRow } from './hr-attendance/models/AttendanceRow'
export type { AttendanceView } from './hr-attendance/models/AttendanceView'
export type { AttendanceDepartment } from './hr-attendance/models/AttendanceDepartment'
export type { AttendanceFilters } from './hr-attendance/models/AttendanceFilters'
export type { AttendanceRecordCommand } from './hr-attendance/models/AttendanceRecordCommand'
export type { AttendanceExceptionPeriod } from './hr-attendance/models/AttendanceExceptionPeriod'
export type { AttendancePage } from './hr-attendance/models/AttendancePage'
import type { AttendanceReopenCommand } from './hr-attendance/models/AttendanceReopenCommand'

const root = '/hr/attendance'
const options = { stayOnUnauthorized: true }
export const getAttendanceRule = (month: string, departmentId: number | null = null) =>
  apiClient.get<AttendanceRule>(`${root}/rule`, { ...options, params: { month, departmentId } })
export const getAttendanceRules = (
  params: AttendanceRuleFilters & { begin: number; step: number },
) => apiClient.get<AttendanceRuleList>(`${root}/rules`, { ...options, params })
export const saveAttendanceRule = (data: AttendanceRuleCommand) =>
  apiClient.put<AttendanceRule>(`${root}/rule`, data, options)
export const getAttendanceDepartments = (forRules = false) =>
  apiClient.get<AttendanceDepartment[]>(`${root}/departments`, {
    ...options,
    ...(forRules ? { params: { forRules: true } } : {}),
  })
export const getAttendance = (params: AttendanceFilters & { begin: number; step: number }) =>
  apiClient.get<AttendanceView>(root, { ...options, params })

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

export const reopenAttendanceRecord = (month: string, row: AttendanceRow, reason: string) =>
  apiClient.post<void>(
    `${root}/${encodeURIComponent(month)}/${encodeURIComponent(row.employeeCode)}/reopen`,
    { revision: row.revision, reason } satisfies AttendanceReopenCommand,
    options,
  )
