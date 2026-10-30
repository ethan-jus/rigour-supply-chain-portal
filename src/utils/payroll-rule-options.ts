import type { PayrollSchemeCommissionRule } from '@/api/core/payroll-scheme/models/PayrollSchemeCommissionRule'

// 新增、编辑、列表和详情共用选项；展示页不另行解释或改写保存值。
export const commissionMethodOptions = [
  { value: 'PERCENT', label: '按回款比例' },
  { value: 'QUANTITY', label: '按数量' },
  { value: 'NONE', label: '明确不计提' },
]
export const commissionDateOptions = [
  { value: 'ORDER_DATE', label: '订单日期' },
  { value: 'FULLY_PAID_DATE', label: '整单付清日期' },
]
export const checkinCountOptions = [
  { value: 'UNIQUE_CUSTOMER', label: '同一客户同日最多计1个' },
  { value: 'RECORD', label: '按审核通过的打卡记录计数' },
]
export const managerProtectionUnitOptions = [
  { value: 'MONTHS', label: '从入职日起顺延日历月' },
  { value: 'DAYS', label: '固定天数' },
]
export const managerSourceOptions = [
  { value: 'MANUAL_CONFIRMED', label: '业务核定并填写依据' },
  { value: 'CITY_RECEIPTS', label: '管辖城市全部有效回款（实际到账）' },
  { value: 'FULLY_PAID_RECEIPTS', label: '管辖城市整单付清业绩' },
  { value: 'ORDER_SALES', label: '管辖城市订单销售额' },
]
export const metricScoringOptions = [
  { value: 'ACTUAL', label: '按实际完成率' },
  { value: 'TIERED', label: '按阶梯计分' },
]
export const coefficientModeOptions = [
  { value: 'LINEAR', label: '完成率 × 倍数' },
  { value: 'FIXED', label: '直接采用固定系数' },
]
export const performanceModeOptions = (role: string, legacyManager = false) => [
  { value: 'SALES', label: '销售：打卡拜访与回款达标' },
  {
    value: 'MANAGER',
    label: legacyManager ? '城市总：历史综合完成率考核' : '城市总：单项指标计分后加权汇总',
  },
  { value: 'FIXED', label: role === 'HEADQUARTERS' ? '按个人月度完成率' : '固定绩效' },
  { value: 'NONE', label: '不计绩效' },
]

export function payrollOptionLabel(
  value: string | null | undefined,
  options: { value: string; label: string }[],
): string {
  return value
    ? options.find((option) => option.value === value)?.label || `历史配置（${value}）`
    : '-'
}
export function commissionMethodLabel(
  rule: Pick<PayrollSchemeCommissionRule, 'method' | 'excluded'> | null | undefined,
): string {
  return rule
    ? payrollOptionLabel(rule.excluded ? 'NONE' : rule.method, commissionMethodOptions)
    : '-'
}

// 与表单显示单位一致；不修改保存的秒数或完成率小数。
export const payrollMinimumMinutes = (seconds: number | null | undefined) =>
  seconds == null ? null : Number((seconds / 60).toFixed(2))
export const payrollRatePercent = (rate: number | null | undefined) =>
  rate == null ? null : Number((rate * 100).toFixed(4))
