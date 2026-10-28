import type { PayrollDetail, PayrollRecord } from '@/api/core/payroll'
import type { PayrollCommissionCategory } from '@/api/core/payroll/models/PayrollCommissionCategory'
import type { PayrollCommissionProduct } from '@/api/core/payroll/models/PayrollCommissionProduct'

export const commissionCountExplanation =
  '订单数按订单去重；商品提成记录按订单中的商品行及提成角色分别统计，包含待核定记录，不是商品件数。'

export const commissionRole = (role: string) =>
  (
    ({ SALES: '销售提成', CITY_MANAGER: '城市总提成', CITY_TEAM: '团队提成' }) as Record<
      string,
      string
    >
  )[role] || role

/** Receipts belong to an order line, independently of the number of recipient roles. */
export function commissionCollections(lines: PayrollDetail[]): number | null {
  const receipts = new Map<string, number>()
  for (const line of lines) {
    const trace = line.trace
    const amount =
      trace?.collectionAmount ??
      (trace?.method === 'PERCENT' && trace.fullyPaidDate ? trace.baseAmount : null)
    if (amount == null) return null
    const key = JSON.stringify([
      trace?.orderId || line.orderNo,
      trace?.originalLineId || line.sourceLineId,
    ])
    const previous = receipts.get(key)
    if (previous != null && Math.abs(previous - amount) > 0.000001) return null
    receipts.set(key, amount)
  }
  return Math.round([...receipts.values()].reduce((sum, amount) => sum + amount, 0) * 100) / 100
}

function commissionCategory(line: PayrollDetail) {
  const product = line.trace?.product
  const path = (product?.categoryPath || product?.categoryName || '')
    .split(' / ')
    .map((s) => s.trim())
  if (path.includes('台球周边')) {
    const cloth = path.some((name) => name === '台呢' || name === '台尼')
    return {
      key: cloth ? 'BILLIARDS_CLOTH' : 'BILLIARDS_OTHER',
      name: cloth ? '台球周边 / 台呢' : '台球周边（不含台呢）',
    }
  }
  return {
    key: product?.categoryId == null ? 'UNKNOWN' : String(product.categoryId),
    name: product?.categoryPath || product?.categoryName || '历史快照未记录分类',
  }
}

/** 分类、规格和规则按稳定 ID 分组；不同单位、单价、受益角色不能混算。只汇总后端快照金额。 */
export function commissionCategories(lines: PayrollDetail[]): PayrollCommissionCategory[] {
  const categories = new Map<string, { name: string; products: Map<string, PayrollDetail[]> }>()
  for (const line of lines) {
    const product = line.trace?.product
    const { key: categoryKey, name } = commissionCategory(line)
    const category = categories.get(categoryKey) || {
      name,
      products: new Map<string, PayrollDetail[]>(),
    }
    const key = JSON.stringify([
      product?.variantId ?? line.trace?.variantId ?? line.productName,
      line.recipientRoleCode,
      line.unitCode,
      line.ruleId,
      line.ruleRevision,
      line.trace?.method,
      line.trace?.rate,
    ])
    category.products.set(key, [...(category.products.get(key) || []), line])
    categories.set(categoryKey, category)
  }
  const sum = (values: (number | null | undefined)[]) =>
    values.reduce<number>((c, v) => c + Math.round((v ?? 0) * 100), 0) / 100
  const countOrders = (values: PayrollDetail[]) =>
    new Set(values.map((d) => d.trace?.orderId || d.orderNo)).size
  return [...categories].map(([key, group]) => {
    const products: PayrollCommissionProduct[] = [...group.products].map(([key, lines]) => {
      const first = lines[0],
        trace = first.trace
      const pendingCount = lines.filter((d) => d.released == null).length
      const knownAmount = sum(lines.map((d) => d.released))
      return {
        key,
        collectionAmount: commissionCollections(lines),
        name: first.productName,
        variantCode: trace?.product?.variantCode || '—',
        role: commissionRole(first.recipientRoleCode),
        unit: first.unitCode,
        quantity: Math.round(lines.reduce((s, d) => s + d.quantity, 0) * 10000) / 10000,
        base: lines.some((d) => d.trace?.baseAmount == null)
          ? null
          : Math.round(lines.reduce((sum, d) => sum + (d.trace?.baseAmount ?? 0), 0) * 10000) /
            10000,
        rate: trace?.rate ?? null,
        method: trace?.method ?? null,
        rule: first.ruleName || '未匹配',
        ruleCode: trace?.appliedRule?.ruleCode || trace?.ruleCode || '—',
        version: first.ruleRevision,
        orderCount: countOrders(lines),
        amount: pendingCount ? null : knownAmount,
        knownAmount,
        pendingCount,
        lines,
      }
    })
    const all = products.flatMap((p) => p.lines)
    const pendingCount = products.reduce((s, p) => s + p.pendingCount, 0)
    const knownAmount = sum(products.map((p) => p.knownAmount))
    return {
      key,
      name: group.name,
      collectionAmount: commissionCollections(all),
      products,
      orderCount: countOrders(all),
      lineCount: all.length,
      amount: pendingCount ? null : knownAmount,
      knownAmount,
      pendingCount,
    }
  })
}

export function payrollAppliedRules(row: PayrollRecord) {
  const rules = [
    ...(row.calculation.scheme?.appliedRules || []),
    ...row.calculation.details.flatMap((d) => (d.trace?.appliedRule ? [d.trace.appliedRule] : [])),
  ]
  return [...new Map(rules.map((rule) => [rule.versionId, rule])).values()]
}
