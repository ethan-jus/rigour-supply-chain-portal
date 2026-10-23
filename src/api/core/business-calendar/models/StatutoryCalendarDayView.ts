export interface StatutoryCalendarDayView {
  date: string
  name: string
  workday: boolean
  type: 'WORKDAY' | 'WEEKEND' | 'HOLIDAY' | 'MAKEUP'
}
