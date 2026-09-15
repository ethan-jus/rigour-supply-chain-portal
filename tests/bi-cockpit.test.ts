import { beforeEach, describe, expect, it } from 'vitest'
import { seedBusinessDictionaryForTest } from '@/utils/business-dictionary'

beforeEach(() =>
  seedBusinessDictionaryForTest('COMMON', 'PRODUCT_UNIT', [
    { code: 'BOX', name: '箱' },
    { code: 'BOTTLE', name: '瓶' },
  ]),
)
import type {
  SupplyDashboardOverview,
  SupplyDashboardRankingItem,
  SupplyDashboardOperatingAnalysis,
} from '@/api/core/bi'
import {
  buildCockpit,
  cockpitSections,
  operatingCosts,
  sampleCostLines,
  targetPlot,
  aggregatePeriods,
  type CockpitOptions,
} from '@/views/supply-chain/bi/cockpit-model'
import {
  amount,
  collectionColumns,
  collectionGauge,
  ratio,
  waterfall,
} from '@/views/supply-chain/bi/cockpit-charts'

const options: CockpitOptions = {
  productDimension: 'PRODUCT',
  period: 'month',
  inventoryUnit: 'BOX',
  costGroup: '全部',
}
function data(): SupplyDashboardOverview {
  return {
    from: '2026-01-01T00:00:00Z',
    to: '2026-09-11T23:59:59Z',
    generatedAt: '2026-09-11T08:00:00Z',
    metrics: [
      ['sales_amount', 10000],
      ['paid_amount', 2500],
      ['unpaid_amount', 7500],
    ].map(([metricCode, value]) => ({
      metricCode: String(metricCode),
      metricName: String(metricCode),
      value: Number(value),
      unit: 'CNY',
      previousValue: null,
      changeRate: null,
      description: null,
    })),
    salesTrend: [],
    collectionTrend: [],
    cityCostTrend: [],
    citySalesRanking: [],
    salesRanking: [],
    salesMonthlyPerformance: [],
    cityCollectionRateRanking: [],
    sourceSystemBreakdown: [],
    productSalesRanking: [],
    skuSalesRanking: [],
    categorySalesRanking: [],
    brandSalesRanking: [],
    paymentRiskCityRanking: [],
    paymentRiskSalesRanking: [],
    paymentAgingBuckets: [],
    cityTargetCompletions: [],
    salesTargetCompletions: [],
    customerSegments: [],
    customerActivityRanking: [],
    customerChurnRiskRanking: [],
    inventoryItemSummary: [],
    inventoryReplenishment: [],
    cityCostRanking: [],
    risks: [],
    freshness: [],
    rolePerspectives: [],
    definitions: [],
  }
}
const city = (code: string, salesAmount: number): SupplyDashboardRankingItem => ({
  rankType: 'CITY',
  dimensionCode: code,
  dimensionName: code,
  regionCode: code,
  regionName: code,
  salesAmount,
  paidAmount: salesAmount / 2,
  unpaidAmount: salesAmount / 2,
  orderCount: 1,
  customerCount: 1,
  rate: 50,
})

