import { apiClient } from './client'
import type { CostEmployee, CostAudit } from './cost'
export type PayrollRuleKind = 'BASE' | 'COMMISSION' | 'PERFORMANCE' | 'ALLOWANCE' | 'CITY_MANAGER'
export interface PayrollRuleCommand {
  requestId: string
  revision: number | null
  name: string
  kindCode: PayrollRuleKind
  employeeCode: string | null
  cityCode: string | null
  cityName: string | null
  includeOwnSalesCommission: boolean
  departmentIds: number[]
  productId: string | null
  productVariantId: string | null
  productName: string | null
  unitCode: string | null
  groupCode: string | null
  recipientRoleCode: string | null
  methodCode: string | null
  rate: number | null
  amount: number | null
  effectiveFrom: string
  effectiveTo: string
  enabled: boolean
  remark: string
  performancePolicy: PerformancePolicy | null
  allowanceTypeCode?: string | null
  fixedAllowance?: {
    vehicleAllowance: number
    phoneAllowance: number
    computerAllowance: number
  } | null
}
export interface PerformancePolicy {
  mode: string
  bronzeBase: number | null
  firstMonthMode: string
  processPercent: number
  dailyCheckins: number
  checkinPenalty: number
  dailyVisits: number
  minimumSeconds: number
  visitPenalty: number
  secondMonthTarget: number
  laterMonthTarget: number
}
export interface PerformanceResult {
  processBudget: number | null
  processDeduction: number | null
  processPay: number | null
  collectionBudget: number | null
  collectionTarget: number | null
  collections: number | null
  collectionPay: number | null
  total: number | null
  days: {
    date: string
    checkins: number
    effectiveVisits: number
    missingCheckins: number
    missingVisits: number
    deduction: number | null
    evidenceComplete: boolean
  }[]
  sources: { sourceId: string; orderNo: string; date: string; amount: number; kind: string }[]
  issues: string[]
}
export interface PayrollRule {
  id: string
  revision: number
  data: PayrollRuleCommand
  updatedTime: string
}
export interface PayrollInput {
  revision: number
  baseOverride: number | null
  allowanceOverride?: number | null
  departmentOverrideId?: number | null
  performanceOverride: number | null
  deduction: number
  reason: string
}
export interface PayrollDetail {
  sourceLineId: string
  recipientRoleCode: string
  orderNo: string
  productName: string
  unitCode: string
  quantity: number
  ruleId: string | null
  ruleName: string | null
  ruleRevision: number
  accrued: number | null
  released: number
  message: string
}
export interface PayrollCalculation {
  baseSalary: number | null
  performance: number | null
  commission: number
  heldCommission: number
  allowance: number
  deduction: number
  grossPay: number | null
  netPay: number | null
  issues: string[]
  details: PayrollDetail[]
  rules: PayrollRule[]
  input: PayrollInput
  performanceDetail: PerformanceResult | null
  salarySource?: {
    payrollCategory: string | null
    regularized: boolean | null
    regularizationDate: string | null
    regularSalary: string | null
    probationSalary: string | null
    effectiveFrom: string | null
  } | null
  correctionAmount?: number
  corrections?: PayrollCorrection[]
  sourceFingerprint: string
}
export interface PayrollRecord {
  id: string
  month: string
  employeeCode: string
  employeeName: string
  departmentId: number | null
  departmentName: string | null
  cityName: string | null
  statusCode: string
  revision: number
  calculation: PayrollCalculation
  payments?: PayrollPayment[]
  correctionsIssued?: PayrollCorrection[]
  updatedTime: string
}
export interface PayrollProduct {
  productId: string
  productVariantId: string
  productCode: string
  variantCode: string
  productName: string
  specification: string | null
  unitCode: string
}
export interface PayrollQuery {
  begin: number
  step: number
  month?: string
  keyword?: string
  departmentId?: number
  statusCode?: string
}
export interface PayrollPage<T> {
  total: number
  begin: number
  step: number
  items: T[]
}
const base = '/hr/payroll',
  options = { stayOnUnauthorized: true }
export const getPayrollRules = (params: {
  begin: number
  step: number
  kindCode: PayrollRuleKind
  keyword: string
}) => apiClient.get<PayrollPage<PayrollRule>>(`${base}/rules`, { params, ...options })
export const savePayrollRule = (id: string | null, command: PayrollRuleCommand) =>
  id
    ? apiClient.put<PayrollRule>(`${base}/rules/${encodeURIComponent(id)}`, command, options)
    : apiClient.post<PayrollRule>(`${base}/rules`, command, options)
export interface PayrollEmployee extends CostEmployee {
  payrollCategory: string | null
}
export const getPayrollEmployees = (forRules = false) =>
  apiClient.get<PayrollEmployee[]>(`${base}/${forRules ? 'rule-employees' : 'employees'}`, options)
export const getPayrollProducts = (keyword: string) =>
  apiClient.get<PayrollProduct[]>(`${base}/products`, { params: { keyword }, ...options })
