import { describe, expect, it } from 'vitest'
import {
  businessDate,
  businessDateRange,
  businessDateTime,
  businessMonth,
  businessPeriodDays,
  businessPeriodRange,
  businessMonthRange,
} from '@/utils/business-date'

describe('BI Asia/Shanghai business calendar with Instant transport', () => {
  it('uses the same business day for UTC and offset representations without a second shift', () => {
    expect(businessDate('2026-08-31T15:59:59.999999Z')).toBe('2026-08-31')
    for (const value of ['2026-08-31T16:00:00Z', '2026-09-01T00:00:00+08:00', '2026-09-01']) {
      expect(businessDate(value)).toBe('2026-09-01')
      expect(businessMonth(value)).toBe('2026-09')
      expect(businessDateTime(value)).toBe('2026-09-01 00:00:00')
    }
    // Historical date-only imports encoded midnight UTC; their business date is unchanged.
    expect(businessDate('2026-09-01T00:00:00Z')).toBe('2026-09-01')
  })

  it('emits a complete microsecond single-day range across a UTC month boundary', () => {
    const range = businessDateRange('2026-09-01', '2026-09-01')
    expect(range).toEqual({
      from: '2026-09-01T00:00:00+08:00',
      to: '2026-09-01T23:59:59.999999+08:00',
    })
    expect(new Date(range.from).toISOString()).toBe('2026-08-31T16:00:00.000Z')
    expect(businessPeriodDays(range.from, range.to)).toBe(1)
    expect(businessPeriodDays('2026-08-31T16:00:00Z', '2026-09-01T15:59:59.999999Z')).toBe(1)
    expect(businessPeriodDays('2026-09-01T15:59:59Z', '2026-09-01T16:00:00Z')).toBe(2)
  })

  it('anchors quick periods in Shanghai regardless of the browser clock zone', () => {
    const now = new Date('2026-12-31T16:00:00Z')
    expect(businessPeriodRange('year', now)).toEqual(['2027-01-01', '2027-01-01'])
    expect(businessPeriodRange('month', now)).toEqual(['2027-01-01', '2027-01-01'])
    expect(businessPeriodRange('today', now)).toEqual(['2027-01-01', '2027-01-01'])
    expect(businessPeriodRange('last-month', now)).toEqual(['2026-12-01', '2026-12-31'])
    expect(businessMonthRange('2024-02')).toEqual(['2024-02-01', '2024-02-29'])
  })

  it.each(['2026-02-30', '2026-09-01T00:00:00', 'invalid'])(
    'rejects ambiguous or invalid time %s',
    (value) => expect(() => businessDate(value)).toThrow(RangeError),
  )
  it('rejects reversed dates instead of extending the query', () => {
    expect(() => businessDateRange('2026-09-02', '2026-09-01')).toThrow(RangeError)
  })
})
