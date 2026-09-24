import type { SalesDashboardSnapshot } from '@/views/supply-chain/bi/sales-dashboard-model'
import { meetingFixture } from './bi-meeting-data'
/** Isolated synthetic visual/test data. Production does not import this module. */
export function salesDashboardFixture(): SalesDashboardSnapshot {
  const base = meetingFixture()
  const current = {
    ...base.current,
    from: '2026-08-01T00:00:00+08:00',
    to: '2026-08-31T23:59:59+08:00',
  }
  current.freshness.push({
    ...current.freshness[0]!,
    sourceCode: 'ORDER_PAYMENT_RECORD',
    status: 'READY',
  })
  const metrics = {
    sales_amount: 36000,
    receipt_amount: 24000,
    paid_amount: 27000,
    cooperated_customer_count: 24,
  }
  current.metrics = current.metrics.map((m) => ({
    ...m,
    value: metrics[m.metricCode as keyof typeof metrics] ?? m.value,
  }))
  current.salesTrend = [6000, 8000, 10000, 12000].map((value, i) => ({
    metricCode: 'sales_amount',
    period: `2026-08-${[1, 8, 15, 22][i].toString().padStart(2, '0')}`,
    value,
    secondaryValue: 0,
  }))
  current.collectionTrend = current.salesTrend.map((p) => ({
    ...p,
    metricCode: 'receipt_amount',
    value: (p.value * 2) / 3,
  }))
  const people = [
    {
      code: 'S1',
      name: '张明',
      city: '杭州市',
      employmentStatus: 'ACTIVE',
      sales: 36000,
      paid: 27000,
      receipts: 24000,
    },
    {
      code: 'S2',
      name: '李欣',
      city: '上海市',
      employmentStatus: 'ACTIVE',
      sales: 32000,
      paid: 24000,
      receipts: 28000,
    },
    {
      code: 'S3',
      name: '王强',
      city: '成都市',
      employmentStatus: 'ACTIVE',
      sales: 28000,
      paid: 14000,
      receipts: 20000,
    },
    {
      code: 'S4',
      name: '陈晨',
      city: '西安市',
      employmentStatus: 'LEFT',
      sales: 18000,
      paid: 9000,
      receipts: 0,
    },
    {
      code: 'S5',
      name: '离职零业绩',
      city: '杭州市',
      employmentStatus: 'LEFT',
      sales: 0,
      paid: 0,
      receipts: 0,
    },
    {
      code: 'S6',
      name: '在职零业绩',
      city: '杭州市',
      employmentStatus: 'ACTIVE',
      sales: 0,
      paid: 0,
      receipts: 0,
    },
  ]
  return {
    current,
    previous: {
      ...base.previous!,
      metrics: current.metrics.map((m) => ({ ...m, value: ((m.value ?? 0) * 5) / 6 })),
      from: '2026-07-01T00:00:00+08:00',
      to: '2026-07-31T23:59:59+08:00',
      salesTrend: current.salesTrend.map((p) => ({
        ...p,
        period: p.period.replace('-08-', '-07-'),
        value: (p.value * 5) / 6,
      })),
    },
    analysis: {
      from: current.from,
      to: current.to,
      generatedAt: current.generatedAt,
      previousFrom: base.previous!.from,
      previousTo: base.previous!.to,
      previousSalesRanking: [],
      cityProducts: [],
      cityCustomers: [],
      salesReceipts: [],
      customerRetention: {
        orderingCustomerCount: 24,
        returningCustomerCount: 9,
        newCustomerCount: 15,
        annualReturningCustomerCount: 12,
      },
    },
    sales: {
      people,
      goals: [
        { code: 'S1', month: 8, metric: 'NEW_CUSTOMER', target: 20 },
        { code: 'S1', month: 8, metric: 'REPEAT_CUSTOMER', target: 10 },
      ],
      history: { amount: 240000, received: 204000 },
      customers: [
        { code: 'A', name: 'A俱乐部', sales: 12000, received: 9000 },
        { code: 'B', name: 'B球房', sales: 8000, received: 6000 },
        { code: 'C', name: 'C体育', sales: 6000, received: 4500 },
      ],
      products: [
        {
          categoryId: 'cloth',
          category: '台呢',
          productId: 'P1',
          product: '澳洋华彩台呢',
          sku: 'A300',
          quantity: 12.5,
          sales: 18000,
          received: 13500,
          receipts: 12000,
          allocated: true,
        },
        {
          categoryId: 'cue',
          category: '球杆',
          productId: 'P2',
          product: '专业球杆',
          sku: 'C1',
          quantity: 12.5,
          sales: 12000,
          received: 9000,
          receipts: 8000,
          allocated: true,
        },
        {
          categoryId: 'parts',
          category: '配件',
          productId: 'P3',
          product: '巧克粉',
          sku: '标准',
          quantity: 12.5,
          sales: 6000,
          received: 4500,
          receipts: 4000,
          allocated: true,
        },
      ],
      months: [{ month: '2026-08', sales: 36000, received: 27000, receipts: 24000 }],
      receiptSplit: { currentOrders: 18000, historicalOrders: 6000, otherOrders: 0 },
      productSyncedAt: '2026-09-24T00:00:00Z',
      dailyReceipts: [],
    },
    previousSales: {
      people: people.map((p) => ({
        ...p,
        sales: (p.sales * 5) / 6,
        receipts: (p.receipts * 5) / 6,
      })),
      goals: [],
      history: null,
      customers: [],
      products: [],
      months: [],
      receiptSplit: null,
      productSyncedAt: null,
      dailyReceipts: [],
    },
    notice: '设计验证 · 模拟数据，不是业务统计',
  }
}
