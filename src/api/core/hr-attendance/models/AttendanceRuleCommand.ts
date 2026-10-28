import type { AttendanceRule } from './AttendanceRule'

export type AttendanceRuleCommand = Pick<
  AttendanceRule,
  'month' | 'departmentId' | 'expectedDays' | 'revision'
>
