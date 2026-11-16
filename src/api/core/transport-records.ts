import { apiClient } from './client'
import type { CostPage, CostQuery, CostRecord } from './cost'
import type { ImportRow, SourceOrder } from '@/views/supply-chain/cost/huolala-source'
import type { CostCommand } from './cost'

export interface TransportDraft {
  orderAllocations?: Record<string, number | null> | null
  deliveryModeCode?: string | null
  receivingPoints?: import('@/types/cost-ledger').LedgerParty[] | null
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
export interface ShipmentTransportSource {
  id: string
  costId: string | null
  issue: string | null
  differencePending: boolean
  latest: {
    shipmentId: string
    shipmentNo: string
    salesOrderId: string | number
    sourceStatus: string
    shipTime: string
    sourceUpdatedAt: string | null
    carrierCode: string | null
    carrierName: string | null
    deliveryModeCode: string | null
    deliveryModeName: string | null
    trackingNumbers: string[]
    receiver: import('@/types/cost-ledger').LedgerParty | null
    sourceFields: Record<string, unknown>
    goods: Record<string, unknown>[]
  }
}
export interface TransportDetail {
  orderAllocations?: Record<string, number | null>
  record: CostRecord
  platform: PlatformTransport | null
  shipments?: ShipmentTransportSource[]
}
export interface TransportPage {
  page: CostPage
  platformRecords: Record<string, PlatformTransport>
  shipmentRecords?: Record<string, ShipmentTransportSource[]>
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
export const getTransportVoucher = (id: string, voucher: string, download = false) =>
  apiClient.get<{ url: string }>(
    `${base}/${encodeURIComponent(id)}/vouchers/${encodeURIComponent(voucher)}${download ? '?download=true' : ''}`,
    options,
  )

export interface TransportSubmission {
  submissionId: string
  draft: TransportDraft
  advanced: CostCommand | null
  uploads: { categoryCode: string; replacingId: string | null }[]
  removedIds: string[]
  salesOrderId?: string | number | null
}
export const saveTransportWithEvidence = (
  id: string | null,
  command: TransportSubmission,
  files: File[],
) => {
  const body = new FormData()
  body.append('command', new Blob([JSON.stringify(command)], { type: 'application/json' }))
  files.forEach((file) => body.append('files', file, file.name))
  return apiClient.post<TransportDetail>(
    `${base}${id ? '/' + encodeURIComponent(id) : ''}/with-evidence`,
    body,
    { ...options, headers: { 'Content-Type': 'multipart/form-data' } },
  )
}
export const getTransportAttachmentDownloadUrl = (id: string, file: string) =>
  apiClient.get<string>(
    `${base}/${encodeURIComponent(id)}/attachments/${encodeURIComponent(file)}/download-url`,
    options,
  )
