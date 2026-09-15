import { describe, expect, it } from 'vitest'
import type {
  SupplyDashboardOverview,
  SupplyDashboardProductSalesItem,
  SupplyDashboardRankingItem,
} from '@/api/core/bi'
import { buildCockpit, type CockpitOptions } from '@/views/supply-chain/bi/cockpit-model'
import { cockpitLayout } from '@/views/supply-chain/bi/cockpit-layout'
import {
  heatmap,
  costComposition,
  categoryComposition,
  cityOperatingMatrix,
  smallMultipleLines,
  smallMultipleHeight,
  pareto,
  exactAmount,
} from '@/views/supply-chain/bi/cockpit-charts'
import {
  analysisSections,
  operatingAnalysisFigures,
} from '@/views/supply-chain/bi/cockpit-analysis'

const options: CockpitOptions = {
  productDimension: 'PRODUCT',
  period: 'month',
  inventoryUnit: 'BOX',
  costGroup: '全部',
}
const data = () =>
  ({
    from: '2026-09-01T00:00:00Z',
    to: '2026-09-12T23:59:59Z',
    metrics: [],
    citySalesRanking: [],
    salesRanking: [],
  }) as unknown as SupplyDashboardOverview
const seriesOf = (option: unknown) =>
  (option as { series: { type: string; data: Record<string, unknown>[] }[] }).series

