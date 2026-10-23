import type { PayrollWorkCalendar } from '@/api/core/payroll-scheme/models/PayrollWorkCalendar'
import type { StatutoryCalendarView } from '@/api/core/business-calendar'

const dayMillis = 86_400_000
const dateValue = (date: string) => new Date(`${date}T00:00:00Z`)
export function calendarMonthDates(month: string): string[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return []
  const first = dateValue(`${month}-01`)
  const count = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
}

/** Match SalarySchemeCalculator.workDates, including legacy alternating weeks. */
export function weeklyWorkDate(calendar: PayrollWorkCalendar, date: string): boolean {
  const day = dateValue(date)
  let weekdays = calendar.weekdays
  if (calendar.alternateAnchor) {
    const monday = (d: Date) => d.getTime() - ((d.getUTCDay() + 6) % 7) * dayMillis
    const weeks = Math.round(
      (monday(day) - monday(dateValue(calendar.alternateAnchor))) / (7 * dayMillis),
    )
    if (Math.abs(weeks % 2) === 1) weekdays = calendar.alternateWeekdays || []
  }
  return weekdays.includes(day.getUTCDay() || 7)
}
export function calendarWorkDate(calendar: PayrollWorkCalendar, date: string): boolean {
  return (
    !calendar.restDays.includes(date) &&
    (calendar.workDays.includes(date) || weeklyWorkDate(calendar, date))
  )
}
export function newStatutoryWorkCalendar(): PayrollWorkCalendar {
  return {
    source: 'STATUTORY',
    referenceVersion: null,
    weekdays: [1, 2, 3, 4, 5],
    alternateWeekdays: [],
    alternateAnchor: null,
    workDays: [],
    restDays: [],
    exemptDays: [],
    window: { start: '09:00:00', end: '06:00:00', nextDay: true, outside: 'IGNORE' },
  }
}

/** A missing annual snapshot is unknown, never a guessed working-day calendar. */
export function resolveWorkCalendar(
  calendar: PayrollWorkCalendar,
  reference: StatutoryCalendarView | null,
): PayrollWorkCalendar | null {
  if (calendar.source !== 'STATUTORY') return calendar
  if (!reference || reference.status !== 'AVAILABLE' || !reference.version) return null
  const rest = new Set(reference.days.filter((day) => !day.workday).map((day) => day.date))
  const work = new Set(reference.days.filter((day) => day.workday).map((day) => day.date))
  calendar.workDays.forEach((date) => {
    rest.delete(date)
    work.add(date)
  })
  calendar.restDays.forEach((date) => {
    work.delete(date)
    rest.add(date)
  })
  return {
    ...calendar,
    source: 'STATUTORY_SNAPSHOT',
    referenceVersion: reference.version,
    weekdays: [1, 2, 3, 4, 5],
    alternateWeekdays: [],
    alternateAnchor: null,
    restDays: [...rest].sort(),
    workDays: [...work].sort(),
  }
}
export function restoreStatutoryMonth(
  calendar: PayrollWorkCalendar,
  month: string,
  reference: StatutoryCalendarView | null,
): PayrollWorkCalendar {
  if (!reference || reference.status !== 'AVAILABLE') return calendar
  const outside = (date: string) => !date.startsWith(`${month}-`)
  if (calendar.source === 'STATUTORY')
    return {
      ...calendar,
      restDays: calendar.restDays.filter(outside),
      workDays: calendar.workDays.filter(outside),
    }
  const days = reference.days.filter((day) => day.date.startsWith(`${month}-`))
  return {
    ...calendar,
    restDays: [
      ...calendar.restDays.filter(outside),
      ...days.filter((day) => !day.workday).map((day) => day.date),
    ].sort(),
    workDays: [
      ...calendar.workDays.filter(outside),
      ...days
        .filter((day) => day.workday && !weeklyWorkDate(calendar, day.date))
        .map((day) => day.date),
    ].sort(),
  }
}
