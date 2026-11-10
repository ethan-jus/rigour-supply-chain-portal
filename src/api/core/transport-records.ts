import { apiClient } from './client'
import type { CostPage, CostQuery, CostRecord } from './cost'
import type { ImportRow, SourceOrder } from '@/views/supply-chain/cost/huolala-source'

export interface TransportDraft {
  revision: number | null
  requestId: string
  transportType: string | null
  date: string
  carrierCode: string | null
  trackingNo: string | null
  platformOrderNo: string | null
  warehouseCode: string | null
  senderName: string | null
  senderContact: string | null
  senderPhone: string | null
  senderAddress: string | null
  cityCode: string
  amount: number | null
  paymentStatusCode?: string | null
  manualBillItems?: { name: string; amount: number | null }[] | null
  ownerEmployeeCode: string | null
  remark: string
  reason: string
  zeroReason: string
  orderCodes: string[]
}
export interface PlatformTransport {
  source: ImportRow
  draft: TransportDraft | null
  billHistory: SourceOrder[]
}
export interface TransportDetail {
  record: CostRecord
  platform: PlatformTransport | null
}
export interface TransportPage {
  page: CostPage
  platformRecords: Record<string, PlatformTransport>
}
export type TransportQuery = CostQuery & {
  relationState?: string
  platformOrderNo?: string
  platformEmployeeName?: string
  employeeRelationState?: string
  contactPhone?: string
  mappedEmployeeCode?: string
}
const base = '/orders/transport-records'
const options = { stayOnUnauthorized: true }
export const getTransportRecords = (params: TransportQuery, exporting = false) =>
  apiClient.get<TransportPage>(base + (exporting ? '/export' : ''), { ...options, params })
export const getTransport = (id: string) =>
  apiClient.get<TransportDetail>(`${base}/${encodeURIComponent(id)}`, options)
export const saveTransport = (id: string | null, draft: TransportDraft) =>
  id
    ? apiClient.put<TransportDetail>(`${base}/${encodeURIComponent(id)}`, draft, options)
    : apiClient.post<TransportDetail>(base, draft, options)
export const confirmTransport = (row: CostRecord, reason: string) =>
  apiClient.post<TransportDetail>(
    `${base}/${encodeURIComponent(row.id)}/confirm`,
    { revision: row.revision, reason },
    options,
  )
export const exportSelectedTransport = (ids: string[]) =>
  apiClient.post<TransportDetail[]>(`${base}/export-selected`, ids, options)
export const getTransportVoucher = (id: string, voucher: string) =>
  apiClient.get<{ url: string }>(
    `${base}/${encodeURIComponent(id)}/vouchers/${encodeURIComponent(voucher)}`,
    options,
  )