export const getPayroll = (params: PayrollQuery) =>
  apiClient.get<PayrollPage<PayrollRecord>>(base, { params, ...options })
export const calculatePayroll = (month: string, employeeCodes: string[]) =>
  apiClient.post<PayrollRecord[]>(
    `${base}/calculate`,
    { month, employeeCodes },
    { ...options, timeout: 120000 },
  )
export const getPayrollInput = (month: string, employeeCode: string) =>
  apiClient.get<PayrollInput>(
    `${base}/inputs/${encodeURIComponent(month)}/${encodeURIComponent(employeeCode)}`,
    options,
  )
export const savePayrollInput = (month: string, employeeCode: string, data: PayrollInput) =>
  apiClient.put<PayrollInput>(
    `${base}/inputs/${encodeURIComponent(month)}/${encodeURIComponent(employeeCode)}`,
    data,
    options,
  )
export const changePayrollStatus = (
  row: PayrollRecord,
  action: 'confirm' | 'reopen',
  reason: string,
) =>
  apiClient.post<PayrollRecord>(
    `${base}/${encodeURIComponent(row.id)}/${action}`,
    { revision: row.revision, reason },
    options,
  )
export const getPayrollHistory = (id: string) =>
  apiClient.get<CostAudit[]>(`${base}/${encodeURIComponent(id)}/history`, options)

export interface CommissionPolicy {
  code: string
  name: string
  methodCode: string
  salesRate: number
  managerRate: number
}
export const getCommissionPolicies = () =>
  apiClient.get<CommissionPolicy[]>(`${base}/commission-policies`, options)
export interface PayrollDepartment {
  id: number
  parentId: number | null
  name: string
  sortOrder: number
}
export const getPayrollDepartments = (ruleScope = true) =>
  apiClient.get<PayrollDepartment[]>(
    `${base}/${ruleScope ? 'rule-departments' : 'departments'}`,
    options,
  )

export interface PayrollPreparationEmployee {
  employeeCode: string
  employeeName: string
  departmentId: number | null
  departmentName: string | null
  payrollCategory: string | null
  payrollStatus: string | null
  payrollId: string | null
  locked: boolean
  profileIssues: string[]
  ruleIssues: string[]
  revision: number
  employeeId: number
  regularized: boolean | null
  regularizationDate: string | null
  salaryEffectiveFrom: string | null
}
export interface PayrollPreparation {
  month: string
  employees: PayrollPreparationEmployee[]
}
export interface PayrollPreview {
  employeeCode: string
  employeeName: string
  issues: string[]
}
export interface PayrollProfilePatch {
  probationSalary?: string | null
  regularSalary?: string | null
  employeeCode: string
  revision: number
  payrollCategory?: string | null
  regularized?: boolean | null
  regularizationDate?: string | null
  salaryEffectiveFrom?: string | null
}
export interface PayrollPayment {
  id: string
  requestId: string
  paidDate: string
  amount: number
  referenceNo: string
  reason: string
  createdTime: string
}
export interface PayrollCorrection {
  id: string
  sourcePayrollId: string
  sourceMonth: string
  targetMonth: string
  amount: number
  reason: string
  statusCode: string
  revision: number
  createdTime: string
}
export const getPayrollPreparation = (month: string) =>
  apiClient.get<PayrollPreparation>(`${base}/preparation`, { params: { month }, ...options })
export const previewPayroll = (month: string, employeeCodes: string[]) =>
  apiClient.post<PayrollPreview[]>(
    `${base}/preview`,
    { month, employeeCodes },
    { ...options, timeout: 120000 },
  )
export const updatePayrollProfiles = (employees: PayrollProfilePatch[], reason: string) =>
  apiClient.put<void>(`${base}/employee-profiles`, { employees, reason }, options)
export const exportPayroll = (params: PayrollQuery) =>
  apiClient.get<PayrollRecord[]>(`${base}/export`, { params, ...options, timeout: 120000 })
export const getPayrollDetail = (id: string) =>
  apiClient.get<PayrollRecord>(`${base}/${encodeURIComponent(id)}`, options)
export const registerPayrollPayment = (
  row: PayrollRecord,
  data: {
    requestId: string
    paidDate: string
    amount: number
    referenceNo: string
    reason: string
  },
) =>
  apiClient.post<PayrollRecord>(
    `${base}/${encodeURIComponent(row.id)}/paid`,
    { ...data, revision: row.revision },
    options,
  )
export const createPayrollCorrection = (
  row: PayrollRecord,
  data: { requestId: string; targetMonth: string; amount: number; reason: string },
) =>
  apiClient.post<PayrollCorrection>(
    `${base}/${encodeURIComponent(row.id)}/corrections`,
    { ...data, revision: row.revision },
    options,
  )
export const cancelPayrollCorrection = (
  id: string,
  correction: PayrollCorrection,
  reason: string,
) =>
  apiClient.post<void>(
    `${base}/${encodeURIComponent(id)}/corrections/${encodeURIComponent(correction.id)}/cancel`,
    { revision: correction.revision, reason },
    options,
  )
