import type { PayrollComponentVersionView } from '@/api/core/payroll-scheme/models/PayrollComponentVersionView'

/** Match the same immutable version as the backend; an expired revision never revives an old one. */
export function componentVersionState(
  row: PayrollComponentVersionView,
  versions: PayrollComponentVersionView[],
  date: string,
): '当前生效' | '待生效' | '已到期' | '历史版本' {
  const family = versions.filter((other) => other.ruleId === row.ruleId)
  if (row.definition.effectiveFrom > date) {
    return family.some(
      (other) =>
        other.version > row.version &&
        other.definition.effectiveFrom <= row.definition.effectiveFrom,
    )
      ? '历史版本'
      : '待生效'
  }
  const selected = family
    .filter((other) => other.definition.effectiveFrom <= date)
    .sort((a, b) => b.version - a.version)[0]
  if (selected?.id !== row.id) return '历史版本'
  return row.definition.effectiveTo < date ? '已到期' : '当前生效'
}

export function visibleComponentVersions(
  versions: PayrollComponentVersionView[],
  date: string,
  includeHistory = false,
) {
  return versions
    .filter((row) => includeHistory || componentVersionState(row, versions, date) !== '历史版本')
    .sort((a, b) => a.ruleCode.localeCompare(b.ruleCode) || b.version - a.version)
}
