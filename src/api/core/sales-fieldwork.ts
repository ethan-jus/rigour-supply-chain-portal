import { apiClient } from './client'
export interface FieldPersonDay {
  salesProfileId: string; employeeCode: string | null; employeeName: string; departmentName: string | null
  workDayId: string | null; status: string; checkedInAt: string | null; checkedOutAt: string | null
  workMinutes: number; distanceMeters: number | null; gapCount: number | null
  visitCount: number; pendingReviewCount: number; summaryPending: boolean
}
export interface TrackPoint { longitude: number; latitude: number; clientOccurredAt: string; serverReceivedAt: string; accuracyMeters: number; qualityStatus: string }
export interface TrackLeg { confirmed?: boolean; points: Array<Pick<TrackPoint, 'longitude' | 'latitude'>> }
export interface TrackVisit { visitId: string; storeId: string | null; sequence: number; storeName: string; longitude: number | null; latitude: number | null; checkedInAt: string; checkedOutAt: string | null; dwellMinutes: number; reviewStatus: string; visitType: string }
export interface FieldTrack {
  workDayId: string; businessDate: string; status: string; distanceAvailable: boolean; totalDistanceMeters: number; trackedDurationMinutes: number
  rejectedPointCount?: number
  confirmedTrack?: boolean
  points: TrackPoint[]; legs: Array<{ distanceMeters: number; confirmed?: boolean; points: TrackPoint[] }>
  gaps: Array<{ from: string; to: string; reason: string }>
  punches: Array<{ eventType: string; clientOccurredAt: string; serverReceivedAt: string; longitude: number; latitude: number }>
  visits: TrackVisit[]; segments: Array<{ fromSequence: number; toSequence: number; toVisitId: string; distanceMeters: number; distanceSource: string }>
}
export function fieldworkTrack(profile: string, date: string, signal?: AbortSignal) {
  return apiClient.get(`/sales/management/profiles/${encodeURIComponent(profile)}/track`, { params: { date }, signal, errorFeedback: 'inline', cacheBypass: true }) as Promise<FieldTrack>
}
export function fieldClock(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return '—'
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}
export function fieldDistance(meters: number | null | undefined, showMeters = false): string {
  if (meters == null) return '无法计算'
  return showMeters && meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`
}

export function fieldMapPaths(legs: TrackLeg[]): Array<{ path: Array<[number, number]>; showDir: boolean }> {
  const valid = (point: TrackLeg['points'][number]) =>
    Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180 &&
    Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90
  const seen = new Set<string>()
  const routes = []
  for (const leg of legs) {
    let path: Array<[number, number]> = []
    for (let index = 1; index < leg.points.length; index++) {
      const previous = leg.points[index - 1]
      const current = leg.points[index]
      if (!valid(previous) || !valid(current)) {
        if (path.length > 1) routes.push({ path, showDir: !leg.confirmed })
        path = []
        continue
      }
      const from: [number, number] = [previous.longitude, previous.latitude]
      const to: [number, number] = [current.longitude, current.latitude]
      const a = from[1].toFixed(5) + ',' + from[0].toFixed(5)
      const b = to[1].toFixed(5) + ',' + to[0].toFixed(5)
      const key = a < b ? a + '|' + b : b + '|' + a
      if (a === b || seen.has(key)) {
        if (path.length > 1) routes.push({ path, showDir: !leg.confirmed })
        path = []
        continue
      }
      seen.add(key)
      if (!path.length) path.push(from)
      path.push(to)
    }
    if (path.length > 1) routes.push({ path, showDir: !leg.confirmed })
  }
  return routes
}
export function fieldStatus(status: string): string { return ({ ACTIVE: '外勤中', FINISHED: '已签退', NOT_STARTED: '未签到', MISSING_CHECK_OUT: '缺签退' } as Record<string, string>)[status] || '待核实' }
