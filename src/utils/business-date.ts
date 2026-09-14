export const BUSINESS_TIME_ZONE = 'Asia/Shanghai'

const dayFormat = new Intl.DateTimeFormat('sv-SE', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const timeFormat = new Intl.DateTimeFormat('sv-SE', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

function calendarDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`)
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new RangeError('业务日期无效')
  return value
}

export function businessInstant(value: string | Date): Date {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) throw new RangeError('业务时间无效')
    return value
  }
  const day = calendarDate(value.slice(0, 10))
  const date = new Date(value === day ? `${day}T00:00:00+08:00` : value)
  if (
    (value !== day && !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) ||
    !Number.isFinite(date.getTime())
  )
    throw new RangeError('业务时间需要有效日期及明确时区')
  return date
}

export const businessDate = (value: string | Date) => dayFormat.format(businessInstant(value))
export const businessMonth = (value: string | Date) => businessDate(value).slice(0, 7)
export const businessDateTime = (value: string | Date) => timeFormat.format(businessInstant(value))

export function businessDateRange(from: string, to: string) {
  calendarDate(from)
  calendarDate(to)
  if (from > to) throw new RangeError('业务日期结束日不能早于开始日')
  return { from: `${from}T00:00:00+08:00`, to: `${to}T23:59:59.999999+08:00` }
}

export function businessMonthRange(month: string): [string, string] {
  calendarDate(`${month}-01`)
  const [year, number] = month.split('-').map(Number)
  // UTC is used only for calendar arithmetic, not to interpret a business timestamp.
  return [`${month}-01`, new Date(Date.UTC(year!, number!, 0)).toISOString().slice(0, 10)]
}

export function businessPeriodRange(period: string, now: Date = new Date()): [string, string] {
  const today = businessDate(now)
  if (period === 'last-month') {
    const [year, month] = today.split('-').map(Number)
    const previous = new Date(Date.UTC(year!, month! - 1, 0)).toISOString().slice(0, 7)
    return businessMonthRange(previous)
  }
  return [
    period === 'year'
      ? `${today.slice(0, 4)}-01-01`
      : period === 'month'
        ? `${today.slice(0, 7)}-01`
        : today,
    today,
  ]
}

export function businessPeriodDays(from: string, to: string) {
  const start = businessInstant(from)
  const end = businessInstant(to)
  if (end.getTime() < start.getTime()) throw new RangeError('业务时间结束不能早于开始')
  return (Date.parse(businessDate(end)) - Date.parse(businessDate(start))) / 86_400_000 + 1
}
