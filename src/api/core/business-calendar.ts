import { apiClient } from './client'
import type { StatutoryCalendarView } from './business-calendar/models/StatutoryCalendarView'

export type { StatutoryCalendarView } from './business-calendar/models/StatutoryCalendarView'
export const getStatutoryCalendar = (year: number) =>
  apiClient.get<StatutoryCalendarView>(`/business-settings/statutory-calendars/${year}`, {
    stayOnUnauthorized: true,
    errorFeedback: 'inline',
  })
