import { randomId } from '@/utils/random-id'
import type { PayrollCommissionRow } from '@/api/core/payroll-scheme/models/PayrollCommissionRow'
import type { PayrollProduct } from '@/api/core/payroll'
import type { PayrollSchemeCommissionRule } from '@/api/core/payroll-scheme/models/PayrollSchemeCommissionRule'
import { newSchemeCommission } from './payroll-scheme'

export function commissionProductRows(
  rule: Pick<PayrollSchemeCommissionRule, 'name' | 'variantIds'>,
  products: PayrollProduct[],
) {
  if (!rule.variantIds.length)
    return [
      {
        variantId: '',
        productName: nameOf(rule),
        specification: null as string | null,
        categoryId: null as number | null,
        categoryName: null as string | null,
      },
    ]
  return [...new Set(rule.variantIds.map(String))].map((variantId) => {
    const product = products.find((item) => String(item.productVariantId) === variantId)
    return {
      variantId,
      productName: product?.productName ?? '',
      specification: product?.specification ?? null,
      categoryId: product?.categoryId ?? null,
      categoryName: product?.categoryName ?? null,
    }
  })
}

const nameOf = (rule: Pick<PayrollSchemeCommissionRule, 'name'>) =>
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
  for (const stored of rules) {
    // Small Java Long values arrive as JSON numbers; selectors use string IDs.
    const rule = {
      ...stored,
      variantIds: stored.variantIds.map(String),
      excludedVariantIds: stored.excludedVariantIds.map(String),
    }
    const role = rule.recipientRole === 'CITY_MANAGER' ? 'manager' : 'sales'
    const legacyUnit = rule.rowCode ? '' : rule.method === 'QUANTITY' ? rule.unitCode : '*'
    const key = `${rule.rowCode || legacyUnit}:${scopeKey(rule)}`
    let group = groups.find((g) => g.key === key && !g[role])
    if (!group) {
      group = { key, code: rule.rowCode || randomId() }
      groups.push(group)
    }
    group[role] = { ...rule, rowCode: group.code }
  }
  return groups.map((g) => {
    const source = g.sales || g.manager!
    const name = nameOf(source)
    const missing = (role: string): PayrollSchemeCommissionRule => ({
      ...source,
      code: randomId(),
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
  const code = randomId()
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

/** Group units of the same named product scope without changing their saved identities or amounts. */
export function groupCommissionRows(rows: PayrollCommissionRow[]): PayrollCommissionRow[][] {
  const groups = new Map<string, PayrollCommissionRow[]>()
  for (const row of rows) {
    const scope = row.sales
    const ordered = (ids: (string | number)[]) => [...new Set(ids.map(String))].sort()
    const key = JSON.stringify([
      row.name.trim(),
      ordered(scope.categoryIds),
      ordered(scope.excludedCategoryIds),
      ordered(scope.variantIds),
      ordered(scope.excludedVariantIds),
    ])
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(row)
  }
  return [...groups.values()]
}

/** A different amount or row name cannot make identical matching conditions unambiguous. */
export function duplicateCommissionScope(rows: PayrollCommissionRow[]): string | null {
  const seen = new Map<string, string>()
  const ordered = (ids: (string | number)[]) => [...new Set(ids.map(String))].sort()
  for (const row of rows) {
    const scope = row.sales
    for (const rule of [row.sales, row.manager]) {
      const key = JSON.stringify([
        rule.recipientRole,
        scope.variantIds.length ? [] : ordered(scope.categoryIds),
        ordered(scope.excludedCategoryIds),
        ordered(scope.variantIds),
        ordered(scope.excludedVariantIds),
        rule.method === 'QUANTITY' ? rule.unitCode : '*',
      ])
      const previous = seen.get(key)
      if (previous)
        return `「${previous}」与「${row.name}」的${rule.recipientRole === 'SALES' ? '销售' : '城市总'}商品范围和计提单位重复，请合并为一条标准；金额不同也不能重复配置`
      seen.set(key, row.name)
    }
  }
  return null
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
