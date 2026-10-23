import type { StatutoryCalendarDayView } from './StatutoryCalendarDayView'

export interface StatutoryCalendarView {
  year: number
  status: 'AVAILABLE' | 'NOT_PUBLISHED' | 'UNAVAILABLE' | 'PENDING'
  version: string | null
  fetchedAt: string | null
  sourceUrls: string[]
  days: StatutoryCalendarDayView[]
  stale: boolean
  message: string | null
}
