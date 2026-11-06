import { apiClient } from './client'
import type { CostAudit } from './cost'
export interface ProcurementCostRecord {
  orderId: number
  procurementNo: string
  sourceSystemCode?: string | null
  sourceDocumentNo?: string | null
  orderRevision: number
  supplierName: string | null
  warehouseName: string | null
  purchaseDate: string
  goodsAmount: number | null
  goodsSource?: { issue: string | null; orderAmount: number | null; linesAmount: number | null }
  agreedFreightAmount: number | null
  freightBearerCode: string | null
  actualFreightAmount: number | null
  freightRecordId: string | null
  freightRevision: number | null
  freightRecordStatus: string | null
  freightStatus: 'PENDING' | 'CONFIRMED' | 'VOID'
  confirmedAmount: number | null
  lines: {
    productName: string
    variantCode: string
    unitCode: string
    quantity: number
    unitPrice: number | null
    amount: number | null
  }[]
}
export interface ProcurementFreightConfirmation {
  requestId: string
  orderRevision: number
  freightRevision: number | null
  freightRecordId: string | null
  costDate: string
  actualAmount: number | null
  paymentStatusCode: string
  reason: string
}
const options = { stayOnUnauthorized: true }
export const getProcurementCosts = (params: {
  begin: number
  step: number
  procurementNo?: string
  supplierName?: string
  freightStatus?: string
  dateFrom?: string
  dateTo?: string
}) =>
  apiClient.get<{ total: number; begin: number; step: number; items: ProcurementCostRecord[] }>(
    '/erp/procurement-costs',
    { ...options, params },
  )
export const getProcurementCost = (code: string) =>
  apiClient.get<ProcurementCostRecord>(
    `/erp/procurement-costs/${encodeURIComponent(code)}`,
    options,
  )
export const getProcurementCostHistory = (code: string) =>
  apiClient.get<CostAudit[]>(`/erp/procurement-costs/${encodeURIComponent(code)}/history`, options)
export const confirmProcurementFreight = (code: string, command: ProcurementFreightConfirmation) =>
  apiClient.post<ProcurementCostRecord>(
    `/erp/procurement-costs/${encodeURIComponent(code)}/freight-confirmation`,
    command,
    options,
  )

export const saveProcurementFreightDraft = (
  code: string,
  command: ProcurementFreightConfirmation,
) =>
  apiClient.post<ProcurementCostRecord>(
    `/erp/procurement-costs/${encodeURIComponent(code)}/freight-draft`,
    command,
    options,
  )