describe('Business-specific BI visuals', () => {
  it('调动员工显示当前归属和历史订单城市，保留金额、名次和订单下钻范围', () => {
    const source = data()
    const transferred: SupplyDashboardRankingItem = {
      rankType: 'SALES_OWNER',
      dimensionCode: 'E1',
      dimensionName: '苗乐',
      regionCode: 'MULTI',
      regionName: '多城市',
      currentRegionName: '金华',
      orderRegionNames: ['杭州', '金华'],
      salesAmount: 35621.1,
      paidAmount: 32999.1,
      unpaidAmount: 2622,
      orderCount: 75,
      customerCount: 10,
      rate: 92.64,
    }
    source.salesRanking = [transferred]
    const figure = buildCockpit(source, 'sales', {
      ...options,
      rankingMetric: 'paidAmount',
    }).figures.find((row) => row.id === 'performance-ranking')!
    const axis = figure.option.xAxis as {
      axisLabel: { formatter: (key: string, i: number) => string }
    }
    expect(axis.axisLabel.formatter('E1', 0)).toBe('第1名\n苗乐\n当前归属：金华')
    const tooltip = figure.option.tooltip as { formatter: (raw: unknown) => string }
    expect(tooltip.formatter({ dataIndex: 0 })).toContain('历史订单涉及：杭州、金华（所选期间）')
    expect(seriesOf(figure.option)[0].data[0]).toMatchObject({ value: 32999.1, rowKey: 'E1' })
    expect(figure.rows[0]).toMatchObject({
      ownerStaffCode: 'E1',
      regionCode: 'MULTI',
      cells: { 当前归属: '金华', 历史订单涉及: '杭州、金华', 订单数: '75' },
    })
    expect(figure.rows[0].cells).not.toHaveProperty('城市')
    source.salesRanking = [
      {
        ...transferred,
        regionCode: 'HZ',
        regionName: '杭州',
        currentRegionName: null,
        orderRegionNames: ['杭州'],
      },
    ]
    const missing = buildCockpit(source, 'sales', options).figures.find(
      (row) => row.id === 'performance-ranking',
    )!
    expect(missing.rows[0].cells).toMatchObject({ 当前归属: '待完善', 历史订单涉及: '杭州' })
  })
  it('参考价覆盖缺失时不伪造100%未覆盖，已知零覆盖采用中性色', () => {
    const input = data()
    const missing = buildCockpit(input, 'gross-profit', options).figures.find(
      (row) => row.id === 'cost-coverage',
    )!
    expect(missing.compact).toBe(true)
    expect(seriesOf(missing.option)).toEqual([])
    input.metrics = [{ metricCode: 'cost_coverage_rate', value: 0 }] as never
    const zero = buildCockpit(input, 'gross-profit', options).figures.find(
      (row) => row.id === 'cost-coverage',
    )!
    expect(seriesOf(zero.option)[0].data[1]).toMatchObject({
      value: 100,
      itemStyle: { color: '#dce3ea' },
    })
  })
  it('全国和个人销售保留主列趋势或排名，侧栏显示真实回款仪表', () => {
    const source = data()
    source.metrics = [
      ['sales_amount', 10000],
      ['paid_amount', 3500],
      ['unpaid_amount', 6500],
    ].map(([metricCode, value]) => ({ metricCode, value })) as never
    const national = buildCockpit(source, 'sales', options)
    const layout = cockpitLayout('sales', national.figures)
    expect(layout.main.map((row) => row.id)).toContain('performance-ranking')
    expect(layout.aside.find((row) => row.id === 'collection-progress')?.collection).toMatchObject({
      paidAmount: 3500,
      unpaidAmount: 6500,
      rate: 35,
    })
    const personal = buildCockpit(source, 'sales', { ...options, ownerStaffCode: 'S1' })
    const personalLayout = cockpitLayout('sales', personal.figures)
    expect(personalLayout.main.map((row) => row.id)).toContain('monthly-sales')
    expect(personalLayout.aside.map((row) => row.id)).toContain('collection-progress')
  })
  it('uses compact two-decimal amounts in composition tooltips without rounding source values or detailed amounts', () => {
    const chart = costComposition(
      [{ key: 'goods', name: '货品', group: '货', values: [226320.94] }],
      '货',
    )
    const formatter = (chart.tooltip as { formatter: (raw: unknown) => string }).formatter
    expect(formatter({ data: { name: '货品', value: 226320.94 } })).toContain('成本 ¥22.63万')
    expect(formatter({ data: { name: '货品', value: 1200.5 } })).toContain('¥1,200.50')
    expect(formatter({ data: { name: '货品', value: 0 } })).toContain('¥0.00')
    expect(seriesOf(chart)[0].data[0].value).toBe(226320.94)
    expect(exactAmount(226320.94)).toBe('¥226,320.94')
  })
  it('shows item amounts and cumulative contribution without area blocks, fabricated zero percentages, or invalid negative shares', () => {
    const chart = pareto([
      { key: 'b', name: '商品乙', values: [30] },
      { key: 'a', name: '商品甲', values: [70] },
    ])
    expect(seriesOf(chart).map((series) => series.type)).toEqual(['bar', 'line'])
    expect(seriesOf(chart)[1].data).toEqual([
      { value: 70, rowKey: 'a' },
      { value: 100, rowKey: 'b' },
    ])
    expect(seriesOf(pareto([{ key: 'z', name: '零', values: [0] }]))[1].data[0].value).toBeNull()
    expect(seriesOf(pareto([{ key: 'n', name: '负调整', values: [-10] }]))[0].data[0].value).toBe(
      -10,
    )
  })
  it('shows existing ERP-backed SKU reference costs without replacing them with samples or adding them twice', () => {
    const input = data()
    const reference = (code: string, coverage: number): SupplyDashboardProductSalesItem => ({
      rankType: 'SKU',
      dimensionCode: code,
      dimensionName: `测试商品/${code}`,
      categoryCode: '1',
      categoryName: '方便面',
      salesQuantity: 10,
      salesAmount: 100,
      discountAmount: 0,
      refundAmount: 0,
      salesNetAmount: 100,
      estimatedCostAmount: coverage > 0 ? 30 : 0,
      estimatedGrossProfit: 0,
      estimatedGrossProfitRate: 0,
      costCoverageRate: coverage,
      orderCount: 2,
      customerCount: 1,
    })
    const before = buildCockpit(input, 'city-cost', options)
    input.skuSalesRanking = [reference('7', 50), reference('8', 0)]
    const after = buildCockpit(input, 'city-cost', options)
    const chart = after.figures.find((item) => item.id === 'sku-reference-cost')!
    expect(chart.sample).not.toBe(true)
    expect(chart.rows[0]).toMatchObject({ code: '7', dimension: 'SKU', sample: false })
    expect(chart.rows[0].cells.采购参考成本).toContain('30.00')
    expect(chart.rows[1].cells.采购参考成本).toBe('未取得参考价')
    expect(seriesOf(chart.option)[0].data[0].value).toBe(30)
    expect(after.kpis).toEqual(before.kpis)
    expect(after.figures.find((item) => item.id === 'sku-costs')?.sample).toBe(true)
  })
  it('人员各用独立折线小图，共享金额轴并保留空月和点击关联', () => {
    const chart = smallMultipleLines(
      [
        {
          key: '2026-08',
          name: '8月',
          values: [12, null],
          seriesKeys: ['2026-08:S1', '2026-08:S2'],
        },
      ],
      [{ name: '甲' }, { name: '乙' }],
    )
    expect(seriesOf(chart).map((series) => series.data[0])).toEqual([
      { value: 12, rowKey: '2026-08:S1' },
      { value: null, rowKey: '2026-08:S2' },
    ])
    expect(chart.grid).toHaveLength(2)
    expect(chart.yAxis).toMatchObject([
      { min: 0, max: expect.closeTo(13.2) },
      { min: 0, max: expect.closeTo(13.2) },
    ])
    expect(chart.series).toMatchObject([
      { type: 'line', xAxisIndex: 0, yAxisIndex: 0, connectNulls: false },
      { type: 'line', xAxisIndex: 1, yAxisIndex: 1, connectNulls: false },
    ])
    expect(smallMultipleHeight(6, 900)).toBe(320)
    expect(smallMultipleHeight(6, 760)).toBe(480)
    expect(smallMultipleHeight(6, 350)).toBe(960)
    expect(smallMultipleHeight(6, 850)).toBe(320)
    expect(smallMultipleHeight(6, 560)).toBe(480)
    const narrow = smallMultipleLines(
      [{ key: '2026-08', name: '8月', values: [-5, 226320.94] }],
      [{ name: '甲' }, { name: '乙' }],
      350,
    )
    expect(narrow.grid).toMatchObject([
      { left: 48, top: 34 },
      { left: 48, top: 194 },
    ])
    expect(narrow.yAxis).toMatchObject([{ min: -5.5 }, { min: -5.5 }])
    const formatter = (narrow.tooltip as { formatter: (raw: unknown) => string }).formatter
    expect(formatter({ seriesIndex: 1, dataIndex: 0 })).toBe('乙\n8月\n销售额 ¥226,320.94')
  })
  it('18个城市保留全部金额单元，回款率用独立中性列且tooltip精确到元', () => {
    const rows = Array.from({ length: 18 }, (_, i) => ({
      key: `city-${i}`,
      name: `城市${i}`,
      salesAmount: 226320.94 + i,
      paidAmount: 123456.78,
      unpaidAmount: 102864.16 + i,
    }))
    rows[1] = { ...rows[1], salesAmount: 100, paidAmount: 125, unpaidAmount: -25 }
    rows[2] = { ...rows[2], salesAmount: 100, paidAmount: -5, unpaidAmount: 105 }
    rows[3] = { ...rows[3], salesAmount: 0, paidAmount: 0, unpaidAmount: 0 }
    const chart = cityOperatingMatrix(rows)
    expect(chart.xAxis).toMatchObject({ data: ['销售额', '累计回款', '待回款金额', '回款率'] })
    expect(chart.yAxis).toMatchObject({ data: rows.map((row) => row.name) })
    expect(chart.dataZoom).toEqual([])
    expect(seriesOf(chart)[0].data).toHaveLength(54)
    expect(seriesOf(chart)[2].data).toHaveLength(18)
    expect(seriesOf(chart)[0].data[0]).toEqual({ value: [0, 0, 226320.94], rowKey: 'city-0' })
    expect(seriesOf(chart)[2].data.slice(1, 4)).toMatchObject([
      { value: [3, 1, 125], rawValue: 125, rowKey: 'city-1' },
      { value: [3, 2, -5], rawValue: -5, rowKey: 'city-2' },
      { rawValue: null, missing: true, rowKey: 'city-3' },
    ])
    expect(chart.visualMap).toMatchObject([
      { seriesIndex: 0, min: -25, max: rows[17].salesAmount },
      { seriesIndex: 1 },
      { seriesIndex: 2, show: false, inRange: { color: ['#f2f4f7', '#f2f4f7'] } },
    ])
    const tooltip = (chart.tooltip as { formatter: (raw: unknown) => string }).formatter
    expect(tooltip({ data: seriesOf(chart)[0].data[0] })).toContain('销售额 ¥226,320.94')
    expect(tooltip({ data: seriesOf(chart)[2].data[1] })).toContain('回款率 125.0%')
    expect(tooltip({ data: seriesOf(chart)[2].data[3] })).toContain('回款率 —')
  })
  it('分类构成限制为六个分区，其他保留关联、负数不转面积、零合计不伪造占比', () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({
      key: `category-${i}`,
      name: `分类${i}`,
      values: [100.25 - i],
    }))
    const before = structuredClone(rows)
    const composition = categoryComposition(rows)
    const slices = seriesOf(composition.option)[0].data
    expect(slices).toHaveLength(6)
    expect(slices.slice(0, 5).map((row) => row.value)).toEqual(
      rows.slice(0, 5).map((row) => row.values[0]),
    )
    expect(slices[5]).toMatchObject({ name: '其他（3项）', value: 282.75 })
    expect(
      rows.slice(5).every((row) => composition.groupKeys.get(row.key) === slices[5].rowKey),
    ).toBe(true)
    expect(rows).toEqual(before)
    expect(
      seriesOf(categoryComposition([{ key: 'n', name: '调整', values: [-12.34] }]).option)[0]
        .data[0].value,
    ).toBe(-12.34)
    const zero = categoryComposition([{ key: 'z', name: '零', values: [0] }]).option
    expect(zero.series).toMatchObject([{ stillShowZeroSum: false, data: [{ value: 0 }] }])
    const tooltip = (zero.tooltip as { formatter: (raw: unknown) => string }).formatter
    expect(tooltip({ data: { name: '零', value: 0 } })).toContain('占已返回销售额 —')
    const collision = categoryComposition(
      rows.map((row, i) => (i === 0 ? { ...row, key: 'composition:other' } : row)),
    )
    expect([...collision.groupKeys.values()]).not.toContain('composition:other')
  })
  it('renders inventory quantities and missing coverage without percentage conversion', () => {
    const matrix = heatmap(
      [{ key: 'p', name: '产品', values: [12.5, null, 0] }],
      ['可用', '在途', '补货'],
      { unit: '箱' },
    )
    expect(seriesOf(matrix)[0].type).toBe('heatmap')
    expect(seriesOf(matrix)[0].data.map((row) => row.value)).toEqual([
      [0, 0, 12.5],
      [2, 0, 0],
    ])
    expect(seriesOf(matrix)[1].data[0]).toMatchObject({ rawValue: null, missing: true })
    const formatter = (matrix.tooltip as { formatter: (raw: unknown) => string }).formatter
    expect(formatter({ data: { value: [0, 0, 12.5] } })).toContain('12.5箱')
    expect(formatter({ data: { value: [0, 0, 12.5] } })).not.toContain('%')
    expect(formatter({ data: { value: [1, 0, 0], missing: true } })).toContain('暂无数据')
  })
  it('uses no scatter for city and inventory, retains overview cost and a single collection gauge', () => {
    const overview = buildCockpit(data(), 'overview', options)
    expect(overview.figures.slice(0, 4).map((figure) => figure.id)).toEqual([
      'trend',
      'collection-progress',
      'cost-bridge',
      'cities',
    ])
    expect(overview.figures.filter((figure) => figure.collection)).toHaveLength(1)
    expect(
      seriesOf(overview.figures.find((figure) => figure.id === 'cost-structure')!.option)[0].type,
    ).toBe('pie')
    for (const section of ['city-operating', 'product-inventory', 'inventory-risk'] as const)
      expect(
        buildCockpit(data(), section, options)
          .figures.flatMap((figure) => seriesOf(figure.option))
          .some((series) => series.type === 'scatter'),
      ).toBe(false)
    const inventory = buildCockpit(data(), 'product-inventory', options)
    expect(
      seriesOf(inventory.figures.find((figure) => figure.id === 'coverage')!.option)[0].type,
    ).toBe('heatmap')
  })
  it('费用先按货人场聚合，切换后保留每项精度和真实负调整', () => {
    const rows = [
      { key: '采购', name: '采购', group: '货', values: [12345.67] },
      { key: '运费', name: '运费', group: '货', values: [100.01] },
      { key: '工资', name: '工资', group: '人', values: [8000] },
    ]
    expect(seriesOf(costComposition(rows))[0].data.map((row) => row.value)).toEqual([
      12445.68, 8000,
    ])
    expect(seriesOf(costComposition(rows, '货'))[0].data.map((row) => row.rowKey)).toEqual([
      '采购',
      '运费',
    ])
    expect(seriesOf(costComposition([{ ...rows[0], values: [-12.34] }]))[0].data[0].value).toBe(
      -12.34,
    )
  })
  it('客户完整汇总不受前80位名单影响，无历史订单保留为待首单而非无风险', () => {
    const source = data()
    source.metrics = [{ metricCode: 'customer_churn_risk_count', value: 1170 }] as never
    source.customerSegments = [
      {
        segmentCode: 'D',
        segmentName: 'D类',
        customerCount: 1300,
        churnRiskCustomerCount: 1170,
        salesAmount: 0,
        unpaidAmount: 0,
      },
    ] as never
    source.customerChurnRiskRanking = Array.from({ length: 80 }, (_, i) => ({
      customerCode: `C${i}`,
      customerName: `客户${i}`,
      regionCode: 'SH',
      regionName: '上海',
      ownerStaffCode: 'S1',
      ownerStaffName: '销售甲',
      salesAmount: 0,
      unpaidAmount: 0,
      activityScore: 0,
      inactiveDays: 9999,
      lastOrderTime: null,
    })) as never
    const result = buildCockpit(source, 'customer', options)
    const risk = result.figures.find((row) => row.id === 'customer-risk')!
    expect(seriesOf(risk.option).map((row) => row.data[0].value)).toEqual([130, 1170])
    const queue = result.figures.find((row) => row.id === 'churn')!
    expect(queue.rows).toHaveLength(80)
    expect(queue.rows.every((row) => row.groupKey === '待首单')).toBe(true)
    expect(queue.note).toContain('1,170')
    expect(queue.note).toContain('80')
    expect(queue.empty).not.toContain('无待跟进')
    expect(result.actions).toHaveLength(3)
    expect(result.actions[0]).toMatchObject({
      context: '上海 · 责任销售 销售甲',
      row: { ownerStaffCode: 'S1', code: 'C0' },
    })
    source.customerChurnRiskRanking = []
    expect(
      buildCockpit(source, 'customer', options).figures.find((row) => row.id === 'churn'),
    ).toMatchObject({ compact: true, empty: '待跟进名单暂未返回，请重试查询' })
    const restricted = buildCockpit(source, 'customer', {
      ...options,
      unavailableSubjects: ['LEGACY_CUSTOMER_ACTIVITY'],
    })
    expect(restricted.actions).toEqual([])
    expect(restricted.figures.every((row) => row.rows.length === 0)).toBe(true)
  })
  it('does not pretend a cross-category brand belongs to the MAX category in the aggregate', () => {
    const source = data()
    source.brandSalesRanking = [
      {
        dimensionCode: 'brand',
        dimensionName: '联名品牌',
        categoryCode: 'max',
        categoryName: '聚合中某一分类',
        salesAmount: 100,
        salesNetAmount: 100,
        orderCount: 1,
        customerCount: 1,
        costCoverageRate: 0,
      } as SupplyDashboardProductSalesItem,
    ]
    const figure = buildCockpit(source, 'product-sales', options).figures.find(
      (row) => row.id === 'brands',
    )!
    expect(figure.rows[0].cells).not.toHaveProperty('分类')
    expect(seriesOf(figure.option)[0].data[0]).not.toHaveProperty('children')
    expect(figure.rows[0].dimension).toBe('BRAND')
  })
  it('loads the real city/category matrix on the product page instead of only overview', () => {
    expect(analysisSections).toContain('product-sales')
    const figures = operatingAnalysisFigures(
      { cityProducts: [], cityCustomers: [] } as never,
      'product-sales',
    )
    expect(figures[0]).toMatchObject({ id: 'city-products', span: 12 })
    expect(seriesOf(figures[0].option)[0].type).toBe('heatmap')
  })
})
