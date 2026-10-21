import type {
  PaymentRiskCategory,
  PaymentRiskData,
  PaymentRiskLevel,
  PaymentRiskOrder,
  PaymentRiskProduct,
} from '@/api/core/payment-risk'

export const riskLevels: { key: PaymentRiskLevel; name: string; color: string }[] = [
  { key: 'LOW', name: '低风险', color: '#4ade80' },
  { key: 'MEDIUM', name: '中风险', color: '#ffd144' },
  { key: 'HIGH', name: '高风险', color: '#ff8c35' },
  { key: 'SEVERE', name: '严重风险', color: '#ff555c' },
  { key: 'UNKNOWN', name: '待确认', color: '#9ab2cb' },
]
export const unknownKey = '__UNKNOWN__'
export interface RiskFilters {
  region: string
  owner: string
  categories: string[]
  risk: string
  month: string
  product: string
}
export const emptyRiskFilters = (): RiskFilters => ({
  region: '',
  owner: '',
  categories: [],
  risk: '',
  month: '',
  product: '',
})

export function categoryMatches(
  id: string | null,
  selected: string[],
  categories: PaymentRiskCategory[],
) {
  if (!selected.length) return true
  if (id === null) return selected.includes(unknownKey)
  const catalog = new Map(categories.map((c) => [c.id, c]))
  const visited = new Set<string>()
  while (id && !visited.has(id)) {
    if (selected.includes(id)) return true
    visited.add(id)
    id = catalog.get(id)?.parentId ?? null
  }
  return false
}

const severity: Record<PaymentRiskLevel, number> = {
  UNKNOWN: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  SEVERE: 4,
}

/** 整单唯一归属：最高风险优先，同风险取商品行合计金额最大者，再以产品 ID 稳定排序。 */
export function attributedProduct(order: PaymentRiskOrder): PaymentRiskProduct {
  const products = new Map<string, PaymentRiskProduct>()
  for (const product of order.products) {
    const key = product.productId ?? `unknown:${product.categoryId}:${product.productName}`
    const previous = products.get(key)
    products.set(key, {
      ...product,
      productAmount:
        (Math.round((previous?.productAmount ?? 0) * 1e6) +
          Math.round(product.productAmount * 1e6)) /
        1e6,
    })
  }
  return (
    [...products.values()].sort((a, b) => {
      const priority =
        severity[b.riskLevel] - severity[a.riskLevel] || b.productAmount - a.productAmount
      if (priority) return priority
      const left = a.productId ?? '',
        right = b.productId ?? ''
      if (left !== right) return left < right ? -1 : 1
      return (a.productName ?? '') < (b.productName ?? '')
        ? -1
        : (a.productName ?? '') > (b.productName ?? '')
          ? 1
          : 0
    })[0] ?? {
      categoryId: null,
      categoryName: null,
      productId: null,
      productName: null,
      riskLevel: 'UNKNOWN',
      productAmount: 0,
    }
  )
}

/** 先确定整单归属，再按归属分类／风险／产品筛选，避免筛选时重复计单或改变风险。 */
export function selectRiskOrders(data: PaymentRiskData, filters: RiskFilters): PaymentRiskOrder[] {
  return [...new Map(data.orders.map((order) => [order.orderId, order])).values()].flatMap(
    (order) => {
      if (filters.region && (order.regionCode || unknownKey) !== filters.region) return []
      if (filters.owner && (order.ownerStaffCode || unknownKey) !== filters.owner) return []
      if (filters.month && order.orderDate.slice(0, 7) !== filters.month) return []
      const product = attributedProduct(order)
      if (
        !categoryMatches(product.categoryId, filters.categories, data.categories) ||
        (filters.risk && product.riskLevel !== filters.risk) ||
        (filters.product && (product.productId || unknownKey) !== filters.product)
      )
        return []
      return [{ ...order, products: [product] }]
    },
  )
}
export const orderAmount = (orders: PaymentRiskOrder[]) =>
  [...new Map(orders.map((o) => [o.orderId, o])).values()].reduce(
    (sum, o) => sum + Math.round(o.orderAmount * 1e6),
    0,
  ) / 1e6

export interface RiskGroup {
  key: string
  name: string
  amount: number
  count: number
}
export function groupRiskOrders(
  orders: PaymentRiskOrder[],
  memberships: (order: PaymentRiskOrder) => { key: string; name: string }[],
): RiskGroup[] {
  const groups = new Map<string, { name: string; orders: Map<string, PaymentRiskOrder> }>()
  for (const order of orders) {
    for (const member of memberships(order)) {
      const group = groups.get(member.key) || { name: member.name, orders: new Map() }
      group.orders.set(order.orderId, order)
      groups.set(member.key, group)
    }
  }
  return [...groups]
    .map(([key, group]) => ({
      key,
      name: group.name,
      amount: orderAmount([...group.orders.values()]),
      count: group.orders.size,
    }))
    .sort((a, b) => b.amount - a.amount || a.key.localeCompare(b.key))
}

export function riskGroups(orders: PaymentRiskOrder[]) {
  const groups = groupRiskOrders(orders, (o) => {
    const product = attributedProduct(o)
    return [
      { key: product.riskLevel, name: riskLevels.find((l) => l.key === product.riskLevel)!.name },
    ]
  })
  return riskLevels.map((level) => ({
    ...level,
    amount: groups.find((g) => g.key === level.key)?.amount ?? 0,
    count: groups.find((g) => g.key === level.key)?.count ?? 0,
  }))
}
export const percentage = (value: number, total: number) =>
  total > 0 ? `${((value / total) * 100).toFixed(1)}%` : '—'
export const wan = (value: number) =>
  (value / 10000).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export function monthsBetween(start: string, end: string) {
  const result: string[] = []
  if (!/^\d{4}-\d{2}$/.test(start) || !/^\d{4}-\d{2}$/.test(end) || start > end) return result
  let [year, month] = start.split('-').map(Number) as [number, number]
  while (`${year}-${String(month).padStart(2, '0')}` <= end) {
    result.push(`${year}-${String(month).padStart(2, '0')}`)
    month++
    if (month === 13) {
      month = 1
      year++
    }
  }
  return result
}

/** 空月份不占表格列；依据筛选后订单，不因金额／订单数切换改变。 */
export function activeOrderMonths(orders: PaymentRiskOrder[], start: string, end: string) {
  const present = new Set(
    orders.filter((order) => order.orderAmount > 0).map((order) => order.orderDate.slice(0, 7)),
  )
  return monthsBetween(start, end).filter((month) => present.has(month))
}

/** 城市月份格按其中最高订单风险着色，零金额保持正常底色。 */
export function matrixCellRisk(orders: PaymentRiskOrder[]): PaymentRiskLevel | 'NORMAL' {
  const unsettled = orders.filter((order) => order.orderAmount > 0)
  if (!unsettled.length) return 'NORMAL'
  return unsettled.reduce<PaymentRiskLevel>((highest, order) => {
    const level = attributedProduct(order).riskLevel
    return severity[level] > severity[highest] ? level : highest
  }, 'UNKNOWN')
}
