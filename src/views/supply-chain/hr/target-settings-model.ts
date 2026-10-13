import type { TargetMetric, TargetSettings, TargetSubject } from '@/api/core/hr-target-settings'
export const targetMetrics: { code: TargetMetric; label: string; unit: string }[] = [
  { code: 'SALES_AMOUNT', label: '交易额', unit: '元' },
  { code: 'RECEIPT_AMOUNT', label: '本期到账金额', unit: '元' },
  { code: 'NEW_CUSTOMER', label: '新增合作客户', unit: '家' },
  { code: 'REPEAT_CUSTOMER', label: '复购客户', unit: '家' },
]
export function targetCell(data: TargetSettings, subject: TargetSubject, metric: TargetMetric) {
  const row = data.targets.find(
    (t) =>
      t.dimensionType === subject.dimensionType && t.code === subject.code && t.metric === metric,
  )
  if (!row) throw new Error('人事指标数据不完整，请重新加载')
  return { value: Number(row.value), revision: row.revision }
}
export function targetValueError(metric: TargetMetric, value: string): string | null {
  const text = value.trim()
  const pattern = metric.endsWith('CUSTOMER') ? /^\d+$/ : /^\d+(\.\d{1,2})?$/
  if (!pattern.test(text) || Number(text) > 999999999999.99)
    return metric.endsWith('CUSTOMER') ? '客户数须为非负整数' : '金额须为非负数，最多两位小数'
  return null
}
export function targetKey(subject: TargetSubject) {
  return `${subject.dimensionType}:${subject.code}`
}
