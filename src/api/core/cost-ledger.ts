import { apiClient } from './client'
import type { CostSource, CostPage, CostQuery, CostRecord } from './cost'
export interface LedgerPartyReference {
  id: string
  code: string
  name: string
  cityCode: string | null
  address: string | null
  contactName: string | null
  phone: string | null
  partyTypeCode: string
}
const options = { stayOnUnauthorized: true }
export function getLedgerParties(
  logistics: boolean,
  kind: string,
  params: { code?: string; id?: string; keyword?: string; cityCode?: string; begin?: number } = {},
) {
  return apiClient.get<LedgerPartyReference[]>(
    logistics ? '/orders/logistics-costs/ledger/parties' : '/erp/cost-ledger/parties',
    {
      ...options,
      params: { kind, ...params, ...(logistics ? {} : { action: 'erp:cost:rental:read' }) },
    },
  )
}
export interface LedgerSourceQuery {
  employeeName?: string
  orderTypeCode: string
  documentNo?: string
  partyName?: string
  sourceWarehouseCode?: string
  targetWarehouseCode?: string
  cityCode?: string
  dateFrom?: string
  dateTo?: string
  begin: number
}
export const getLedgerSources = (query: LedgerSourceQuery) =>
  apiClient.get<CostSource[]>('/orders/logistics-costs/ledger/sources', {
    ...options,
    params: { ...query, exact: false, historical: false },
  })
export const getLedgerExport = (logistics: boolean, query: CostQuery) =>
  apiClient.get<CostPage>(
    logistics ? '/orders/logistics-costs/export' : '/erp/costs/warehouse-rentals/export',
    { ...options, params: { ...query, ...(logistics ? {} : { typeCode: 'WAREHOUSE' }) } },
  )

export const getSelectedLogisticsExport = (ids: string[]) =>
  apiClient.post<CostRecord[]>('/orders/logistics-costs/export-selected', ids, options)
