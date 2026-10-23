import { apiClient } from '../client'
import type { PayrollComponentVersionView } from './models/PayrollComponentVersionView'
import type { PayrollComponentAction } from './models/PayrollComponentAction'
import type { PayrollComponentActionResult } from './models/PayrollComponentActionResult'
import type { PayrollComponentActionCommand } from './models/PayrollComponentActionCommand'
import type { PayrollRuleReview } from './models/PayrollRuleReview'
import type { PayrollRuleOperation } from './models/PayrollRuleOperation'
import type { PayrollRuleReviewCommand } from './models/PayrollRuleReviewCommand'
export type { PayrollComponentAction, PayrollRuleReview, PayrollRuleOperation }
import type { PayrollComponentSaveCommand } from './models/PayrollComponentSaveCommand'
const root = '/hr/payroll/components'
const options = { stayOnUnauthorized: true }
export const getPayrollComponents = (kind: string, employeeCode?: string) =>
  apiClient.get<PayrollComponentVersionView[]>(root, { ...options, params: { kind, employeeCode } })
export const savePayrollComponent = (body: PayrollComponentSaveCommand) =>
  apiClient.post<PayrollComponentVersionView>(root, body, options)

export const actPayrollComponent = (
  row: PayrollComponentVersionView,
  action: PayrollComponentAction,
  reason: string,
  requestId: string,
) =>
  apiClient.post<PayrollComponentActionResult>(
    `${root}/${encodeURIComponent(row.id)}/actions`,
    {
      requestId,
      action,
      reason,
      revision: row.revision ?? 1,
      stateRevision: Math.max(0, ...(row.stateChanges ?? []).map((change) => change.revision)),
    } satisfies PayrollComponentActionCommand,
    options,
  )
export const getPayrollComponentOperations = (id: string) =>
  apiClient.get<PayrollRuleOperation[]>(`${root}/${encodeURIComponent(id)}/operations`, options)
export const getPayrollRuleReviews = (subject: PayrollRuleReview['subject'], month: string) =>
  apiClient.get<PayrollRuleReview[]>(`${root}/reviews`, { ...options, params: { subject, month } })
export const resolvePayrollRuleReview = (id: string, reason: string) =>
  apiClient.post<void>(
    `${root}/reviews/${encodeURIComponent(id)}/resolve`,
    { reason } satisfies PayrollRuleReviewCommand,
    options,
  )
