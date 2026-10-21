import type { PayrollRuleReferences } from './PayrollRuleReferences'
import type { PayrollManagerPolicy } from './PayrollManagerPolicy'
import type { PayrollProrationPolicy } from './PayrollProrationPolicy'
import type { PayrollSalesPolicy } from './PayrollSalesPolicy'
import type { PayrollSchemeAllowance } from './PayrollSchemeAllowance'
import type { PayrollSchemeBaseSalary } from './PayrollSchemeBaseSalary'
import type { PayrollSchemeCommissionPolicy } from './PayrollSchemeCommissionPolicy'
import type { PayrollWorkCalendar } from './PayrollWorkCalendar'

export interface PayrollSchemeDefinition {
  ruleReferences?: PayrollRuleReferences | null
  name: string
  role: string
  departmentIds: number[]
  employeeCodes: string[]
  effectiveFrom: string
  effectiveTo: string
  baseSalary: PayrollSchemeBaseSalary
  performanceBase: number | null
  performanceMode: string
  sales: PayrollSalesPolicy
  manager: PayrollManagerPolicy
  calendar: PayrollWorkCalendar
  proration: PayrollProrationPolicy
  allowances: PayrollSchemeAllowance[]
  commission: PayrollSchemeCommissionPolicy
  remark: string
}
