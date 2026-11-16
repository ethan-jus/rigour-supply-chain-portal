import { apiClient } from './client'
export interface FieldPersonDay {
  salesProfileId: string; employeeCode: string | null; employeeName: string; departmentName: string | null
  workDayId: string | null; status: string; checkedInAt: string | null; checkedOutAt: string | null
  workMinutes: number; distanceMeters: number | null; gapCount: number | null
  visitCount: number; pendingReviewCount: number; summaryPending: boolean
}
export interface FieldworkPage {
  date: string; items: FieldPersonDay[]; total: number; page: number; pageSize: number
  totals: { total: number; active: number; notStarted: number; finished: number; locationAnomaly: number; pendingReview: number }
}
export interface TrackPoint { longitude: number; latitude: number; clientOccurredAt: string; serverReceivedAt: string; accuracyMeters: number; qualityStatus: string }
export interface TrackVisit { visitId: string; storeId: string | null; sequence: number; storeName: string; longitude: number | null; latitude: number | null; checkedInAt: string; checkedOutAt: string | null; dwellMinutes: number; reviewStatus: string; visitType: string }
export interface FieldTrack {
  workDayId: string; businessDate: string; status: string; distanceAvailable: boolean; totalDistanceMeters: number; trackedDurationMinutes: number
  points: TrackPoint[]; legs: Array<{ distanceMeters: number; points: TrackPoint[] }>
  gaps: Array<{ from: string; to: string; reason: string }>
  punches: Array<{ eventType: string; clientOccurredAt: string; serverReceivedAt: string; longitude: number; latitude: number }>
  visits: TrackVisit[]; segments: Array<{ distanceMeters: number; distanceSource: string }>
}
export function fieldworkPage(params: { date: string; status: string; keyword: string; page: number; pageSize: number; departmentId?:string; includeDescendants?:boolean; pendingOnly?:boolean; riskKind?:string }, signal?: AbortSignal) {
  return apiClient.get('/sales/management/fieldwork', { params, signal, errorFeedback: 'inline', cacheBypass: true }) as Promise<FieldworkPage>
}
export function fieldworkDepartments(signal?:AbortSignal) {return apiClient.get('/sales/management/fieldwork/departments',{signal,cacheBypass:true,errorFeedback:'inline'}) as Promise<Array<{id:string;name:string}>>}
export function fieldworkTrack(profile: string, date: string, signal?: AbortSignal) {
  return apiClient.get(`/sales/management/profiles/${encodeURIComponent(profile)}/track`, { params: { date }, signal, errorFeedback: 'inline', cacheBypass: true }) as Promise<FieldTrack>
}
export function fieldClock(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '—'
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}
export function fieldDistance(meters: number | null | undefined): string { return meters == null ? '无法计算' : `${(meters / 1000).toFixed(1)} km` }
export function fieldStatus(status: string): string { return ({ ACTIVE: '外勤中', FINISHED: '已签退', NOT_STARTED: '未签到' } as Record<string, string>)[status] || '待核实' }
