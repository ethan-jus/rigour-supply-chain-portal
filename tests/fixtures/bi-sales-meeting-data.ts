import type {
  SalesMeetingData,
  SalesPeriod,
  SalesPerson,
  SalesProduct,
} from '@/views/supply-chain/bi/sales-meeting-model'
import { businessMonthRange } from '@/utils/business-date'

const seeds = [
  ['陈晨', '上海', 48, 36, 40, 40],
  ['李娜', '宁波', 40.5, 45.2, 45, 40],
  ['张伟', '杭州', 32, 26.8, 40, 34],
  ['王磊', '苏州', 29, 31.5, 35, 35],
  ['刘洋', '金华', 25.6, 21.6, 32, 30],
  ['赵敏', '北京', 22, 24, 30, 30],
  ['周明', '南京', 18.6, 16.8, 25, 24],
] as const
const otherNames = [
  '徐斌',
  '吴静',
  '郑凯',
  '孙悦',
  '马超',
  '胡欣',
  '朱俊',
  '郭婷',
  '何健',
  '高洁',
  '林峰',
  '罗丹',
  '宋航',
  '谢莉',
  '唐浩',
  '许宁',
  '韩雪',
  '曹宇',
  '冯博',
  '邓颖',
  '彭涛',
]
const products: SalesProduct[] = [
  {
    categoryId: 'cloth',
    category: '台呢',
    productId: 'cloth-pro',
    product: '比赛台呢',
    sku: 'PNS990',
    sales: 120000,
    receipts: 96000,
  },
  {
    categoryId: 'cloth',
    category: '台呢',
    productId: 'cloth-training',
    product: '训练台呢',
    sku: 'PNS900',
    sales: 80000,
    receipts: 72000,
  },
  {
    categoryId: 'cue',
    category: '球杆',
    productId: 'cue-chinese',
    product: '中式球杆',
    sku: 'C582',
    sales: 50000,
    receipts: 46000,
  },
  {
    categoryId: 'parts',
    category: '球台配件',
    productId: 'cushion',
    product: '台球胶边',
    sku: 'K55',
    sales: 30000,
    receipts: 24000,
  },
  {
    categoryId: 'chalk',
    category: '巧克粉',
    productId: 'chalk-pro',
    product: '比赛巧克粉',
    sku: 'CP01',
    sales: 25000,
    receipts: 20000,
  },
  {
    categoryId: 'other',
    category: '其他',
    productId: 'cleaning',
    product: '清洁套装',
    sku: 'CL02',
    sales: 15000,
    receipts: 10000,
  },
]
const round = (value: number) => Math.round(value * 100) / 100
const monthlyFactors = (month: number) => ({
  sales: ([20, 24, 26, 28, 30, 32, 24][month - 3] ?? 20) / 32,
  receipts: ([18, 21, 25, 26, 28.5, 26.8, 23][month - 3] ?? 18) / 26.8,
  salesTarget: ([30, 30, 30, 35, 35, 40, 40][month - 3] ?? 30) / 40,
  receiptTarget: ([28, 28, 30, 30, 30, 34, 34][month - 3] ?? 28) / 34,
})

/** Synthetic data is confined to tests/fixtures; never imported by the production entry. */
export function salesMeetingFixture(
  period: SalesPeriod = { from: '2026-08-01', to: '2026-08-31' },
): SalesMeetingData {
  const allSeeds: (readonly [string, string, number, number, number, number])[] = [
    ...seeds,
    ...otherNames.map(
      (name, i) =>
        [
          name,
          ['上海', '杭州', '宁波', '苏州'][i % 4]!,
          17 - i * 0.7,
          15 - i * 0.6,
          25,
          24,
        ] as const,
    ),
  ]
  let salesFactor = 0,
    receiptFactor = 0,
    salesGoalFactor = 0,
    receiptGoalFactor = 0
  for (
    let date = new Date(`${period.from.slice(0, 7)}-01T00:00:00Z`);
    date.toISOString().slice(0, 10) <= period.to;
    date.setUTCMonth(date.getUTCMonth() + 1)
  ) {
    const month = date.toISOString().slice(0, 7)
    const [start, end] = businessMonthRange(month)
    const days =
      (Date.parse(end < period.to ? end : period.to) -
        Date.parse(start > period.from ? start : period.from)) /
        86400000 +
      1
    const fraction = Math.max(0, days) / Number(end.slice(8))
    const factors = monthlyFactors(Number(month.slice(5)))
    salesFactor += factors.sales * fraction
    receiptFactor += factors.receipts * fraction
    salesGoalFactor += factors.salesTarget
    receiptGoalFactor += factors.receiptTarget
  }
  const people: SalesPerson[] = allSeeds.map(
    ([name, city, salesBase, receiptBase, salesGoal, receiptGoal], i) => {
      const sales = round(salesBase * 10000 * salesFactor),
        receipts = round(receiptBase * 10000 * receiptFactor)
      const year = period.to.slice(0, 4)
      const endMonth = Number(period.to.slice(5, 7))
      const months = Array.from({ length: Math.min(endMonth, 6) }, (_, index) => {
        const monthNumber = endMonth - Math.min(endMonth, 6) + index + 1
        const month = `${year}-${String(monthNumber).padStart(2, '0')}`
        const factors = monthlyFactors(monthNumber)
        const [from, end] = businessMonthRange(month)
        const to = end > '2026-09-22' ? '2026-09-22' : end
        const coverage = Number(to.slice(8)) / Number(end.slice(8))
        return {
          month,
          from,
          to,
          sales: round(salesBase * factors.sales * 10000 * coverage),
          receipts: round(receiptBase * factors.receipts * 10000 * coverage),
          salesTarget: round(salesGoal * factors.salesTarget * 10000),
          receiptTarget: round(receiptGoal * factors.receiptTarget * 10000),
        }
      })
      return {
        code: `sales-${i + 1}`,
        name,
        cityCode: city,
        city,
        sales,
        receipts,
        salesTarget: round(salesGoal * salesGoalFactor * 10000),
        receiptTarget: round(receiptGoal * receiptGoalFactor * 10000),
        cohort: { amount: sales, received: round(sales * 0.8) },
        history: { amount: salesBase * 75000, received: salesBase * 67500 },
        months,
        products: products.map((product) => ({
          ...product,
          sales: round((product.sales! * sales) / 320000),
          receipts: round((product.receipts! * receipts) / 268000),
        })),
      }
    },
  )
  return { period, asOf: '2026-09-22', people }
}
