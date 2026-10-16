export interface PayrollSalaryItem {
  name: string
  standard?: number | null
  change?: number | null
  amount: number | null | undefined
  basis: string
  total?: boolean
}
