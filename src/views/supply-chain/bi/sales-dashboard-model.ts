import type { SupplyDashboardOverview, SupplyDashboardOperatingAnalysis } from '@/api/core/bi'
import type { SalesAnalysis } from '@/api/core/bi-sales-dashboard'
import { meetingMetric, rate } from './meeting-model'
export interface SalesDashboardSnapshot {
  current: SupplyDashboardOverview
  previous: SupplyDashboardOverview | null
  analysis: SupplyDashboardOperatingAnalysis | null
  sales: SalesAnalysis | null
  previousSales: SalesAnalysis | null
  notice?: string
}
export function salesProductTotals(products: SalesAnalysis['products']) {
  // 保留后端分摊精度，合计后再格式化；逐行取分会使合计偏离实际到账。
  const sum = (key: 'sales' | 'receipts' | 'received') =>
    products.reduce((total, p) => total + Math.round(p[key] * 1e6), 0) / 1e6
  return {
    quantity: products.some((p) => p.quantity == null)
      ? null
      : products.reduce((total, p) => total + Math.round(p.quantity! * 1e6), 0) / 1e6,
    sales: sum('sales'),
    receipts: sum('receipts'),
    received: sum('received'),
    allocated: products.every((p) => p.allocated),
  }
}
export function personalGoal(
  data: SalesAnalysis | null | undefined,
  code: string,
  metric: string,
  month: number | null,
) {
  const months = month == null ? Array.from({ length: 12 }, (_, i) => i + 1) : [month]
  let total = 0
  for (const m of months) {
    const value = data?.goals.find(
      (g) => g.code === code && g.month === m && g.metric === metric,
    )?.target
    if (value == null) return { value: null }
    total += value
  }
  return { value: total }
}
export function salesDashboardRows(
  snapshot: SalesDashboardSnapshot | null,
  receipt: boolean,
  month: number | null,
  search = '',
) {
  if (!snapshot?.sales) return []
  const key = receipt ? 'receipts' : 'sales'
  const ready = meetingMetric(snapshot.current, receipt ? 'receipt_amount' : 'sales_amount') != null
  const previousReady =
    snapshot.previousSales != null &&
    meetingMetric(snapshot.previous, receipt ? 'receipt_amount' : 'sales_amount') != null
  const previous = new Map(snapshot.previousSales?.people.map((p) => [p.code, p]) || [])
  const people = new Map([...previous.values(), ...snapshot.sales.people].map((p) => [p.code, p]))
  const current = new Map(snapshot.sales.people.map((p) => [p.code, p]))
  return [...people.values()]
    .map((person) => {
      const now = current.get(person.code)
      const amount = ready ? (now?.[key] ?? 0) : null
      const prior = previousReady ? (previous.get(person.code)?.[key] ?? 0) : null
      const paid = meetingMetric(snapshot.current, 'paid_amount') != null ? (now?.paid ?? 0) : null
      const goal = personalGoal(
        snapshot.sales,
        person.code,
        receipt ? 'RECEIPT_AMOUNT' : 'SALES_AMOUNT',
        month,
      )
      return {
        ...person,
        amount,
        previous: prior,
        paid,
        collectionRate: rate(paid, now?.sales ?? 0),
        delta: amount != null && prior != null ? amount - prior : null,
        target: goal.value,
      }
    })
    .filter((p) => !(p.employmentStatus === 'LEFT' && p.amount === 0))
    .sort(
      (a, b) => (b.amount ?? -Infinity) - (a.amount ?? -Infinity) || a.code.localeCompare(b.code),
    )
    .map((p, i) => ({ ...p, rank: i + 1 }))
    .filter((p) => !search || `${p.name}${p.city}`.includes(search.trim()))
}
export function salesCustomerStats(snapshot: SalesDashboardSnapshot | null, annual: boolean) {
  const source = snapshot?.analysis?.customerRetention
  const ready = meetingMetric(snapshot?.current, 'cooperated_customer_count') != null
  const customers = ready ? (source?.orderingCustomerCount ?? null) : null
  const returning = ready
    ? ((annual ? source?.annualReturningCustomerCount : source?.returningCustomerCount) ?? null)
    : null
  return {
    customers,
    returning,
    newCustomers: ready ? (source?.newCustomerCount ?? null) : null,
    rate: rate(returning, customers),
  }
}
