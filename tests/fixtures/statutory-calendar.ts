import y2025 from './calendar/2025.json'
import y2026 from './calendar/2026.json'
import type { StatutoryCalendarView } from '@/api/core/business-calendar'
import type { StatutoryCalendarDayView } from '@/api/core/business-calendar/models/StatutoryCalendarDayView'

export function calendarFixture(year: number): StatutoryCalendarView {
  const document = ({ 2025: y2025, 2026: y2026 } as Record<number, typeof y2026>)[year]
  if (!document)
    return {
      year,
      status: 'NOT_PUBLISHED',
      version: null,
      fetchedAt: null,
      sourceUrls: [],
      days: [],
      stale: false,
      message: '该年度法定日历尚未公布或尚未同步，系统定时重试。',
    }
  const exceptions = new Map(document.days.map((day) => [day.date, day]))
  const days: StatutoryCalendarDayView[] = []
  for (
    let value = Date.UTC(year, 0, 1);
    new Date(value).getUTCFullYear() === year;
    value += 86400000
  ) {
    const date = new Date(value).toISOString().slice(0, 10)
    const exception = exceptions.get(date)
    const workday = exception ? !exception.isOffDay : new Date(value).getUTCDay() % 6 !== 0
    days.push({
      date,
      workday,
      name: exception?.name || (workday ? '工作日' : '周末休息'),
      type: exception ? (workday ? 'MAKEUP' : 'HOLIDAY') : workday ? 'WORKDAY' : 'WEEKEND',
    })
  }
  return {
    year,
    status: 'AVAILABLE',
    version: `fixture-${year}`,
    fetchedAt: '2026-10-20T00:00:00Z',
    sourceUrls: document.papers,
    days,
    stale: false,
    message: null,
  }
}
