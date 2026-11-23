import { apiClient } from './client'
import type { FieldPersonDay, TrackVisit } from './sales-fieldwork'
import { verificationReason } from './visit-verification'

export interface ReportVisit {
  id: string
  profileId: string
  date: string
  employee: string | null
  name: string
  store: string | null
  customer: string | null
  status: string
  arrived: string
  departed: string | null
  result: string | null
  outcome: string | null
  intention: string | null
  planId: string | null
  sequence: number
  assessment: string
  reason: string | null
  ruleVersion: string | null
  minimumMinutes: number | null
  objective: string | null
  hasStorefrontPhoto?: boolean
  photos: number
  files: number
  verifiedFiles: number
  verifiedMillis: number
  city?: string | null
  departmentName?: string | null
  receivedAt?: string | null
}
export interface ReportEmployee extends Omit<FieldPersonDay, 'checkedInAt' | 'checkedOutAt'> {
  city: string | null
  punchCount: number
  storeCount: number
  effectiveVisits: number
  planned: number
  completedPlans: number
  files: number
  verifiedFiles: number
  verifiedMillis: number
  newContacts: number | null
  contactStatus: string
  contactsThrough: string | null
  contactTimes: string[]
  periods: { start: string; end: string | null }[]
  punches: { type: string; at: string | null; received: string }[]
  visits: ReportVisit[]
  issues: { id: string; visitId: string | null; kind: string; title: string; status: string }[]
}
export interface ReportSummary {
  people: number
  punched: number
  punches: number
  stores: number
  visits: number
  planned: number
  completedPlans: number
  workMinutes: number
  active: number
  missingCheckout: number
  files: number
  verifiedFiles: number
  verifiedMillis: number
  distanceMeters: number
  withDistance: number
  contacts: number
  withContacts: number
  pendingPeople: number
}
export interface ReportOption {
  id: string
  name: string
}
export interface DailyReport {
  date: string
  asOf: string
  total: number
  summary: ReportSummary
  items: ReportEmployee[]
  cities: { name: string; people: number; stores: number; pendingPeople: number }[]
  departments: ReportOption[]
  people: ReportOption[]
}
export interface ReportFilters {
  date: string
  city?: string
  departmentId?: string
  includeDescendants?: boolean
  person?: string
  status?: string
  employeeCode?: string
  pendingOnly?: boolean
  riskQueue?: boolean
  sort?: string
  page?: number
  size?: number
}
export interface LedgerFilters {
  from?: string
  to?: string
  city?: string
  departmentId?: string
  includeDescendants?: boolean
  person?: string
  keyword?: string
  assessment?: string
  origin?: string
  visitId?: string
  employeeCode?: string
  page?: number
  size?: number
}
export interface ReportLedger {
  assessmentCounts?: Record<string, number>
  storeVisitCounts?: Record<string, { storeVisits: number; salespersonVisits: number }>
  items: ReportVisit[]
  total: number
  stores: number
  completed: number
  pending: number
  cities: string[]
  departments: ReportOption[]
  people: ReportOption[]
}
export function readFieldReport(params: ReportFilters, signal?: AbortSignal) {
  return apiClient.get('/sales/management/fieldwork/report', {
    params,
    signal,
    errorFeedback: 'inline',
    cacheBypass: true,
  }) as Promise<DailyReport>
}
export function readVisitLedger(params: LedgerFilters, signal?: AbortSignal) {
  return apiClient.get('/sales/management/visits/records', {
    params,
    signal,
    errorFeedback: 'inline',
    cacheBypass: true,
  }) as Promise<ReportLedger>
}
export const assessmentNames: Record<string, string> = {
  VALID: '有效',
  INVALID: '无效',
  PENDING: '待核',
  IN_PROGRESS: '进行中',
  UNKNOWN: '待同步',
}
export const workNames: Record<string, string> = {
  ACTIVE: '外勤中',
  FINISHED: '已签退',
  NOT_STARTED: '未签到',
  MISSING_CHECKOUT: '缺签退',
}
export function visitAssessmentReason(visit: ReportVisit) {
  if (!visit.reason || ['EFFECTIVE', 'INEFFECTIVE', 'INVALID'].includes(visit.reason)) return ''
  return verificationReason(visit.reason)
}
export function duration(minutes: number) {
  return Math.floor(minutes / 60) + ':' + String(minutes % 60).padStart(2, '0')
}
export function recordings(files: number, verified: number, ms: number) {
  if (files && !verified) return '待核'
  const s = Math.floor(ms / 1000),
    h = Math.floor(s / 3600)
  return (
    (h ? h + '时' : '') + (Math.floor(s / 60) % 60) + '分' + String(s % 60).padStart(2, '0') + '秒'
  )
}
export function toTrackVisit(v: ReportVisit): TrackVisit {
  return {
    visitId: v.id,
    sequence: v.sequence,
    storeId: null,
    storeName: v.store || v.customer || '门店待关联',
    longitude: null,
    latitude: null,
    checkedInAt: v.arrived,
    checkedOutAt: v.departed,
    dwellMinutes: visitDwellMinutes(v) ?? 0,
    visitType: '',
    reviewStatus: v.assessment,
  }
}
export function visitDwellMinutes(visit: ReportVisit) {
  if (!visit.departed) return null
  const elapsed = Date.parse(visit.departed) - Date.parse(visit.arrived)
  return Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed / 60_000)) : null
}
export function rosterPerson(v: ReportEmployee): FieldPersonDay {
  return {
    ...v,
    checkedInAt: v.periods[0]?.start ?? null,
    checkedOutAt: v.periods.at(-1)?.end ?? null,
  }
}
export function cityName(value: string | null) {
  return !value || value === '__unknown' ? '城市待核' : value
}
export function reportCards(s: ReportSummary) {
  return [
    ['工作打卡', s.punches, '次', s.punched + ' / ' + s.people + ' 人有打卡'],
    ['拜访门店', s.stores, '家', s.visits + ' 次完成到店'],
    [
      '工作时长',
      duration(s.workMinutes),
      '',
      '人时' +
        (s.active ? ' · ' + s.active + ' 人暂计' : '') +
        (s.missingCheckout ? ' · ' + s.missingCheckout + ' 人缺签退' : ''),
    ],
    ['录音文件', s.files, '个', s.verifiedFiles + ' 个时长已核'],
    [
      '录音总时长',
      recordings(s.files, s.verifiedFiles, s.verifiedMillis),
      '',
      s.files > s.verifiedFiles
        ? '另 ' + (s.files - s.verifiedFiles) + ' 个待核'
        : '按已核文件累计',
    ],
    [
      '已记录里程',
      s.withDistance ? (s.distanceMeters / 1000).toFixed(1) : '—',
      s.withDistance ? 'km' : '',
      s.withDistance + ' / ' + s.people + ' 人有可用路段',
    ],
    [
      '新增企微 · 已确认',
      s.withContacts ? s.contacts : '待同步',
      s.withContacts ? '人' : '',
      s.withContacts + ' / ' + s.people + ' 人同步可用',
    ],
  ] as const
}
export function reportEvents(row: ReportEmployee) {
  const lastOut = row.punches.map((p) => p.type).lastIndexOf('CHECK_OUT')
  return [
    ...row.punches.map((p, i) => ({
      id: p.type + '@' + String(Date.parse(p.received)),
      kind: 'punch',
      title:
        p.type === 'CHECK_IN'
          ? i
            ? '恢复签到'
            : '工作签到'
          : i === lastOut && row.status === 'FINISHED'
            ? '工作签退'
            : '分段签退',
      at: p.at || p.received,
      ordinal: 0,
      tail: '',
      visit: null as ReportVisit | null,
    })),
    ...row.visits.map((v) => ({
      id: v.id,
      kind: 'visit',
      title: v.store || v.customer || '门店待关联',
      at: v.arrived,
      ordinal: v.sequence,
      tail: v.departed ? (visitDwellMinutes(v) ?? '—') + ' 分' : '进行中',
      visit: v,
    })),
  ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}