describe('BI驾驶舱数据口径', () => {
  it('商品关联待核对保留金额但不计为一个真实商品', () => {
    const source = data()
    source.productSalesRanking = ['1', 'UNKNOWN'].map((dimensionCode) => ({
      rankType: 'PRODUCT',
      dimensionCode,
      dimensionName: dimensionCode === '1' ? '方便面' : '商品关联待核对',
      categoryCode: '',
      categoryName: '',
      salesQuantity: 1,
      salesAmount: 100,
      discountAmount: 0,
      refundAmount: 0,
      salesNetAmount: 100,
      estimatedCostAmount: 0,
      estimatedGrossProfit: 0,
      estimatedGrossProfitRate: 0,
      costCoverageRate: 0,
      orderCount: 1,
      customerCount: 1,
    }))
    const figure = buildCockpit(source, 'product-sales', options).figures.find(
      (item) => item.id === 'products',
    )!
    expect(figure.note).toContain('已关联1个商品')
    expect(figure.rows).toHaveLength(2)
    expect(figure.rows.find((row) => row.code === 'UNKNOWN')).toMatchObject({
      name: '商品关联待核对',
      cells: { 销售额: '¥100.00' },
    })
  })
  it('采购参考价未覆盖时不把未知成本显示成零成本', () => {
    const source = data()
    source.metrics.push(
      { metricCode: 'cost_coverage_rate', value: 0 } as SupplyDashboardOverview['metrics'][number],
      {
        metricCode: 'estimated_cost_amount',
        value: 0,
      } as SupplyDashboardOverview['metrics'][number],
    )
    for (const section of ['product-sales', 'gross-profit'] as const) {
      expect(
        buildCockpit(source, section, options).kpis.find((kpi) => kpi.label === '参考价估算成本')
          ?.value,
      ).toBe('—')
    }
    source.metrics.find((row) => row.metricCode === 'cost_coverage_rate')!.value = 50
    expect(
      buildCockpit(source, 'product-sales', options).kpis.find(
        (kpi) => kpi.label === '已覆盖参考价成本',
      )?.value,
    ).toBe('¥0.00')
  })
  it('单月全国销售不画单点趋势，有前期时直接展示两期变化', () => {
    const source = data()
    source.salesRanking = [{ ...city('S1', 10000), rankType: 'SALES' }]
    source.salesMonthlyPerformance = [
      { period: '2026-08', ownerStaffCode: 'S1', salesAmount: 10000 },
    ] as SupplyDashboardOverview['salesMonthlyPerformance']
    expect(
      buildCockpit(source, 'sales', options).figures.some(
        (figure) => figure.id === 'monthly-sales',
      ),
    ).toBe(false)
    const analysis = {
      previousFrom: '2026-07-01',
      previousTo: '2026-07-31',
      previousSalesRanking: [{ ...source.salesRanking[0], salesAmount: 8000 }],
    } as SupplyDashboardOperatingAnalysis
    const result = buildCockpit(source, 'sales', { ...options, analysis })
    expect(result.figures.find((figure) => figure.id === 'monthly-sales')?.title).toBe(
      '销售额变化 · 销售人员',
    )
  })
  it('目标筛选口径冲突不误提示未配置，分类与品牌图不重复', () => {
    const result = buildCockpit(data(), 'sales', { ...options, targetScopeLimited: true })
    expect(result.figures.find((figure) => figure.id === 'targets')).toMatchObject({
      empty: '当前细分范围与目标范围不同，暂不比较达成率',
      emptyAction: 'reset',
    })
    expect(
      buildCockpit(data(), 'product-sales', {
        ...options,
        productDimension: 'CATEGORY',
      }).figures.some((figure) => figure.id === 'categories'),
    ).toBe(false)
    expect(
      buildCockpit(data(), 'product-sales', { ...options, productDimension: 'BRAND' }).figures.some(
        (figure) => figure.id === 'brands',
      ),
    ).toBe(false)
  })
  it('月度人员小图不把缺失月补零，Top6之外的原始行仍完整可查', () => {
    const source = data()
    source.salesRanking = Array.from({ length: 7 }, (_, i) => ({
      ...city(`S${i}`, 1000 - i),
      rankType: 'SALES',
    }))
    source.salesMonthlyPerformance = [
      ...source.salesRanking.map((row) => ({
        period: '2026-06',
        ownerStaffCode: row.dimensionCode,
        ownerStaffName: row.dimensionName,
        regionCode: 'SH',
        regionName: '上海',
        salesAmount: row.salesAmount,
        paidAmount: 12.34,
        unpaidAmount: row.salesAmount - 12.34,
        rate: (12.34 / row.salesAmount) * 100,
        customerCount: 1,
        orderCount: 1,
      })),
    ]
    source.salesMonthlyPerformance.push(
      {
        ...source.salesMonthlyPerformance[0],
        regionCode: 'BJ',
        regionName: '北京',
        salesAmount: 25.5,
      },
      { ...source.salesMonthlyPerformance[0], period: '2026-08', salesAmount: 0 },
      { ...source.salesMonthlyPerformance[1], period: '2026-08', salesAmount: -12.34 },
    )
    const before = structuredClone(source)
    const figure = buildCockpit(source, 'sales', options).figures.find(
      (row) => row.id === 'monthly-sales',
    )!
    expect(figure.smallMultiples?.series).toHaveLength(6)
    expect(figure.smallMultiples?.rows).toMatchObject([
      { key: '2026-06', values: [1025.5, 999, 998, 997, 996, 995] },
      { key: '2026-07', values: [null, null, null, null, null, null] },
      { key: '2026-08', values: [0, -12.34, null, null, null, null] },
    ])
    expect(figure.rows).toHaveLength(source.salesMonthlyPerformance.length)
    expect(figure.rows.filter((row) => row.groupKey === '2026-06:S0')).toHaveLength(2)
    expect(figure.rows.find((row) => row.ownerStaffCode === 'S6')).toBeDefined()
    expect(figure.rows.find((row) => row.groupKey === '2026-08:S1')?.cells.销售额).toBe('¥-12.34')
    expect(source).toEqual(before)
  })
  it('商品页分类和品牌用有限构成图，商品SKU保留排序贡献且空数据不产生样例', () => {
    const source = data()
    const products = Array.from({ length: 9 }, (_, i) => ({
      rankType: 'PRODUCT',
      dimensionCode: `P${i}`,
      dimensionName: `商品${i}`,
      categoryCode: '',
      categoryName: '',
      salesQuantity: 1,
      salesAmount: i + 0.25,
      discountAmount: 0,
      refundAmount: 0,
      salesNetAmount: i + 0.25,
      estimatedCostAmount: 0,
      estimatedGrossProfit: 0,
      estimatedGrossProfitRate: 0,
      costCoverageRate: 0,
      orderCount: 1,
      customerCount: 1,
    }))
    source.productSalesRanking =
      source.skuSalesRanking =
      source.categorySalesRanking =
      source.brandSalesRanking =
        products
    const before = structuredClone(source)
    const figures = buildCockpit(source, 'product-sales', options).figures
    for (const id of ['categories', 'brands']) {
      const figure = figures.find((row) => row.id === id)!
      expect(figure.rows).toHaveLength(9)
      const series = figure.option.series as {
        type: string
        data: { rowKey: string; value: number }[]
      }[]
      expect(series[0].type).toBe('pie')
      expect(series[0].data).toHaveLength(6)
      const grouped = figure.rows.filter((row) => row.groupKey === series[0].data[5].rowKey)
      expect(grouped).toHaveLength(4)
      expect(grouped.map((row) => row.code)).toEqual(['P3', 'P2', 'P1', 'P0'])
    }
    for (const productDimension of ['PRODUCT', 'SKU'] as const) {
      const figure = buildCockpit(source, 'product-sales', {
        ...options,
        productDimension,
      }).figures.find((row) => row.id === 'products')!
      expect(figure.option.series).toMatchObject([{ type: 'bar' }, { type: 'line' }])
      expect(figure.rows.map((row) => row.key)).toEqual(
        [...products].reverse().map((row) => row.dimensionCode),
      )
    }
    const empty = buildCockpit(data(), 'product-sales', options).figures.filter((row) =>
      ['products', 'categories', 'brands'].includes(row.id),
    )
    expect(empty).toHaveLength(3)
    expect(empty.every((row) => !row.rows.length && !row.sample)).toBe(true)
    expect(source).toEqual(before)
  })
  it('单人销售页直接看趋势和回款，不把筛选后的唯一销售误标为全国第一', () => {
    const source = data()
    source.salesRanking = [{ ...city('S1', 10000), rankType: 'SALES', dimensionName: '销售甲' }]
    const result = buildCockpit(source, 'sales', { ...options, ownerStaffCode: 'S1' })
    expect(result.figures.map((row) => row.id)).toEqual([
      'monthly-sales',
      'collection-progress',
      'targets',
    ])
    expect(result.figures[0].title).toBe('个人销售与回款趋势')
    expect(result.figures[0].option.series).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'line' })]),
    )
    expect(result.figures[1].collection).toMatchObject({ rate: 25 })
  })
  it('全部专题均提供可视化，只有明细使用行记录', () => {
    for (const section of Object.keys(cockpitSections) as (keyof typeof cockpitSections)[]) {
      const result = buildCockpit(data(), section, options)
      expect(result.figures.length, section).toBeGreaterThanOrEqual(3)
      expect(
        result.figures.every((figure) => Array.isArray(figure.option.series)),
        section,
      ).toBe(true)
    }
  })
  it('已有交易指标保持真实值，成本及派生结余独立标样例', () => {
    const result = buildCockpit(data(), 'overview', options)
    expect(result.kpis.slice(0, 4).map((row) => row.value)).toEqual([
      '¥1.00万',
      '¥2,500.00',
      '¥7,500.00',
      '25.0%',
    ])
    expect(result.kpis.slice(0, 4).every((row) => !row.sample)).toBe(true)
    expect(result.kpis.slice(4).every((row) => row.sample)).toBe(true)
    expect(result.figures.find((row) => row.id === 'cost-bridge')?.rows[0].sample).toBe(false)
  })
  it('零成本事实不能被样例覆盖，缺失城市成本单独补样例', () => {
    const source = data()
    source.citySalesRanking = [city('上海', 6000), city('武汉', 4000)]
    source.cityCostRanking = [
      {
        regionCode: '上海',
        regionName: '上海',
        costAmount: 0,
        budgetAmount: 1000,
        varianceAmount: -1000,
        salesAmount: 6000,
        costRate: 0,
        recordCount: 1,
        latestCostTime: null,
      },
    ]
    const result = operatingCosts(source)
    expect(result.rows[0]).toMatchObject({ cost: 0, sample: false })
    const sampleCost = result.rows[1].lines.reduce((sum, row) => sum + row.amount, 0)
    expect(result.rows[1]).toMatchObject({ cost: sampleCost, sample: true })
    expect(sampleCost).not.toBe(4000 * 0.57)
    expect(result.cost).toBe(sampleCost)
    expect(result.profit).toBe(10000 - sampleCost)
    expect(result.sample).toBe(true)
  })
  it('无销售不计算回款率；缺失指标不伪装成零', () => {
    expect(ratio(0, 0)).toBeNull()
    expect(amount(null)).toBe('—')
    const source = data()
    source.metrics = []
    expect(buildCockpit(source, 'overview', options).kpis[0].value).toBe('—')
  })
  it('权限隐藏的成本不能用样例补成经营结论，库存隐藏不显示零库存', () => {
    const source = data()
    const scoped = { ...options, unavailableSubjects: ['CITY_COST', 'INVENTORY'] }
    const cost = buildCockpit(source, 'city-cost', scoped)
    expect(cost.figures).toHaveLength(1)
    expect(cost.figures[0]).toMatchObject({
      sample: false,
      rows: [],
      empty: '当前数据范围暂不支持城市成本汇总',
    })
    expect(
      cost.kpis
        .filter((row) => ['经营成本', '经营结余', '成本率'].includes(row.label))
        .every((row) => row.value === '—' && !row.sample),
    ).toBe(true)
    const stock = buildCockpit(source, 'product-inventory', scoped)
    expect(stock.figures).toHaveLength(1)
    expect(stock.figures[0].empty).toBe('当前账号尚无可用的仓库数据范围')
    expect(stock.kpis.every((row) => row.value === '—')).toBe(true)
  })
  it('总览回款仪表沿用汇总订单口径，不平均人员回款率', () => {
    const source = data()
    source.salesRanking = [
      { ...city('A', 1000), paidAmount: 1000, unpaidAmount: 0 },
      { ...city('B', 9000), paidAmount: 1500, unpaidAmount: 7500 },
    ]
    const result = buildCockpit(source, 'overview', options)
    const figure = result.figures.find((row) => row.id === 'collection-progress')!
    expect(figure.collection).toEqual({
      rate: 25,
      salesAmount: 10000,
      paidAmount: 2500,
      unpaidAmount: 7500,
    })
    expect(figure.rows.map((row) => row.cells.金额)).toEqual([
      '¥10,000.00',
      '¥2,500.00',
      '¥7,500.00',
    ])
    expect(result.figures.some((row) => row.id === 'cost-bridge')).toBe(true)
  })
  it('仪表保留超过100%的真实回款率，零应收和缺失回款不画假进度', () => {
    const option = collectionGauge({
      rate: 125,
      salesAmount: 100,
      paidAmount: 125,
      unpaidAmount: 0,
    })
    const series = (
      option.series as { data: { actualRate: number }[]; detail: { formatter: () => string } }[]
    )[0]
    expect(series.detail.formatter()).toBe('125.0%')
    expect(series.data[0].actualRate).toBe(125)
    for (const code of ['sales_amount', 'paid_amount']) {
      const source = data()
      source.metrics = source.metrics.filter((row) => row.metricCode !== code)
      const result = buildCockpit(source, 'overview', options)
      expect(result.kpis[3].value).toBe('—')
      expect(
        result.figures.find((row) => row.id === 'collection-progress')?.collection?.rate,
      ).toBeNull()
    }
    const source = data()
    source.metrics[0].value = 0
    expect(
      buildCockpit(source, 'overview', options).figures.find((row) => row.collection)?.collection
        ?.rate,
    ).toBeNull()
  })
  it('销售仅保留一个整体仪表，对象比较不重复堆仪表或横向回款率排行', () => {
    const source = data()
    source.salesRanking = source.citySalesRanking = [
      { ...city('A', 12000), paidAmount: 11000, unpaidAmount: 1000 },
      { ...city('B', 6000), paidAmount: 0, unpaidAmount: 6000 },
    ]
    for (const section of ['sales', 'city-operating', 'payment-risk'] as const) {
      const result = buildCockpit(source, section, options)
      expect(result.figures.filter((row) => row.collection)).toHaveLength(
        section === 'sales' ? 1 : 0,
      )
      if (section === 'city-operating') {
        const matrix = result.figures.find((row) => row.id === 'cities')!
        expect(matrix.comparison).toBeUndefined()
        expect(matrix.option.series).toMatchObject([
          { type: 'heatmap' },
          { type: 'heatmap' },
          { type: 'heatmap' },
        ])
        expect(matrix.rows.map((row) => row.code)).toEqual(['A', 'B'])
        expect(matrix.rows[1]).toMatchObject({
          kind: 'city',
          regionCode: 'B',
          cells: { 回款率: '0.0%', 待回款: '¥6,000.00' },
        })
      }
      const figure = result.figures.find((row) => row.comparison)!
      expect(figure.comparison?.map((row) => row.key)).toEqual(['B', 'A'])
      expect(figure.option.xAxis).toMatchObject({ type: 'category' })
      expect(figure.option.yAxis).toMatchObject({ type: 'value', name: '元' })
      expect(figure.option.series).toMatchObject([
        { type: 'bar', stack: 'collection' },
        { type: 'bar', stack: 'collection' },
      ])
      expect(figure.rows[0]).toMatchObject({
        regionCode: 'B',
        cells: { 回款率: '0.0%', 待回款: '¥6,000.00' },
      })
    }
    expect(source.citySalesRanking[0].dimensionCode).toBe('A')
  })
  it('回款对比保留所有对象、零值、负值及用于下钻的维度键', () => {
    const source = data()
    source.salesRanking = Array.from({ length: 108 }, (_, i) => city(String(i), 100 + i))
    expect(
      buildCockpit(source, 'sales', options).figures.find((row) => row.comparison)?.comparison,
    ).toHaveLength(108)
    const option = collectionColumns([
      { key: 'over', name: '超收', salesAmount: 100, paidAmount: 125, unpaidAmount: 0 },
      { key: 'negative', name: '负额', salesAmount: 100, paidAmount: -5, unpaidAmount: 105 },
      { key: 'zero', name: '无应收', salesAmount: 0, paidAmount: 0, unpaidAmount: 0 },
    ])
    const series = option.series as {
      data: {
        value: number
        rowKey: string
        collectionPart: string
        label: { show: boolean; formatter: string }
      }[]
    }[]
    expect(series[0].data[0].label).toMatchObject({ show: true, formatter: '回款 125.0%' })
    expect(series[0].data[1].value).toBe(-5)
    expect(series[1].data[1]).toMatchObject({
      value: 105,
      rowKey: 'negative',
      collectionPart: 'unpaid',
      label: { formatter: '回款 -5.0%' },
    })
    expect(series[0].data[2].label.formatter).toBe('回款 —')
    expect((option.yAxis as { min: number }).min).toBe(-6)
  })
  it('货人场分项不重复计入损耗，金额守恒', () => {
    const costs = operatingCosts(data())
    expect(costs.lines.reduce((sum, row) => sum + row.amount, 0)).toBeCloseTo(costs.cost, 2)
    expect(sampleCostLines.filter((row) => row.name === '损耗').map((row) => row.group)).toEqual([
      '货',
    ])
    expect(sampleCostLines.filter((row) => row.group === '人').map((row) => row.name)).toEqual([
      '底薪绩效',
      '提成',
      '激励',
      '兼职',
    ])
  })
  it('成本图使用同一分项金额并保留混合来源，独立SKU不并入城市总额', () => {
    const source = data()
    source.citySalesRanking = [city('上海', 6000.01), city('武汉', 3999.99)]
    source.cityCostRanking = [
      {
        regionCode: '上海',
        regionName: '上海',
        costAmount: 123.45,
        budgetAmount: 0,
        varianceAmount: 123.45,
        salesAmount: 6000.01,
        costRate: 0,
        recordCount: 1,
        latestCostTime: null,
      },
    ]
    const costs = operatingCosts(source)
    const result = buildCockpit(source, 'city-cost', options)
    const figure = (id: string) => result.figures.find((row) => row.id === id)!
    const series = (id: string) => figure(id).option.series as { data: { value: number }[] }[]
    const chartCents = (id: string) =>
      series(id)
        .flatMap((row) => row.data)
        .reduce((sum, row) => sum + Math.round(row.value * 100), 0)
    expect(chartCents('cost-structure')).toBe(Math.round(costs.cost * 100))
    expect(
      series('city-costs')[1].data.reduce((sum, row) => sum + Math.round(row.value * 100), 0),
    ).toBe(Math.round(costs.cost * 100))
    for (const id of ['cost-structure']) {
      expect(figure(id).sample).toBe(true)
      expect(figure(id).rows.find((row) => row.groupKey === '未分项')).toMatchObject({
        sample: false,
        cells: { 金额: '¥123.45' },
      })
      expect(
        figure(id)
          .rows.filter((row) => row.groupKey !== '未分项')
          .every((row) => row.sample),
      ).toBe(true)
    }
    const humanCents = costs.lines
      .filter((row) => row.group === '人')
      .reduce((sum, row) => sum + Math.round(row.amount * 100), 0)
    expect(chartCents('human-cost')).toBe(humanCents)
    const humanItems = buildCockpit(source, 'city-cost', {
      ...options,
      costGroup: '人',
    }).figures.find((row) => row.id === 'cost-structure')!
    expect(humanItems.rows.every((row) => row.groupKey === '人' && row.sample)).toBe(true)
    expect(humanItems.rows.map((row) => row.cells.金额)).toEqual(
      figure('human-cost').rows.map((row) => row.cells.金额),
    )
    expect(figure('city-costs').rows[0]).toMatchObject({
      sample: false,
      cells: { '已入账成本（未提供分项）': '¥123.45' },
    })
    expect(figure('city-costs').rows[1].cells.成本来源).toContain('样例')
    expect(figure('sku-costs').sample).toBe(true)
    expect(figure('sku-costs').note).toContain('不计入城市总额')
  })
  it.each([0, 123.45, -123.45])('真实总额 %s 不被拆成人力或其他真实分项', (costAmount) => {
    const source = data()
    source.citySalesRanking = [city('上海', 10000)]
    source.cityCostRanking = [
      {
        regionCode: '上海',
        regionName: '上海',
        costAmount,
        budgetAmount: 0,
        varianceAmount: costAmount,
        salesAmount: 10000,
        costRate: 0,
        recordCount: 1,
        latestCostTime: null,
      },
    ]
    const result = buildCockpit(source, 'city-cost', options)
    for (const id of ['cost-structure']) {
      const figure = result.figures.find((row) => row.id === id)!
      expect(figure.sample).toBe(false)
      expect(figure.rows).toHaveLength(1)
      expect(figure.rows[0]).toMatchObject({ groupKey: '未分项', sample: false })
      expect((figure.option.series as { data: { value: number }[] }[])[0].data[0].value).toBe(
        costAmount,
      )
    }
    const human = result.figures.find((row) => row.id === 'human-cost')!
    expect(human.rows).toEqual([])
    expect(human.sample).toBe(false)
    expect(human.empty).toContain('未提供人力成本分项')
    expect(result.figures.find((row) => row.id === 'sku-costs')?.sample).toBe(true)
  })
  it('目标按分子分母汇总，未配置目标保留空值', () => {
    const target = {
      dimensionType: 'CITY',
      dimensionCode: 'SH',
      dimensionName: '上海',
      metricCode: 'SALES_AMOUNT',
      metricName: '销售额',
      actualValue: 20,
      targetValue: 100,
      achievementRate: 20,
    }
    const result = targetPlot([
      target,
      { ...target, actualValue: 180, targetValue: 300, achievementRate: 60 },
    ])
    expect(result[0].values).toEqual([null, null, 50, null])
  })
  it('ERP采购价未完全覆盖时不把缺成本当高毛利', () => {
    const source = data()
    source.metrics.push({
      metricCode: 'cost_coverage_rate',
      metricName: '',
      value: 50,
      unit: 'PERCENT',
      previousValue: null,
      changeRate: null,
      description: null,
    })
    expect(
      buildCockpit(source, 'gross-profit', options).kpis.find((row) => row.label === '估算毛利')
        ?.value,
    ).toBe('—')
  })
  it('采购数量按单位分别计算，不合计箱和瓶', () => {
    const source = data()
    source.inventoryItemSummary = ['BOX', 'BOTTLE'].map((unitCode, index) => ({
      categoryCode: String(index),
      categoryName: '水',
      unitCode,
      procurementQuantity: index ? 100 : 10,
      shippedQuantity: 0,
      remainingQuantity: 0,
      inactiveRemainingQuantity: 0,
    }))
    expect(buildCockpit(source, 'product-inventory', options).kpis[0].value).toBe('10箱')
    expect(
      buildCockpit(source, 'product-inventory', { ...options, inventoryUnit: 'BOTTLE' }).kpis[0]
        .value,
    ).toBe('100瓶')
    const flow = buildCockpit(source, 'product-inventory', options).figures.find(
      (row) => row.id === 'inventory-flow',
    )!
    expect(flow.option.yAxis).toMatchObject({ name: '箱' })
    expect(flow.option.series).toMatchObject([
      { type: 'bar', stack: undefined, data: [{ value: 10 }] },
      { type: 'bar', stack: undefined, data: [{ value: 0 }] },
      { type: 'bar', stack: undefined, data: [{ value: 0 }] },
    ])
    expect(flow.rows).toHaveLength(1)
    expect(
      buildCockpit(source, 'product-inventory', { ...options, inventoryUnit: '' }).figures.find(
        (row) => row.id === 'inventory-flow',
      ),
    ).toMatchObject({ rows: [], empty: '请选择同一计量单位后比较' })
  })
  it('月度趋势汇总金额，不补造缺失月份', () => {
    expect(
      aggregatePeriods(
        [
          { metricCode: 'sales', period: '2026-01-02', value: 10, secondaryValue: 2 },
          { metricCode: 'sales', period: '2026-01-20', value: 20, secondaryValue: 3 },
          { metricCode: 'sales', period: '2026-03-02', value: 5, secondaryValue: 1 },
        ],
        'month',
      ).map((row) => row.values),
    ).toEqual([
      [30, 5],
      [null, null],
      [5, 1],
    ])
  })
  it('亏损瀑布图保留负结余和可追踪的成本柱', () => {
    const option = waterfall([
      { key: 'sales', name: '销售', values: [100] },
      { key: 'cost', name: '成本', values: [-140] },
      { key: 'profit', name: '结余', values: [-40] },
    ])
    const series = option.series as { data: unknown[] }[]
    expect(series[0].data).toEqual([0, -40, -40])
    expect(series[1].data[1]).toMatchObject({ value: 140, rowKey: 'cost' })
  })
  it('图表明细保留金额小数，不使用万元缩写导出', () => {
    const source = data()
    source.citySalesRanking = [city('上海', 12345.67)]
    const figure = buildCockpit(source, 'overview', options).figures.find(
      (row) => row.id === 'cities',
    )
    const rows =
      figure?.rows ||
      buildCockpit(source, 'city-operating', options).figures.flatMap((row) => row.rows)
    expect(rows.some((row) => row.cells.销售额 === '¥12,345.67')).toBe(true)
  })
  it('库存快照缺失不能显示安全零风险或触发补货', () => {
    const source = data()
    source.freshness = [
      {
        sourceCode: 'ERP_STOCK_BALANCE',
        sourceName: '库存余额',
        latestUpdatedTime: null,
        status: 'EMPTY',
        description: '暂无数据',
      },
    ]
    expect(
      buildCockpit(source, 'inventory-risk', options).kpis.every((row) => row.value === '—'),
    ).toBe(true)
    expect(
      buildCockpit(source, 'product-inventory', options).kpis.every((row) => row.value === '—'),
    ).toBe(true)
    expect(
      buildCockpit(source, 'overview', options).actions.some(
        (row) => row.section === 'product-inventory',
      ),
    ).toBe(false)
  })
  it('账龄按未逾期到最长逾期排序', () => {
    const source = data()
    source.paymentAgingBuckets = ['DAYS_61_PLUS', 'CURRENT', 'DAYS_1_30', 'DAYS_31_60'].map(
      (bucketCode) => ({
        bucketCode,
        bucketName: bucketCode,
        orderCount: 1,
        customerCount: 1,
        unpaidAmount: 100,
      }),
    )
    const rows = buildCockpit(source, 'payment-risk', options).figures.find(
      (row) => row.id === 'aging',
    )?.rows
    expect(rows?.map((row) => row.key)).toEqual([
      'CURRENT',
      'DAYS_1_30',
      'DAYS_31_60',
      'DAYS_61_PLUS',
    ])
  })
  it('有待回款或指标缺失时，账龄空态不误报没有欠款', () => {
    const source = data()
    source.paymentAgingBuckets = []
    const empty = () =>
      buildCockpit(source, 'payment-risk', options).figures.find((row) => row.id === 'aging')?.empty
    expect(empty()).toBe('账龄明细暂不可用，请核对待回款订单')
    source.metrics = []
    expect(empty()).toBe('账龄明细暂不可用，请核对待回款订单')
    source.metrics = [
      { metricCode: 'unpaid_amount', value: 0 } as SupplyDashboardOverview['metrics'][number],
    ]
    expect(empty()).toBe('当前筛选无待回款订单')
  })
})
