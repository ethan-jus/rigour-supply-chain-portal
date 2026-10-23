import type { PayrollCalculation } from '../../payroll'

/** 只读试算，包含已确认 / 已发放的原结果，不改变工资状态。 */
export interface PayrollPreview {
  employeeCode: string
  employeeName: string
  issues: string[]
  sourceChanged: boolean
  previousFingerprint: string | null
  currentFingerprint: string | null
  savedStatus: string | null
  calculation: PayrollCalculation
  previousCalculation: PayrollCalculation | null
}
