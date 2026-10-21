import { apiClient } from '../client'
import type { PayrollComponentVersionView } from './models/PayrollComponentVersionView'
import type { PayrollComponentSaveCommand } from './models/PayrollComponentSaveCommand'
const root = '/hr/payroll/components'
const options = { stayOnUnauthorized: true }
export const getPayrollComponents = (kind: string, employeeCode?: string) =>
  apiClient.get<PayrollComponentVersionView[]>(root, { ...options, params: { kind, employeeCode } })
export const savePayrollComponent = (body: PayrollComponentSaveCommand) =>
  apiClient.post<PayrollComponentVersionView>(root, body, options)
