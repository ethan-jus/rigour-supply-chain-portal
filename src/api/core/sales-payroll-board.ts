import { apiClient } from './client'

export interface SettledOrder {
  id: string
  orderNo: string
  settledOn: string | null
  basis: number | null
  state: string
}
export interface PayBoardEmployee {
  department?: string | null
  role?: string | null
  collectionTarget?: number | null
  corrections?: {
    id: string
    sourceMonth: string
    targetMonth: string
    amount: number
    reason: string
    statusCode: string
  }[]
  code: string
  name: string
  city: string | null
  status: string
  basisSource: string
  basis: number | null
  orders: SettledOrder[]
  commission: number | null
  held: number | null
  baseSalary: number | null
  processPay: number | null
  performance: number | null
  allowance: number | null
  deduction: number | null
  gross: number | null
  net: number | null
  paid: number | null
  correction: number | null
  issues: string[]
  details: {
    orderNo: string
    product: string
    role: string
    rule: string | null
    ruleVersion: number
    quantity: number
    accrued: number | null
    released: number | null
  }[]
  metrics: {
    code: string
    name: string
    actual: number | null
    target: number | null
    completion: number | null
  }[]
  revision: number
  updatedAt: string | null
  payrollId: string | null
}
export interface SalesPayrollBoard {
  month: string
  employees: PayBoardEmployee[]
}
export const getSalesPayrollBoard = (month: string, personal: boolean, signal?: AbortSignal) =>
  apiClient.get<SalesPayrollBoard, SalesPayrollBoard>(
    `/hr/payroll/${personal ? 'my-statement' : 'sales-board'}`,
    {
      params: { month },
      signal,
      cacheBypass: true,
      errorFeedback: 'inline',
    },
  )
