import type { PayrollCommissionRow } from '@/api/core/payroll-scheme/models/PayrollCommissionRow'
import type { PayrollSchemeCommissionRule } from '@/api/core/payroll-scheme/models/PayrollSchemeCommissionRule'
import { newSchemeCommission } from './payroll-scheme'

const nameOf = (rule: PayrollSchemeCommissionRule) =>
  rule.name.replace(/\s*(城市总|销售)(提成)?$/, '').trim()
const scopeKey = (rule: PayrollSchemeCommissionRule) =>
  JSON.stringify([
    nameOf(rule),
    [...rule.categoryIds].sort(),
    [...rule.excludedCategoryIds].sort(),
    [...rule.variantIds].sort(),
    [...rule.excludedVariantIds].sort(),
  ])

/** Historical role rules are paired only when their complete scopes agree. */
export function commissionRows(rules: PayrollSchemeCommissionRule[]): PayrollCommissionRow[] {
  const groups: {
    key: string
    code: string
    sales?: PayrollSchemeCommissionRule
    manager?: PayrollSchemeCommissionRule
  }[] = []
  for (const rule of rules) {
    const role = rule.recipientRole === 'CITY_MANAGER' ? 'manager' : 'sales'
    const key = `${rule.rowCode || ''}:${scopeKey(rule)}`
    let group = groups.find((g) => g.key === key && !g[role])
    if (!group) {
      group = { key, code: rule.rowCode || crypto.randomUUID() }
      groups.push(group)
    }
    group[role] = { ...rule, rowCode: group.code }
  }
  return groups.map((g) => {
    const source = g.sales || g.manager!
    const name = nameOf(source)
    const missing = (role: string): PayrollSchemeCommissionRule => ({
      ...source,
      code: crypto.randomUUID(),
      rowCode: g.code,
      recipientRole: role,
      name,
      value: null,
      excluded: false,
    })
    return {
      code: g.code,
      name,
      sales: g.sales || missing('SALES'),
      manager: g.manager || missing('CITY_MANAGER'),
    }
  })
}

export function newCommissionRow(name = ''): PayrollCommissionRow {
  const code = crypto.randomUUID()
  return {
    code,
    name,
    sales: { ...newSchemeCommission(), rowCode: code, name },
    manager: { ...newSchemeCommission(), rowCode: code, name, recipientRole: 'CITY_MANAGER' },
  }
}

export function flattenCommissionRows(rows: PayrollCommissionRow[]): PayrollSchemeCommissionRule[] {
  return rows.flatMap((row) =>
    [row.sales, row.manager].map((rule) => ({
      ...rule,
      rowCode: row.code,
      name: row.name,
      categoryIds: [...row.sales.categoryIds],
      excludedCategoryIds: [...row.sales.excludedCategoryIds],
      variantIds: [...row.sales.variantIds],
      excludedVariantIds: [...row.sales.excludedVariantIds],
    })),
  )
}

export function commissionRowTotal(
  row: PayrollCommissionRow,
): { value: number; method: string; unitCode: string } | null {
  const active = [row.sales, row.manager].filter((rule) => !rule.excluded)
  if (!active.length) return { value: 0, method: 'NONE', unitCode: '' }
  if (active.some((r) => r.value == null)) return null
  const first = active[0]!
  if (
    active.some(
      (r) =>
        r.method !== first.method || (r.method === 'QUANTITY' && r.unitCode !== first.unitCode),
    )
  )
    return null
  // Display only; payroll uses decimal arithmetic on the server.
  return {
    value: Number(active.reduce((sum, r) => sum + Number(r.value), 0).toFixed(4)),
    method: first.method,
    unitCode: first.unitCode,
  }
}
