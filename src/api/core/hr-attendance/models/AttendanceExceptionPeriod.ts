export interface AttendanceExceptionPeriod {
  start: string
  end: string
  kind: 'COMPENSATORY_LEAVE' | 'PAID_LEAVE' | 'UNPAID_LEAVE' | 'ACTIVITY' | 'MISSING_PUNCH'
  reason: string
}
