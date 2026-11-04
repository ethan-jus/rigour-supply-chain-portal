import { businessDictionaryLabel, businessDictionaryOptions, loadBusinessDictionaries } from './business-dictionary'
export const paymentDictionaryRefs = ['ORDER_COLLECTION_STATUS', 'PAYMENT_RECEIPT_STATUS',
  'PAYMENT_CONFIRMATION_STATUS', 'PAYMENT_VOUCHER_AUDIT_STATUS', 'PAYMENT_VOUCHER_AUDIT_REASON']
  .map(code => ({ moduleCode: 'ORDER', code }))
export const loadPaymentDictionaries = () => loadBusinessDictionaries(paymentDictionaryRefs)
export const loadOrderDictionaries = () => loadBusinessDictionaries([
  { moduleCode: 'ORDER', code: 'SALES_ORDER_STATUS' }, ...paymentDictionaryRefs,
])
export const paymentDictionaryOptions = (code: string) => businessDictionaryOptions('ORDER', code)
export const receiptStatusCode = (code: string | null | undefined) => code === 'CHECKED' ? 'RECEIVED' : code
export const confirmationStatusCode = (code: string | null | undefined) => code === 'CHECKED' ? 'CONFIRMED' : code === 'RECEIVED' ? 'UNCONFIRMED' : null
export const paymentConfirmationLabel = (code: string | null | undefined) => businessDictionaryLabel('ORDER', 'PAYMENT_CONFIRMATION_STATUS', confirmationStatusCode(code))

// 名称和排序来自字典；可选编码必须是 Order 支持的主状态，历史自动项不可参与业务筛选。
const orderLifecycleCodes = new Set(['DRAFT', 'SUBMITTED', 'COMPLETED', 'CANCELLED', 'DELETED'])
export const orderLifecycleOptions = () => businessDictionaryOptions('ORDER', 'SALES_ORDER_STATUS')
  .filter(item => orderLifecycleCodes.has(item.value))

export function orderStatusLabel(value: string | null | undefined): string {
  return businessDictionaryLabel('ORDER', 'SALES_ORDER_STATUS', value)
}

export function orderPaymentStatusLabel(value: string | null | undefined): string {
  return businessDictionaryLabel('ORDER', 'ORDER_COLLECTION_STATUS', value)
}

export function paymentRecordStatusLabel(value: string | null | undefined): string {
  return businessDictionaryLabel('ORDER', 'PAYMENT_RECEIPT_STATUS', receiptStatusCode(value))
}

export function orderStatusTag(
  value: string | null | undefined,
): 'success' | 'info' | 'warning' | 'danger' | 'primary' {
  const raw = value?.toUpperCase()
  if (raw === 'COMPLETED' || raw === 'PAID' || raw === 'CONFIRMED' || raw === 'CHECKED')
    return 'success'
  if (raw === 'CANCELLED' || raw === 'DELETED' || raw === 'RETURNED') return 'info'
  if (raw === 'PARTIAL_PAID') return 'warning'
  if (raw === 'UNPAID' || raw === 'PENDING') return 'danger'
  return 'primary'
}

export function orderPaymentStatusTag(
  value: string | null | undefined,
): 'success' | 'info' | 'warning' | 'danger' | 'primary' {
  const raw = value?.toUpperCase()
  if (raw === 'PAID' || raw === 'COMPLETED') return 'success'
  if (raw === 'CANCELLED' || raw === 'REFUNDED') return 'info'
  if (raw === 'PARTIAL_PAID') return 'warning'
  if (raw === 'UNPAID') return 'warning'
  return 'primary'
}

export function paymentRecordStatusTag(
  value: string | null | undefined,
): 'success' | 'info' | 'warning' | 'danger' | 'primary' {
  const raw = value?.toUpperCase()
  if (raw === 'CONFIRMED' || raw === 'RECEIVED' || raw === 'CHECKED') return 'success'
  if (raw === 'CANCELLED') return 'info'
  if (raw === 'PENDING') return 'warning'
  return 'primary'
}

export function sourceSystemLabel(value: string | null | undefined): string {
  const raw = value?.toUpperCase()
  if (raw === 'DINGHUOBAO' || raw === 'DHB') return '订货宝'
  if (raw === 'FEISHU') return '飞书'
  return value || '-'
}

export function moneyText(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return `¥${Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function numberText(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  return Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

/** 页面合计使用；null 明确显示“未提供”，不用 0 冒充已知为零。 */
export function totalsText(value: number | null | undefined): string {
  return value === null || value === undefined ? '未提供' : moneyText(value)
}

/** 按筛选范围内的金额合计计算，不平均各订单回款率。 */
export function repaymentRateText(received: number | null | undefined, payable: number | null | undefined): string {
  if (received == null || payable == null || !Number.isFinite(received) || !Number.isFinite(payable) || payable === 0) return '-'
  return `${((received / payable) * 100).toFixed(2)}%`
}
