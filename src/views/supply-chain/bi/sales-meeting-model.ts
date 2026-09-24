import { businessMonthRange } from '@/utils/business-date'

export interface SalesPeriod {
  from: string
  to: string
}
export interface SalesCohort {
  amount: number | null
  received: number | null
}
export interface SalesMonth extends SalesPeriod {
  month: string
  sales: number | null
  receipts: number | null
  salesTarget: number | null
  receiptTarget: number | null
}
export interface SalesProduct {
  categoryId: string
  category: string
  productId: string
  product: string
  sku: string
  sales: number | null
  receipts: number | null
}
export interface SalesPerson {
  code: string
  name: string
  cityCode: string
  city: string
  sales: number | null
  receipts: number | null
  salesTarget: number | null
  receiptTarget: number | null
  cohort: SalesCohort | null
  history: SalesCohort | null
  months: SalesMonth[]
  products: SalesProduct[] | null
}
export interface SalesMeetingData {
  period: SalesPeriod
  asOf: string | null
  people: SalesPerson[]
  notice?: string
}
export function salesMonthPeriod(month: string, maxDate: string): SalesPeriod {
  const [from, end] = businessMonthRange(month)
  return { from, to: end > maxDate ? maxDate : end }
}
export function validSalesPeriod(period: SalesPeriod, maxDate: string) {
  const valid = (date: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date
  return valid(period.from) && valid(period.to) && period.from <= period.to && period.to <= maxDate
}
