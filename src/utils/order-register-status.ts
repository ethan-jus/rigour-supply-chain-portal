/**
 * 订单注册页面使用的内部状态文案。
 *
 * 切换后订单状态以订货宝映射后的内部 code 为准；飞书历史可能保留旧值，
 * 未命中映射时回退展示原值，不猜测含义。
 */
export const orderStatusLabels: Record<string, string> = {
  PENDING_OUTBOUND: '待出库',
  PENDING_SHIPPED: '待发货',
  RECEIVED: '已收货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  RETURNED: '已退货',
  SUBMITTED: '已提交',
}

export const orderPaymentStatusLabels: Record<string, string> = {
  UNPAID: '待收款',
  PARTIAL_PAID: '部分收款',
  PAID: '已收款',
  CANCELLED: '已取消',
  REFUNDED: '已退款',
  COMPLETED: '已完成',
}

export const paymentRecordStatusLabels: Record<string, string> = {
  PENDING: '待收款',
  CONFIRMED: '已收款',
  RECEIVED: '已收款',
  CANCELLED: '已取消',
  CHECKED: '已核对',
}

function mappedLabel(
  value: string | null | undefined,
  labels: Record<string, string>,
): string {
  const raw = value?.trim()
  if (!raw) return '-'
  return labels[raw] || labels[raw.toUpperCase()] || raw
}

export function orderStatusLabel(value: string | null | undefined): string {
  return mappedLabel(value, orderStatusLabels)
}

export function orderPaymentStatusLabel(value: string | null | undefined): string {
  return mappedLabel(value, orderPaymentStatusLabels)
}

export function paymentRecordStatusLabel(value: string | null | undefined): string {
  return mappedLabel(value, paymentRecordStatusLabels)
}

export function orderStatusTag(
  value: string | null | undefined,
): 'success' | 'info' | 'warning' | 'danger' | 'primary' {
  const raw = value?.toUpperCase()
  if (raw === 'COMPLETED' || raw === 'PAID' || raw === 'CONFIRMED' || raw === 'CHECKED')
    return 'success'
  if (raw === 'CANCELLED' || raw === 'RETURNED') return 'info'
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
  if (raw === 'UNPAID') return 'danger'
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
