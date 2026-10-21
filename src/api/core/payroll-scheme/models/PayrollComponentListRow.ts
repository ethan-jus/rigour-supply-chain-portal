import type { PayrollComponentVersionView } from './PayrollComponentVersionView'
import type { PayrollCommissionRow } from './PayrollCommissionRow'
import type { PayrollSchemeAllowance } from './PayrollSchemeAllowance'

/** A rule version can expose multiple business standards in the maintenance list. */
export interface PayrollComponentListRow extends PayrollComponentVersionView {
  commissionRow?: PayrollCommissionRow
  allowanceItem?: PayrollSchemeAllowance
}
