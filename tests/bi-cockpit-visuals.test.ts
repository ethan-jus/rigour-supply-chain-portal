import { describe, expect, it } from 'vitest'
import type { SupplyDashboardOverview, SupplyDashboardProductSalesItem } from '@/api/core/bi'
import { buildCockpit, type CockpitOptions } from '@/views/supply-chain/bi/cockpit-model'
import { heatmap, lines, costSunburst, pareto, exactAmount } from '@/views/supply-chain/bi/cockpit-charts'
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
  it('uses compact two-decimal amounts in composition tooltips without rounding source values or detailed amounts', () => {
    const chart = costSunburst([{ key: 'goods', name: '货品', values: [226320.94] }], '成本')
    const formatter = (chart.tooltip as { formatter: (raw: unknown) => string }).formatter
    expect(formatter({ data: { name: '货品', value: 226320.94 } })).toContain('成本 ¥22.63万')
    expect(formatter({ data: { name: '货品', value: 1200.5 } })).toContain('¥1,200.50')
    expect(formatter({ data: { name: '货品', value: 0 } })).toContain('¥0.00')
    expect(seriesOf(chart)[0].data[0].value).toBe(226320.94)
    expect(exactAmount(226320.94)).toBe('¥226,320.94')
    const quantities = costSunburst([{ key: 'goods', name: '货品', values: [12] }], '库存', '箱')
    const quantityFormatter = (quantities.tooltip as { formatter: (raw: unknown) => string }).formatter
    expect(quantityFormatter({ data: { name: '货品', value: 12 } })).toContain('库存 12箱')
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
  it('keeps signed costs instead of turning adjustments into positive areas', () => {
    const chart = costSunburst([{ key: 'adjustment', name: '调整', values: [-12.34] }])
    expect(seriesOf(chart)[0].type).toBe('bar')
    expect(seriesOf(chart)[0].data[0].value).toBe(-12.34)
    const zero = costSunburst([{ key: 'zero', name: '已入账', values: [0] }])
    expect(seriesOf(zero)[0].data[0].value).toBe(0)
    expect((zero.graphic as { style: { text: string } }[])[0].style.text).toContain('0.00')
  })
  it('builds actual category/product hierarchy with drill keys and conserved totals', () => {
    const chart = costSunburst([
      { key: 'sku1', name: '金汤肥牛 12桶', group: 'noodle', groupName: '方便面', values: [100] },
      { key: 'sku2', name: '油泼辣子 12桶', group: 'noodle', groupName: '方便面', values: [50] },
      { key: 'sku3', name: '饮用水', group: 'water', groupName: '水', values: [70] },
    ])
    const groups = seriesOf(chart)[0].data as {
      name: string
      value: number
      children: { rowKey: string; value: number }[]
    }[]
    expect(groups.map((group) => group.value)).toEqual([150, 70])
    expect(groups[0].children.map((row) => row.rowKey)).toEqual(['sku1', 'sku2'])
    expect(
      groups.every(
        (group) => group.children.reduce((sum, row) => sum + row.value, 0) === group.value,
      ),
    ).toBe(true)
  })
  it('preserves date and salesperson together when a monthly trend point is clicked', () => {
    const chart = lines(
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
    ).toBe('sunburst')
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
