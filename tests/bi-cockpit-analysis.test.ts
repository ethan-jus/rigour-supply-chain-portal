import { describe, expect, it } from 'vitest'
import type {
  SupplyDashboardOverview,
  SupplyDashboardRankingItem,
  SupplyDashboardOperatingAnalysis,
} from '@/api/core/bi'
import { buildCockpit, type CockpitOptions } from '@/views/supply-chain/bi/cockpit-model'
import { operatingAnalysisFigures } from '@/views/supply-chain/bi/cockpit-analysis'
import {
  concreteDimension,
  drillScope,
  supportsCategoryFilter,
} from '@/views/supply-chain/bi/cockpit-scope'

const options: CockpitOptions = {
  productDimension: 'PRODUCT',
  period: 'month',
  inventoryUnit: 'BOX',
  costGroup: '全部',
}
const seller = (code: string, sales: number, paid: number) =>
  ({
    dimensionCode: code,
    dimensionName: code,
    regionCode: 'MULTI',
    regionName: '跨城市',
    salesAmount: sales,
    paidAmount: paid,
    unpaidAmount: sales - paid,
    customerCount: 1,
    orderCount: 1,
    rate: 0,
    rankType: 'SALES',
  }) satisfies SupplyDashboardRankingItem
const source = () =>
  ({
    from: '2026-09-01T00:00:00Z',
    to: '2026-09-12T23:59:59Z',
    generatedAt: '2026-09-12T12:00:00Z',
    metrics: [],
    citySalesRanking: [],
    salesRanking: [],
  }) as unknown as SupplyDashboardOverview
const analysis = (): SupplyDashboardOperatingAnalysis => ({
  from: '2026-09-01T00:00:00Z',
  to: '2026-09-12T23:59:59Z',
  generatedAt: '2026-09-12T12:00:00Z',
  previousFrom: '2026-08-20T00:00:00Z',
  previousTo: '2026-08-31T23:59:59Z',
  previousSalesRanking: [],
  cityProducts: [],
  cityCustomers: [],
  salesReceipts: [],
})

