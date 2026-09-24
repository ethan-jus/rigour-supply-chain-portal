import type { SupplyDashboardOverview, SupplyDashboardRankingItem } from '@/api/core/bi'
import { meetingPeriods, type MeetingSnapshot } from '@/views/supply-chain/bi/meeting-model'

/** Synthetic fixtures only. Never imported by the production application. */
export function meetingFixture(): MeetingSnapshot {
  const periods = meetingPeriods('2026-09', new Date('2026-09-22T10:00:00+08:00'))
  const cities = ['杭州', '金华', '宁波', '北京', '上海', '苏州', '温州', '南京', '合肥']
  const amounts = [320000, 220000, 180000, 150000, 110000, 96000, 80000, 70000, 60000]
  const delta = [62000, 41000, 30000, -18000, -9000, 20000, 8000, 7000, 5000]
  const make = (previous: boolean): SupplyDashboardOverview => {
    const sales = amounts.reduce((sum, value, i) => sum + value - (previous ? delta[i] : 0), 0)
    const paid = previous ? 900000 : 1028000
    const receipt = previous ? 978000 : 1062000
    const metricValues: [string, number][] = [
      ['sales_amount', sales],
      ['paid_amount', paid],
      ['unpaid_amount', sales - paid],
      ['receipt_amount', receipt],
      ['cooperated_customer_count', previous ? 445 : 486],
      ['order_count', previous ? 1129 : 1248],
      ['repeat_customer_count', previous ? 185 : 218],
    ]
    const ranking: SupplyDashboardRankingItem[] = cities.map((name, i) => {
      const value = amounts[i] - (previous ? delta[i] : 0)
      return {
        rankType: 'CITY',
        dimensionCode: `CITY-${i}`,
        dimensionName: name,
        regionCode: `CITY-${i}`,
        regionName: name,
        salesAmount: value,
        paidAmount: (value / sales) * paid,
        unpaidAmount: (value / sales) * (sales - paid),
        orderCount: 180 - i * 10,
        customerCount: 95 - i * 6,
        rate: (paid / sales) * 100,
      }
    })
    const weights = [
      2, 2.6, 3.6, 4.3, 4.9, 4.5, 4.2, 5.3, 6.4, 5.9, 5.3, 6.5, 7.5, 8.2, 9.3, 10.5, 9.4, 8.6, 8.1,
      9, 10,
    ]
    const totalWeights = weights.reduce((sum, value) => sum + value, 0)
    const trend = (code: string, total: number) =>
      weights.map((weight, i) => ({
        metricCode: code,
        period: `2026-${previous ? '08' : '09'}-${String(i + 1).padStart(2, '0')}`,
        value: (weight / totalWeights) * total,
        secondaryValue: 0,
      }))
    const productNames = [
      '金汤肥牛粉面菜蛋',
      '天然饮用水 550ml',
      '油泼辣子干拌面',
      '澳洋华彩 A300',
      '葱油鸡肉菌菇拌面',
      '天然饮用水 1.5L',
    ]
    const products = productNames.map((name, i) => ({
      rankType: 'PRODUCT',
      dimensionCode: String(i + 1),
      dimensionName: name,
      categoryCode: '1',
      categoryName: '经营商品',
      salesAmount: 350000 - i * 45000,
      salesQuantity: 100,
      discountAmount: 0,
      refundAmount: 0,
      salesNetAmount: 350000 - i * 45000,
      estimatedCostAmount: 0,
      estimatedGrossProfit: 0,
      estimatedGrossProfitRate: 0,
      costCoverageRate: 0,
      orderCount: 150 - i * 15,
      customerCount: 90 - i * 8,
    }))
    return {
      ...(previous ? periods.previous : periods.current),
      generatedAt: '2026-09-22T02:00:00Z',
      metrics: metricValues.map(([metricCode, value]) => ({
        metricCode,
        value,
        metricName: metricCode,
        unit: 'CNY',
        previousValue: null,
        changeRate: null,
        description: null,
      })),
      salesTrend: trend('sales_amount', sales),
      collectionTrend: trend('receipt_amount', receipt),
      citySalesRanking: ranking,
      cityTargetCompletions: ranking.flatMap((row) =>
        (['SALES_AMOUNT', 'PAID_AMOUNT', 'RECEIPT_AMOUNT'] as const).map((metricCode) => ({
          dimensionType: 'CITY',
          dimensionCode: row.dimensionCode,
          dimensionName: row.dimensionName,
          metricCode,
          metricName: metricCode,
          targetValue:
            ((metricCode === 'SALES_AMOUNT' ? 1800000 : 1500000) * row.salesAmount) / sales,
          actualValue:
            metricCode === 'SALES_AMOUNT'
              ? row.salesAmount
              : metricCode === 'RECEIPT_AMOUNT'
                ? (row.salesAmount / sales) * receipt
                : row.paidAmount,
          achievementRate: 0,
          configuredMonthCount: 1,
          periodMonthCount: 1,
        })),
      ),
      salesTargetCompletions: [],
      productSalesRanking: products,
      categorySalesRanking: products
        .slice(0, 3)
        .map((row, i) => ({ ...row, dimensionName: ['方便食品', '饮用水', '台球用品'][i] })),
      customerActivityRanking: [
        '星辰台球俱乐部',
        '九号台球会馆',
        '城市运动空间',
        '北岸台球中心',
        '光点运动馆',
        '悦动台球俱乐部',
      ].map((customerName, i) => ({
        customerCode: `C-${i}`,
        customerName,
        regionCode: 'CITY-0',
        regionName: '杭州',
        ownerStaffCode: 'S-1',
        ownerStaffName: '演示销售',
        customerTypeCode: null,
        customerTypeName: null,
        segmentCode: '',
        segmentName: '',
        salesAmount: 180000 - i * 20000,
        paidAmount: 130000 - i * 18000,
        unpaidAmount: 50000 - i * 2000,
        orderCount: 48 - i * 5,
        paymentCount: 20,
        lastOrderTime: null,
        lastPaymentTime: null,
        inactiveDays: 0,
        activityScore: 0,
        churnRiskLevel: '',
      })),
      freshness: [
        {
          sourceCode: 'ORDER_SALES_ORDER',
          sourceName: '演示订单',
          latestUpdatedTime: '2026-09-22T02:00:00Z',
          status: 'READY',
          description: '合成测试数据，不是真实业务事实',
        },
      ],
      definitions: [],
      cityCostTrend: [],
      salesRanking: [],
      salesMonthlyPerformance: [],
      cityCollectionRateRanking: [],
      sourceSystemBreakdown: [],
      skuSalesRanking: [],
      brandSalesRanking: [],
      paymentRiskCityRanking: [],
      paymentRiskSalesRanking: [],
      paymentAgingBuckets: [],
      customerSegments: [],
      customerChurnRiskRanking: [],
      inventoryItemSummary: [],
      inventoryReplenishment: [],
      cityCostRanking: [],
      risks: [],
      rolePerspectives: [],
    }
  }
  return {
    current: make(false),
    previous: make(true),
    query: periods.current,
    previousQuery: periods.previous,
    trust: null,
    analysis: {
      ...periods.current,
      generatedAt: '2026-09-22T02:00:00Z',
      previousFrom: periods.previous.from,
      previousTo: periods.previous.to,
      previousSalesRanking: [],
      cityProducts: [],
      cityCustomers: [],
      salesReceipts: [],
      customerRetention: { orderingCustomerCount: 486, returningCustomerCount: 218 },
    },
  }
}
