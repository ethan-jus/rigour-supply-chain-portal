import type { MeetingSnapshot } from '@/views/supply-chain/bi/meeting-model'
import { meetingPeriods } from '@/views/supply-chain/bi/meeting-model'
import { meetingFixture } from './bi-meeting-data'

/** Fictional cities and payments only, never imported by production. */
export function cityMeetingFixture(regionCode = ''): MeetingSnapshot {
  const snapshot = structuredClone(meetingFixture())
  const periods = meetingPeriods('2026-09', new Date('2026-09-23T09:00:00+08:00'))
  const names = ['杭州', '金华', '宁波', '苏州', '上海', '北京']
  const sales = [320000, 260000, 230000, 180000, 160000, 136000]
  // Ningbo ranks first in receipts but third in sales, demonstrating independent rankings.
  const receipts = [268000, 220000, 298000, 148000, 121000, 7000]
  const customers = [112, 98, 91, 76, 61, 48]
  const returning = [56, 52, 43, 40, 32, 20]
  const salesTargets = [400000, 350000, 300000, 250000, 250000, 250000]
  const receiptTargets = [340000, 290000, 250000, 210000, 210000, 200000]
  const index = regionCode ? Number(regionCode.split('-')[1]) : -1
  const indexes = index >= 0 ? [index] : names.map((_, i) => i)
  const sum = (values: number[]) => indexes.reduce((total, i) => total + values[i], 0)
  for (const [data, previous] of [
    [snapshot.current, false],
    [snapshot.previous!, true],
  ] as const) {
    const factor = previous ? 0.88 : 1
    const values: Record<string, number> = {
      sales_amount: sum(sales) * factor,
      receipt_amount: sum(receipts) * factor,
      cooperated_customer_count: sum(customers),
      order_count: indexes.reduce((n, i) => n + 300 - i * 20, 0),
      paid_amount: sum(sales) * 0.8,
      unpaid_amount: sum(sales) * 0.2,
    }
    data.metrics.forEach((row) => {
      if (row.metricCode in values) row.value = values[row.metricCode]
    })
    data.citySalesRanking = indexes.map((i) => ({
      ...data.citySalesRanking[0],
      dimensionCode: `CITY-${i}`,
      dimensionName: names[i],
      regionCode: `CITY-${i}`,
      regionName: names[i],
      salesAmount: sales[i] * factor,
      paidAmount: sales[i] * 0.8,
      unpaidAmount: sales[i] * 0.2,
      orderCount: 300 - i * 20,
      customerCount: customers[i],
    }))
    data.cityTargetCompletions = indexes.flatMap((i) =>
      (['SALES_AMOUNT', 'RECEIPT_AMOUNT'] as const).map((metricCode) => ({
        dimensionType: 'CITY',
        dimensionCode: `CITY-${i}`,
        dimensionName: names[i],
        metricCode,
        metricName: metricCode,
        actualValue: (metricCode === 'SALES_AMOUNT' ? sales[i] : receipts[i]) * factor,
        targetValue: metricCode === 'SALES_AMOUNT' ? salesTargets[i] : receiptTargets[i],
        achievementRate: 0,
        configuredMonthCount: 1,
        periodMonthCount: 1,
      })),
    )
    const weights = Array.from({ length: 22 }, (_, i) => 1 + i * 0.04 + Math.sin(i) * 0.2)
    const total = weights.reduce((n, w) => n + w, 0)
    for (const [key, value] of [
      ['salesTrend', values.sales_amount],
      ['collectionTrend', values.receipt_amount],
    ] as const)
      data[key] = weights.map((weight, i) => ({
        period: `2026-${previous ? '08' : '09'}-${String(i + 1).padStart(2, '0')}`,
        value: (value * weight) / total,
        metricCode: key === 'salesTrend' ? 'sales_amount' : 'receipt_amount',
        secondaryValue: 0,
      }))
    Object.assign(data, previous ? periods.previous : periods.current)
  }
  snapshot.query = { ...periods.current, ...(regionCode ? { regionCode } : {}) }
  snapshot.previousQuery = { ...periods.previous, ...(regionCode ? { regionCode } : {}) }
  snapshot.analysis = {
    ...periods.current,
    generatedAt: '2026-09-23T01:00:00Z',
    previousFrom: periods.previous.from,
    previousTo: periods.previous.to,
    previousSalesRanking: [],
    cityProducts: [],
    cityCustomers: [],
    salesReceipts: [],
    cityReceipts: indexes.map((i) => ({
      regionCode: `CITY-${i}`,
      regionName: names[i],
      receiptAmount: receipts[i],
      paymentCount: 100 - i * 8,
      customerCount: customers[i],
    })),
    customerRetention: {
      orderingCustomerCount: sum(customers),
      returningCustomerCount: sum(returning),
    },
  }
  return snapshot
}
