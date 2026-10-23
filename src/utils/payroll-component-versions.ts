import type { PayrollComponentVersionView } from '@/api/core/payroll-scheme/models/PayrollComponentVersionView'
import type { PayrollComponentListRow } from '@/api/core/payroll-scheme/models/PayrollComponentListRow'
import type { PayrollComponentListGroup } from '@/api/core/payroll-scheme/models/PayrollComponentListGroup'

export function componentListGroupKey(row: PayrollComponentListRow): string {
  return row.ruleCode?.trim() || row.ruleId
}

/** Keep one rule's standards together when filtering and paginating the maintenance list. */
export function groupComponentListRows(
  rows: PayrollComponentListRow[],
): PayrollComponentListGroup[] {
  const groups = new Map<string, PayrollComponentListGroup>()
  for (const row of rows) {
    const key = componentListGroupKey(row)
    if (!groups.has(key)) groups.set(key, { key, rows: [] })
    groups.get(key)!.rows.push(row)
  }
  return [...groups.values()]
}

/** Match the same immutable version as the backend; an expired revision never revives an old one. */
export function componentVersionState(
  row: PayrollComponentVersionView,
  versions: PayrollComponentVersionView[],
  date: string,
): '使用中' | '待生效' | '已停用' | '已到期' | '历史版本' {
  const family = versions.filter((other) => !other.deleted && other.ruleId === row.ruleId)
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
  if (row.definition.effectiveTo < date) return '已到期'
  const state = (row.stateChanges ?? [])
    .filter((change) => change.effectiveMonth <= date.slice(0, 7))
    .sort((a, b) => b.revision - a.revision)[0]
  return state?.enabled === false ? '已停用' : '使用中'
}

export function visibleComponentVersions(
  versions: PayrollComponentVersionView[],
  date: string,
  includeHistory = false,
) {
  return versions
    .filter((row) => !row.deleted)
    .filter((row) => includeHistory || componentVersionState(row, versions, date) !== '历史版本')
    .sort((a, b) => a.ruleCode.localeCompare(b.ruleCode) || b.version - a.version)
}
