import { apiClient } from './client'
import type { PayrollPaymentAttachment } from './payroll'

const path = (payrollId: string, paymentId: string) =>
  `/hr/payroll/${encodeURIComponent(payrollId)}/payments/${encodeURIComponent(paymentId)}/attachments`
const options = { stayOnUnauthorized: true, errorFeedback: 'inline' as const }
export const payrollPaymentAttachmentContent = (payrollId: string, paymentId: string, id: string) =>
  apiClient.get<Blob>(`${path(payrollId, paymentId)}/${encodeURIComponent(id)}/content`, {
    ...options, responseType: 'blob',
  })
export const payrollPaymentAttachmentLink = (payrollId: string, paymentId: string, id: string) =>
  apiClient.get<{ url: string; expiresAt: string }>(`${path(payrollId, paymentId)}/${encodeURIComponent(id)}/download-link`, options)
export function uploadPayrollPaymentAttachment(payrollId: string, paymentId: string, revision: number, file: File) {
  const data = new FormData()
  data.append('revision', String(revision))
  data.append('file', file)
  return apiClient.post<PayrollPaymentAttachment>(path(payrollId, paymentId), data, {
    ...options, headers: { 'Content-Type': 'multipart/form-data' },
  })
}
