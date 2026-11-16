import { apiClient } from './client'
import type { CostSource } from './cost'
import type { TransportDetail } from './transport-records'
export interface SalesLogisticsContext {
  salesOrder: CostSource
  transports: TransportDetail[]
  allocatedAmount: number | null
  confirmedAmount: number | null
  canAssociate: boolean
}
const base = '/orders/sales-logistics'
const options = { stayOnUnauthorized: true }
export const getSalesLogistics = (id: string | number) =>
  apiClient.get<SalesLogisticsContext>(`${base}/${encodeURIComponent(id)}`, options)
export const getSalesLogisticsCounts = (nos: string[]) =>
  apiClient.post<Record<string, number>>(`${base}/counts`, nos, options)
export const linkSalesLogistics = (id: string | number, transportId: string, revision: number) =>
  apiClient.post<TransportDetail>(
    `${base}/${encodeURIComponent(id)}/link`,
    { transportId, revision, reason: '销售订单选择物流' },
    options,
  )
