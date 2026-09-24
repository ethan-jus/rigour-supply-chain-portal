import { apiClient } from './client'
export interface ScheduleSettings {
  enabled: boolean
  mode: 'FIXED_DELAY' | 'DAILY'
  intervalMinutes: number | null
  dailyTime: string | null
}
export interface ScheduleView {
  key: string
  settings: ScheduleSettings
  version: number
  managed: boolean
  nextRunAt: string | null
  lastStartedAt: string | null
  lastFinishedAt: string | null
  lastStatus: string | null
  lastMessage: string | null
  runningJobId: string | null
}
export function getDhbSchedule(connector: string) {
  return apiClient.get<ScheduleView>(`/integration/dhb/schedules/${encodeURIComponent(connector)}`)
}
export function saveDhbSchedule(
  connector: string,
  settings: ScheduleSettings,
  expectedVersion: number,
) {
  return apiClient.put<ScheduleView>(
    `/integration/dhb/schedules/${encodeURIComponent(connector)}`,
    { settings, expectedVersion },
  )
}
export function getBiSchedule() {
  return apiClient.get<ScheduleView>('/integration/sync-schedules/bi')
}
export function saveBiSchedule(settings: ScheduleSettings, expectedVersion: number) {
  return apiClient.put<ScheduleView>('/integration/sync-schedules/bi', {
    settings,
    expectedVersion,
  })
}
export function frequency(settings: ScheduleSettings) {
  return settings.mode === 'DAILY'
    ? `每天 ${settings.dailyTime}`
    : `每轮完成后 ${settings.intervalMinutes} 分钟`
}
