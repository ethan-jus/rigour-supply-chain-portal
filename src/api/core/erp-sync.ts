import { apiClient } from './client'
import type { ErpMasterDataObjectType } from './erp-product'
import type { ErpSupplyObjectType } from './erp-supply'

/** ERP 统一同步对象；商品与供应链页面共用同一类型和方法。 */
export type ErpDataSyncObjectType = ErpMasterDataObjectType | ErpSupplyObjectType

/** ERP 本地幂等落库后返回的同步批次统计。 */
export interface ErpDataSyncResult {
  runId: string
  objectType: ErpDataSyncObjectType
  status: string
  connectorId: string
  fetched: number
  created: number
  changed: number
  duplicates: number
  rejected: number
  pages: number
  completedAt: string
}

const ERP_SYNC_PATH = '/erp/sync'
const longRunningRequest = { timeout: 300000, stayOnUnauthorized: true }

/**
 * 请求 ERP 同步一类数据。Portal 不传 Connector、Token 或 Secret。
 */
export function syncErpData(objectType: ErpDataSyncObjectType, maxPages = 100) {
  return apiClient.post<ErpDataSyncResult>(
    ERP_SYNC_PATH,
    { objectType, maxPages },
    longRunningRequest,
  )
}
