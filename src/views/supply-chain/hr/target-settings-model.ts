import type { TargetMetric, TargetSettings, TargetSubject } from '@/api/core/hr-target-settings'
export const targetMetrics: {
  code: TargetMetric
  label: string
  unit: string
  description: string
}[] = [
  {
    code: 'CONTACTED_STORE_COUNT',
    label: '建联门店数',
    unit: '家',
    description: '当月拜访并新增添加至企业微信的去重门店',
  },
  {
    code: 'ORDERED_STORE_COUNT',
    label: '有效门店数',
    unit: '家',
    description: '当月有有效下单的去重合作门店，包含新老客户',
  },
  {
    code: 'YANGZHANGGUI_SALES_AMOUNT',
    label: '杨掌柜品牌销售额',
    unit: '元',
    description: '当月杨掌柜品牌商品销售额，包含在销售总额内',
  },
  { code: 'SALES_AMOUNT', label: '销售总额', unit: '元', description: '当月全部品牌销售总额' },
  {
    code: 'RECEIPT_AMOUNT',
    label: '回款额',
    unit: '元',
    description: '按实际收款日期统计当月到账金额',
  },
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
  const pattern = metric.endsWith('_COUNT') ? /^\d+$/ : /^\d+(\.\d{1,2})?$/
  if (!pattern.test(text) || Number(text) > 999999999999.99)
    return metric.endsWith('_COUNT') ? '门店数须为非负整数' : '金额须为非负数，最多两位小数'
  return null
}
export function targetKey(subject: TargetSubject) {
  return `${subject.dimensionType}:${subject.code}`
}
