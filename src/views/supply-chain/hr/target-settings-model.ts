import type {
  TargetDimension,
  TargetMetric,
  TargetSettings,
  TargetSubject,
  TargetChange,
} from '@/api/core/bi-target-settings'
export const targetMetrics: { code: TargetMetric; label: string; unit: string }[] = [
  { code: 'SALES_AMOUNT', label: '交易额', unit: '元' },
  { code: 'RECEIPT_AMOUNT', label: '本期到账金额', unit: '元' },
  { code: 'NEW_CUSTOMER', label: '新增合作客户', unit: '家' },
  { code: 'REPEAT_CUSTOMER', label: '复购客户', unit: '家' },
]
export function defaultTarget(
  data: TargetSettings,
  type: TargetDimension,
  metric: TargetMetric,
  month = data.month,
): number {
  const rules = data.defaults
    .filter((d) => d.dimensionType === type && d.metric === metric && d.effectiveMonth <= month)
    .sort((a, b) => b.effectiveMonth.localeCompare(a.effectiveMonth))
  if (rules[0]) return Number(rules[0].value)
  if (metric === 'NEW_CUSTOMER') return 200
  if (metric === 'REPEAT_CUSTOMER') return 100
  return type === 'CITY' ? 100000 : metric === 'SALES_AMOUNT' ? 40000 : 20000
}
export function targetCell(data: TargetSettings, subject: TargetSubject, metric: TargetMetric) {
  const row = data.overrides.find(
    (o) =>
      o.dimensionType === subject.dimensionType && o.code === subject.code && o.metric === metric,
  )
  const configured = !!row && !row.deleted
  return {
    value: configured ? Number(row.value) : defaultTarget(data, subject.dimensionType, metric),
    configured,
    revision: row?.revision ?? 0,
    updatedAt: row?.updatedAt,
    updatedBy: row?.updatedBy,
  }
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
export function previousMonth(month: string) {
  const [year, number] = month.split('-').map(Number)
  return number === 1 ? `${year! - 1}-12` : `${year}-${String(number! - 1).padStart(2, '0')}`
}
/** Copy only explicit prior-month targets into currently inherited cells; never overwrite an explicit zero. */
export function copyPreviousTargets(
  current: TargetSettings,
  previous: TargetSettings,
  subjects: TargetSubject[],
): TargetChange[] {
  return subjects
    .filter((s) => s.writable)
    .flatMap((s) =>
      targetMetrics.flatMap((m) => {
        const now = targetCell(current, s, m.code)
        const before = previous.overrides.find(
          (o) =>
            o.dimensionType === s.dimensionType &&
            o.code === s.code &&
            o.metric === m.code &&
            !o.deleted,
        )
        return now.configured || !before
          ? []
          : [
              {
                dimensionType: s.dimensionType,
                code: s.code,
                metric: m.code,
                value: String(before.value),
                expectedRevision: now.revision,
              },
            ]
      }),
    )
}
