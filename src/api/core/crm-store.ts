import { apiClient } from './client'
import type { AdminArea } from './admin-divisions'
export type { AdminArea } from './admin-divisions'

export type StoreView = 'PUBLIC' | 'MINE' | 'TEAM' | 'COOPERATED' | 'ALL' | 'LEADS' | 'COVERAGE'
export interface StoreContext {
  areaVersion: string
  scopeLabel: string
  national: boolean
  areas: AdminArea[]
  permissions: string[]
  employeeId: string | null
  emptyScopeReason: string | null
}
export interface StoreRow {
  id: string
  name: string
  address: string
  publicPhone: string | null
  storeTypeCode: string | null
  primaryPoi: string | null
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  areaCode: string
  provinceName: string | null
  cityName: string | null
  countyName: string | null
  regionCode: string
  longitude: number | null
  latitude: number | null
  coordinateSystem: string | null
  recordStatus: string
  businessStatus: string
  businessStatusReason: string | null
  poolType: string
  ownerEmployeeId: string | null
  ownerName: string | null
  cooperationStatus: string
  customerTier: string
  tierUnratedReason: string | null
  activityStatus: string
  potentialLevel: string
  lastVisitAt: string | null
  lastOrderAt: string | null
  firstCooperatedAt: string | null
  phase: string | null
  deadlineAt: string | null
  cooldownUntil: string | null
  claimBlockedReason: string | null
  revision: number
  currentOwnershipId?: string | null
  holdReason?: string | null
  holdUntil?: string | null
  validVisitCount?: number | null
}
export interface StoreQuery {
  view: StoreView
  keyword?: string
  region?: string
  province?: string
  city?: string
  county?: string
  cooperation?: string
  tier?: string
  activity?: string
  potential?: string
  storeType?: string
  pool?: string
  recordStatus?: string
  businessStatus?: string
  phase?: string
  protection?: string
  cursor?: string
  size: number
}
export interface StorePage {
  total: number
  items: StoreRow[]
  nextCursor: string | null
}
export interface StoreMapBounds {
  west: number
  south: number
  east: number
  north: number
}
export interface StoreMapPoint {
  id: string
  storeId: string | null
  name: string | null
  longitude: number
  latitude: number
  coordinateSystem: string
  count: number
  privateCount: number
  cooperatedCount: number
  bounds: StoreMapBounds
  areaCode: string | null
  areaLevel: 'PROVINCE' | 'PREFECTURE' | 'COUNTY' | null
}
export interface StoreMapResult {
  total: number
  located: number
  visible: number
  bounds: StoreMapBounds | null
  points: StoreMapPoint[]
  level: 'PROVINCE' | 'PREFECTURE' | 'COUNTY' | 'STORE'
}
export interface StoreLead {
  id: string
  name: string
  address: string
  areaCode: string
  longitude: number
  latitude: number
  status: string
  submittedAt: string
  submitterUserId: string
  reviewerUserId: string | null
  reviewedAt: string | null
  reviewReason: string | null
  resultStoreId: string | null
  publicPhone: string | null
  storeTypeCode: string | null
  coordinateSystem: string | null
  revision: number
}
export interface StoreMatch {
  id: string
  name: string
  address: string
  areaCode: string
  provinceName: string | null
  cityName: string | null
  countyName: string | null
  recordStatus: string
  businessStatus: string
  poolType: string
}
export interface StoreAdmission {
  storeId: string
  name: string
}
export interface StoreLeadReview {
  requestId?: string
  existingStoreId?: string
  distinctConfirmed?: boolean
}
export interface StoreLeadCommand {
  requestId: string
  name: string
  address: string
  areaCode: string
  longitude: number
  latitude: number
  publicPhone: string | null
  storeTypeCode: string
  coordinateSystem: string
}
export interface StorePoi {
  id: string
  name: string
  address: string | null
  publicPhone: string | null
  typeCode: string | null
  areaCode: string
  longitude: number
  latitude: number
}
export interface StoreOwnership {
  id: string
  ownerEmployeeId: string
  acquireType: string
  phase: string
  startedAt: string
  endedAt: string | null
  endReason: string | null
  deadlineAt: string
}
export interface StoreEvent {
  id: string
  type: string
  actorUserId: string
  occurredAt: string
  beforeData: string | null
  afterData: string | null
  reason: string | null
}
export interface StoreVisit {
  captureRef?: string | null
  reviewSource?: string | null
  id: string
  storeId: string
  ownershipId: string
  salespersonId: string
  status: string
  visitedAt: string
  submittedAt: string | null
  qualifiedAt: string | null
  resultSummary: string | null
  reviewReason: string | null
  revision: number
  storeVisitNo: number | null
  employeeVisitNo: number | null
  ownershipVisitNo: number | null
  visitType: string | null
}
export interface StoreCoverage {
  total: number
  publicCount: number
  privateCount: number
  cooperatedCount: number
  visitedCount: number
  connectedCount: number
  tierA: number
  tierB: number
  tierC: number
  unratedCount: number
  unknownVisitCount: number
  unknownWecomCount: number
}
const base = '/crm/stores'
const options = { stayOnUnauthorized: true }
export const crmStoreApi = {
  intakeContext: () => apiClient.get<StoreContext>(`${base}/intake/context`, options),
  intakeLookup: (keyword: string, areaCode: string) =>
    apiClient.get<StoreMatch[]>(`${base}/intake/lookup`, {
      ...options,
      params: { keyword, areaCode },
    }),
  reviewLookup: (keyword: string, areaCode: string) =>
    apiClient.get<StoreMatch[]>(`${base}/leads/lookup`, {
      ...options,
      params: { keyword, areaCode },
    }),
  intakeCandidates: (keyword: string, areaCode: string) =>
    apiClient.get<StorePoi[]>(`${base}/intake/poi-candidates`, {
      ...options,
      params: { keyword, areaCode },
    }),
  admit: (poiId: string, requestId: string) =>
    apiClient.post<StoreAdmission>(`${base}/intake/amap`, { requestId, poiId }, options),
  resubmit: (lead: StoreLead, proposal: StoreLeadCommand) =>
    apiClient.put<StoreLead>(
      `${base}/leads/${encodeURIComponent(lead.id)}`,
      { revision: lead.revision, proposal },
      options,
    ),
  businessStatus: (
    store: StoreRow,
    status: string,
    reason: string,
    management: boolean,
    requestId: string,
  ) =>
    apiClient.put<void>(
      `${base}/${encodeURIComponent(store.id)}/business-status`,
      { requestId, revision: store.revision, status, reason, management },
      options,
    ),
  visits: (id: string, view: StoreView) =>
    apiClient.get<StoreVisit[]>(`${base}/${encodeURIComponent(id)}/visits`, {
      ...options,
      params: { view },
    }),
  reviewVisit: (store: string, visit: StoreVisit, decision: string, reason: string) =>
    apiClient.post<StoreVisit>(
      `${base}/${encodeURIComponent(store)}/visits/${encodeURIComponent(visit.id)}/review`,
      { revision: visit.revision, decision, reason },
      options,
    ),
  context: (view: StoreView) =>
    apiClient.get<StoreContext>(`${base}/context`, { ...options, params: { view } }),
  list: (params: StoreQuery) => apiClient.get<StorePage>(base, { ...options, params }),
  map: (params: StoreQuery & Partial<StoreMapBounds> & { zoom?: number }, signal?: AbortSignal) =>
    apiClient.get<StoreMapResult>(`${base}/map`, { ...options, params, signal }),
  mapStores: (params: StoreQuery & StoreMapBounds & { coordinateSystem: string }) =>
    apiClient.get<StorePage>(`${base}/map/stores`, { ...options, params }),
  detail: (id: string, view: StoreView) =>
    apiClient.get<StoreRow>(`${base}/${encodeURIComponent(id)}`, { ...options, params: { view } }),
  claim: (id: string, revision: number, requestId: string) =>
    apiClient.post<void>(
      `${base}/${encodeURIComponent(id)}/claim`,
      { revision, requestId },
      options,
    ),
  release: (id: string, revision: number, reason: string) =>
    apiClient.post<void>(
      `${base}/${encodeURIComponent(id)}/release`,
      { revision, reason, requestId: crypto.randomUUID() },
      options,
    ),
  leads: (params: {
    review: boolean
    page: number
    size: number
    keyword?: string
    status?: string
  }) =>
    apiClient.get<{ total: number; items: StoreLead[]; page: number; size: number }>(
      `${base}/leads`,
      { ...options, params },
    ),
  submit: (command: StoreLeadCommand) =>
    apiClient.post<StoreLead>(`${base}/leads`, command, options),
  review: (
    id: string,
    revision: number,
    approve: boolean,
    reason: string,
    review: StoreLeadReview = {},
  ) =>
    apiClient.post<StoreLead>(
      `${base}/leads/${encodeURIComponent(id)}/review`,
      { revision, approve, reason, ...review, requestId: review.requestId ?? crypto.randomUUID() },
      options,
    ),
  ownerships: (id: string, view: StoreView) =>
    apiClient.get<StoreOwnership[]>(`${base}/${encodeURIComponent(id)}/ownerships`, {
      ...options,
      params: { view },
    }),
  events: (id: string, view: StoreView) =>
    apiClient.get<StoreEvent[]>(`${base}/${encodeURIComponent(id)}/events`, {
      ...options,
      params: { view },
    }),
  maintenanceContext: (id: string) =>
    apiClient.get<StoreContext>(`${base}/${encodeURIComponent(id)}/maintenance-context`, options),
  poiCandidates: (id: string, keyword: string, areaCode: string) =>
    apiClient.get<StorePoi[]>(`${base}/${encodeURIComponent(id)}/poi-candidates`, {
      ...options,
      params: { keyword, areaCode },
    }),
  update: (
    row: StoreRow,
    reason: string,
    amapPoiId?: string,
    businessStatus?: { status: string; reason: string },
  ) =>
    apiClient.put<void>(
      `${base}/${encodeURIComponent(row.id)}`,
      {
        revision: row.revision,
        requestId: crypto.randomUUID(),
        name: row.name,
        address: row.address,
        publicPhone: row.publicPhone,
        storeTypeCode: row.storeTypeCode || null,
        location: {
          areaCode: row.areaCode,
          longitude: row.longitude,
          latitude: row.latitude,
          coordinateSystem: row.coordinateSystem,
        },
        amapPoiId,
        businessStatus,
        reason,
      },
      options,
    ),
  coverage: (params: StoreQuery) =>
    apiClient.get<StoreCoverage>(`${base}/coverage`, { ...options, params }),
  initializePolicy: () => apiClient.post<void>(`${base}/policy/initialize`, {}, options),
}
