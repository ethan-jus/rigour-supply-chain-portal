import { apiClient } from '../client'
import type { PayrollSchemeDefinition } from './models/PayrollSchemeDefinition'
import type { PayrollSchemeSaveCommand } from './models/PayrollSchemeSaveCommand'
import type { PayrollSchemeVersionView } from './models/PayrollSchemeVersionView'
import type { PayrollSchemeCheckView } from './models/PayrollSchemeCheckView'
import type { PayrollSchemeFactsView } from './models/PayrollSchemeFactsView'
import type { PayrollSchemeFactsCommand } from './models/PayrollSchemeFactsCommand'
import type { PayrollCalculation } from '../payroll'
const root = '/hr/payroll/schemes'
const options = { stayOnUnauthorized: true }
export const getPayrollSchemes = () => apiClient.get<PayrollSchemeVersionView[]>(root, options)
export const savePayrollScheme = (id: string | null, body: PayrollSchemeSaveCommand) =>
  id
    ? apiClient.put<PayrollSchemeVersionView>(`${root}/${encodeURIComponent(id)}`, body, options)
    : apiClient.post<PayrollSchemeVersionView>(root, body, options)
export const validatePayrollScheme = (body: PayrollSchemeDefinition) =>
  apiClient.post<PayrollSchemeCheckView>(`${root}/validate`, body, options)
export const publishPayrollScheme = (row: PayrollSchemeVersionView, reason: string) =>
  apiClient.post<PayrollSchemeVersionView>(
    `${root}/${encodeURIComponent(row.id)}/publish`,
    { revision: row.revision, reason },
    options,
  )
export const previewPayrollScheme = (id: string, month: string, employeeCode: string) =>
  apiClient.post<PayrollCalculation>(`${root}/${encodeURIComponent(id)}/preview`, null, {
    ...options,
    timeout: 120000,
    params: { month, employeeCode },
  })
export const getPayrollSchemeFacts = (month: string, employee: string) =>
  apiClient.get<PayrollSchemeFactsView>(
    `${root}/monthly-facts/${encodeURIComponent(month)}/${encodeURIComponent(employee)}`,
    options,
  )
export const savePayrollSchemeFacts = (
  month: string,
  employee: string,
  body: PayrollSchemeFactsCommand,
) =>
  apiClient.put<PayrollSchemeFactsView>(
    `${root}/monthly-facts/${encodeURIComponent(month)}/${encodeURIComponent(employee)}`,
    body,
    options,
  )

export const stopPayrollScheme = (
  id: string,
  body: import('./models/PayrollSchemeStopCommand').PayrollSchemeStopCommand,
) =>
  apiClient.post<PayrollSchemeVersionView>(`${root}/${encodeURIComponent(id)}/stop`, body, options)
