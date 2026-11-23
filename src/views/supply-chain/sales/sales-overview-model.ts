const currency = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export const overviewPageSize = 20

export function overviewMoney(value: number | null | undefined) {
  return value == null ? '—' : currency.format(value)
}

export function overviewRate(actual: number | null, target: number | null) {
  return actual != null && target != null && target > 0
    ? Math.round((actual / target) * 1000) / 10
    : null
}

export function summarizeOverviewGoal(rows: { actual: number | null; target: number | null }[]) {
  let actual = 0
  let target = 0
  let missing = 0
  let zero = 0
  for (const row of rows) {
    if (row.target == null) missing++
    else if (row.target === 0) zero++
    else if (row.target > 0 && row.actual != null) {
      target += row.target
      actual += row.actual
    }
  }
  const percent = overviewRate(actual, target)
  return {
    actual: target > 0 ? actual : null,
    target: target > 0 ? target : null,
    gap: target > 0 ? Math.max(0, target - actual) : null,
    percent,
    progress: Math.max(0, Math.min(100, percent ?? 0)),
    missing,
    zero,
  }
}
