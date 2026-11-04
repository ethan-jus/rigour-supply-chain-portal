import {
  businessDictionaryLabel,
  businessDictionaryOptions,
  loadBusinessDictionaries,
} from '@/utils/business-dictionary'
export const COST_DICTIONARIES = [
  'MARKETING_EXPENSE_TYPE',
  'REIMBURSEMENT_EXPENSE_TYPE',
  'COST_TRANSPORT_METHOD',
  'COST_TRANSPORT_KIND',
  'COST_LOGISTICS_LEG',
  'COST_PAYER',
  'COST_PAYMENT_STATUS',
  'COST_STATUS',
  'COST_PREMISES_TYPE',
  'PRODUCT_UNIT',
  'COST_CARRIER',
  'COST_LOGISTICS_FEE_TYPE',
  'COST_WAREHOUSE_FEE_TYPE',
  'COST_TRANSPORT_PURPOSE',
  'COST_DELIVERY_MODE',
  'COST_WAREHOUSE_ALLOCATION_METHOD',
] as const
export const loadCostDictionaries = (category?: string) => {
  const byCategory: Record<string, string[]> = {
    logistics: ['COST_LOGISTICS_LEG', 'COST_PAYER', 'COST_TRANSPORT_METHOD', 'COST_TRANSPORT_KIND', 'PRODUCT_UNIT', 'WAREHOUSE_TYPE', 'COST_CARRIER', 'COST_LOGISTICS_FEE_TYPE', 'COST_TRANSPORT_PURPOSE', 'COST_DELIVERY_MODE'],
    marketing: ['MARKETING_EXPENSE_TYPE'],
    expenses: ['REIMBURSEMENT_EXPENSE_TYPE', 'COST_LOGISTICS_LEG'],
    'warehouse-rentals': ['COST_PREMISES_TYPE', 'COST_WAREHOUSE_FEE_TYPE', 'COST_WAREHOUSE_ALLOCATION_METHOD', 'PRODUCT_UNIT'],
    'office-rentals': ['COST_PREMISES_TYPE'],
    purchases: ['PRODUCT_UNIT'],
    losses: ['PRODUCT_UNIT'],
  }
  const codes = category
    ? ['COST_STATUS', 'COST_PAYMENT_STATUS', ...(byCategory[category] || [])]
    : COST_DICTIONARIES
  return loadBusinessDictionaries(codes.map((code) => ({ moduleCode: '', code })))
}
export const costOptions = (code: string) => businessDictionaryOptions('', code)
export const costLabel = (code: string, value: string | null | undefined) =>
  businessDictionaryLabel('', code, value)
export const costMoney = (value: number | null | undefined) =>
  value == null
    ? '待补金额'
    : Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