describe('经营分析与筛选口径', () => {
  it('人员范围的销售不与整个城市成本相减', () => {
    const result = buildCockpit(source(), 'overview', {
      ...options,
      ownerStaffCode: 'S1',
      costScopeLimited: true,
    })
    expect(result.kpis.find((row) => row.label === '经营结余')?.value).toBe('—')
    expect(result.figures.find((row) => row.id === 'cost-bridge')).toMatchObject({
      rows: [],
      compact: true,
      sample: false,
      emptyAction: 'cost',
    })
  })
  it('订单级专题不暴露不会生效的分类条件', () => {
    expect(supportsCategoryFilter('sales')).toBe(false)
    expect(supportsCategoryFilter('overview')).toBe(false)
    expect(supportsCategoryFilter('product-sales')).toBe(true)
    expect(concreteDimension('MULTI')).toBeUndefined()
    expect(concreteDimension(' unknown ')).toBeUndefined()
  })
  it('跨城市销售下钻不传聚合城市编码，未归属销售不能扩大到全部', () => {
    expect(drillScope({ kind: 'sales', code: 'S1', regionCode: 'MULTI' }, {})).toEqual({
      ownerStaffCode: 'S1',
      regionCode: undefined,
    })
    expect(
      drillScope({ kind: 'sales', code: 'S1', regionCode: 'MULTI' }, { regionCode: 'BJ' }),
    ).toEqual({ ownerStaffCode: 'S1', regionCode: 'BJ' })
    expect(drillScope({ kind: 'sales', code: 'UNKNOWN' }, {})).toBeNull()
  })
  it('全国业绩按金额排名，不按欠款排名，保留所有销售和并列名次', () => {
    const data = source()
    data.salesRanking = [
      seller('A', 100, 100),
      seller('C', 100, 0),
      seller('B', 50, 0),
      seller('UNKNOWN', 999, 0),
    ]
    const result = buildCockpit(data, 'sales', options)
    const ranking = result.figures.find((row) => row.performance)!
    expect(ranking.performance?.map((row) => [row.key, row.rank])).toEqual([
      ['A', 1],
      ['C', 1],
      ['B', 3],
    ])
    expect(ranking.note).toContain('未归属销售不参与排名')
    expect(result.figures.find((row) => row.comparison)?.comparison?.[0].key).toBe('UNKNOWN')
    const paidRank = buildCockpit(data, 'sales', {
      ...options,
      rankingMetric: 'paidAmount',
    }).figures.find((row) => row.performance)!
    expect(paidRank.performance?.map((row) => row.rank)).toEqual([1, 2, 2])
  })
  it('单城市首屏是本地趋势和回款，不再展示一根全国城市柱', () => {
    const result = buildCockpit(source(), 'city-operating', {
      ...options,
      regionCode: 'BJ',
      regionName: '北京',
    })
    expect(result.figures.slice(0, 2).map((row) => row.id)).toEqual([
      'city-trend',
      'city-collection-progress',
    ])
    expect(result.figures.some((row) => row.id === 'cost-bridge')).toBe(true)
    expect(result.figures.some((row) => row.id === 'cities')).toBe(false)
    expect(result.figures.find((row) => row.id === 'targets')?.compact).toBe(true)
  })
  it('分类销售不显示未按分类筛选的订单和客户总数', () => {
    expect(
      buildCockpit(source(), 'product-sales', options).kpis.map((row) => row.label),
    ).not.toContain('订单数')
  })
  it('城市品类图为人民币金额，单元格下钻同时保留城市和分类', () => {
    const data = analysis()
    data.cityProducts = [
      {
        regionCode: 'BJ',
        regionName: '北京',
        categoryCode: '7',
        categoryName: '方便面',
        salesAmount: 123.45,
        orderCount: 2,
        customerCount: 1,
      },
    ]
    const figure = operatingAnalysisFigures(data, 'overview')[0]
    const option = figure.option as {
      visualMap: { max: number }[]
      series: { data: { rowKey: string }[] }[]
    }
    expect(option.visualMap[0].max).toBe(123.45)
    expect(option.series[0].data[0].rowKey).toBe(figure.rows[0].key)
    expect(figure.rows[0]).toMatchObject({ regionCode: 'BJ', code: '7', dimension: 'CATEGORY' })
    expect(figure.rows[0].cells.销售额).toBe('¥123.45')
  })
  it('未归类订单金额在前五品类外仍可见并能按城市核查订单', () => {
    const data = analysis()
    data.cityProducts = Array.from({ length: 6 }, (_, i) => ({
      regionCode: 'BJ',
      regionName: '北京',
      categoryCode: String(i + 1),
      categoryName: `分类${i + 1}`,
      salesAmount: 100 - i,
      orderCount: 2,
      customerCount: 1,
    }))
    data.cityProducts.push({
      regionCode: 'BJ',
      regionName: '北京',
      categoryCode: 'UNKNOWN',
      categoryName: '分类关联待核对',
      salesAmount: 10.01,
      orderCount: 1,
      customerCount: 1,
    })
    const figure = operatingAnalysisFigures(data, 'product-sales')[0]
    const unlinked = figure.rows.find((row) => row.code === 'UNKNOWN')!
    const option = figure.option as { series: { data: { rowKey: string }[] }[] }
    expect(figure.rows).toHaveLength(7)
    expect(unlinked).toMatchObject({
      kind: 'product',
      regionCode: 'BJ',
      dimension: 'CATEGORY',
      cells: { 销售额: '¥10.01' },
    })
    expect(option.series[0].data.some((cell) => cell.rowKey === unlinked.key)).toBe(true)
    expect(figure.note).toContain('分类关联待核对另行保留')
  })
  it('期间复购用下单客户作分母，不能平均或相加跨城市客户', () => {
    const data = analysis()
    data.cityCustomers = [
      { regionCode: 'BJ', regionName: '北京', orderingCustomerCount: 10, repeatCustomerCount: 2 },
    ]
    const figure = operatingAnalysisFigures(data, 'customer')[0]
    expect(figure.rows[0].cells.期间复购率).toBe('20.0%')
    expect(figure.note).toContain('跨城市客户不合计')
  })
  it('实际回款排行只用发生时间口径，前期排名不伪装同比', () => {
    const data = source()
    data.salesRanking = [seller('A', 100, 90)]
    const extra = analysis()
    extra.previousSalesRanking = [seller('B', 200, 20), seller('A', 100, 10)]
    extra.salesReceipts = [
      {
        ownerStaffCode: 'A',
        ownerStaffName: '甲',
        paidAmount: 12.34,
        paymentCount: 1,
        customerCount: 1,
      },
    ]
    const figure = operatingAnalysisFigures(extra, 'sales-collection')[0]
    expect(figure.performance?.[0].value).toBe(12.34)
    const ranking = buildCockpit(data, 'sales', { ...options, analysis: extra }).figures.find(
      (row) => row.performance,
    )!
    expect(ranking.performance?.[0].previousRank).toBe(2)
    expect(ranking.note).toContain('等长窗口')
  })
})
