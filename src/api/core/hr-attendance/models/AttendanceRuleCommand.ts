import type { AttendanceRule } from './AttendanceRule'

export type AttendanceRuleCommand = Omit<AttendanceRule, 'companyExpectedDays' | 'locked'>
