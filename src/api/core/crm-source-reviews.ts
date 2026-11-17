import { apiClient } from './client'
export interface CustomerSourceReview {
  connectorId: string
  sourceId: string
  sourceCode: string
  customerName: string
  salespersonName: string | null
  areaName: string | null
  issueCode: string
  issueMessage: string
  revision: number
}
export interface CustomerSourceDecision {
  connectorId: string
  sourceId: string
  revision: number
  customerId: string | null
  independent: boolean
  reason: string
}
export const getCustomerSourceReviews = (connectorId?: string) =>
  apiClient.get<CustomerSourceReview[]>('/crm/dhb/customer-reviews', { params: { connectorId } })
export const decideCustomerSource = (command: CustomerSourceDecision) =>
  apiClient.post<void>('/crm/dhb/customer-reviews', command)
