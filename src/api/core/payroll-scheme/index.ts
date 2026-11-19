import { apiClient } from '../client'
import type { PayrollSchemeFactsView } from './models/PayrollSchemeFactsView'

export const getPayrollSchemeFacts = (month: string, employee: string) =>
  apiClient.get<PayrollSchemeFactsView>(
    `/hr/payroll/schemes/monthly-facts/${encodeURIComponent(month)}/${encodeURIComponent(employee)}`,
    { stayOnUnauthorized: true },
  )
