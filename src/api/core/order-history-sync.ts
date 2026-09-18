import { apiClient } from './client'
export type HistoryRow = Record<string, unknown>
export interface HistoryOverview {
  stores: HistoryRow[]
  sourceOrders: HistoryRow[]
  historyOrders: HistoryRow[]
  groups: HistoryRow[]
  receipts: HistoryRow[]
}
export const historyOverview = (customerId?: string) =>
  apiClient.get<HistoryOverview>('/orders/history-sync', { params: { customerId } })
export const historyAction = (
  action: 'groups' | 'allocations' | 'receipt-owner' | 'new-order' | 'product-allocations',
  command: unknown,
) => apiClient.post('/orders/history-sync/' + action, command)

export interface HistoryPerformance {
  sales: HistoryRow[]
  receipts: HistoryRow[]
  products: HistoryRow[]
  productReceipts: HistoryRow[]
  pending: HistoryRow
}
export const historyPerformance = (month: string) =>
  apiClient.get<HistoryPerformance>('/orders/history-sync/performance', { params: { month } })
