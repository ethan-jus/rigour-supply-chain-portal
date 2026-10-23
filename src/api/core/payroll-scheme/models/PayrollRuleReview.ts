export interface PayrollRuleReview {
  id: string
  subject: 'ATTENDANCE' | 'PAYROLL'
  subjectId: string
  employeeCode: string
  employeeName: string | null
  month: string
  ruleName: string
  action: string
  reason: string
  time: string
}
