import type { PayrollAllowanceStandard } from './PayrollAllowanceStandard'
import type { PayrollSalaryStandard } from './PayrollSalaryStandard'
import type { PayrollPerformanceStandard } from './PayrollPerformanceStandard'
import type { PayrollSchemeCommissionPolicy } from './PayrollSchemeCommissionPolicy'
import type { PayrollWorkCalendar } from './PayrollWorkCalendar'
export interface PayrollComponentDefinition {
  name: string
  kind: 'SALARY' | 'PERFORMANCE' | 'COMMISSION' | 'ATTENDANCE' | 'ALLOWANCE'
  role: string
  departmentIds: number[]
  effectiveFrom: string
  effectiveTo: string
  salary: PayrollSalaryStandard | null
  performance: PayrollPerformanceStandard | null
  commission: PayrollSchemeCommissionPolicy | null
  calendar: PayrollWorkCalendar | null
  allowance: PayrollAllowanceStandard | null
  employeeCodes: string[]
}
