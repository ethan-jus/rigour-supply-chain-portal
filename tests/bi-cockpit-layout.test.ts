import { describe, expect, it } from 'vitest'
import { cockpitLayout } from '@/views/supply-chain/bi/cockpit-layout'
import { cockpitSections, type Figure } from '@/views/supply-chain/bi/cockpit-model'

const figure = (id: string): Figure => ({ id, title: id, span: 6, option: {}, rows: [] })
describe('经营看板分析层级', () => {
  it('总览成本与趋势在主分析列，回款和城市在监控列，不再把成本挤成四分之一宽', () => {
    const layout = cockpitLayout(
      'overview',
      [
        'performance-ranking',
        'cost-structure',
        'cost-bridge',
        'collection-progress',
        'trend',
        'cities',
      ].map(figure),
    )
    expect(layout.main.map((row) => row.id)).toEqual(['trend', 'cost-bridge'])
    expect(layout.aside.map((row) => row.id)).toEqual(['collection-progress', 'cities'])
    expect(layout.main.every((row) => row.span === 12)).toBe(true)
    expect(layout.groups.find((row) => row.id === 'costs')?.figures[0].id).toBe('cost-structure')
    expect(layout.groups.find((row) => row.id === 'sales')?.figures[0].id).toBe(
      'performance-ranking',
    )
  })
  it('完整全国人员业绩先于六人趋势，不能让Top6替代全员销售额', () => {
    const layout = cockpitLayout(
      'sales',
      ['performance-ranking', 'monthly-sales', 'collection-progress', 'targets'].map((id) => ({
        ...figure(id),
        span: 12,
        compact: id === 'targets',
      })),
    )
    expect(layout.main.map((row) => row.id)).toEqual(['performance-ranking', 'monthly-sales'])
    expect(layout.aside.map((row) => row.id)).toEqual(['collection-progress', 'targets'])
    expect(layout.aside.at(-1)?.compact).toBe(true)
  })
  it('客户、货品和库存各有主分析问题，不能继续共用相同图表顺序', () => {
    expect(
      cockpitLayout(
        'customer',
        ['customer-risk', 'segments', 'city-repeat', 'churn'].map(figure),
      ).main.map((row) => row.id),
    ).toEqual(['customer-risk', 'city-repeat'])
    expect(
      cockpitLayout(
        'product-sales',
        ['products', 'categories', 'brands', 'city-products'].map(figure),
      ).main.map((row) => row.id),
    ).toEqual(['city-products', 'products'])
    expect(
      cockpitLayout(
        'product-inventory',
        ['inventory-flow', 'coverage', 'replenishment'].map(figure),
      ).main.map((row) => row.id),
    ).toEqual(['replenishment', 'inventory-flow'])
  })
  it('单城市经营保留趋势盈亏，团队与商品独立分析；全国矩阵不会压扁城市行', () => {
    const layout = cockpitLayout(
      'city-operating',
      [
        'city-trend',
        'city-collection-progress',
        'performance-ranking',
        'targets',
        'cost-bridge',
        'aging',
        'city-sellers',
        'products',
        'city-products',
        'city-repeat',
      ].map(figure),
    )
    expect(layout.main.map((row) => row.id)).toEqual(['city-trend', 'cost-bridge'])
    expect(layout.groups.map((row) => row.label)).toEqual(['团队与目标', '商品与客户'])
    const matrix = cockpitLayout('city-operating', [
      {
        ...figure('cities'),
        rows: Array.from({ length: 18 }, (_, index) => ({
          key: String(index),
          name: String(index),
          cells: {},
        })),
      },
    ])
    expect(matrix.main[0].height).toBeGreaterThanOrEqual(18 * 26)
  })
  it('所有专题的既有或新增图形均可访问，且仅分配一次', () => {
    for (const section of Object.keys(cockpitSections) as (keyof typeof cockpitSections)[]) {
      const figures = ['trend', 'cost-bridge', 'cities', 'new-business-figure'].map(figure)
      const layout = cockpitLayout(section, figures)
      const ids = [
        ...layout.main,
        ...layout.aside,
        ...layout.groups.flatMap((group) => group.figures),
      ].map((row) => row.id)
      expect(ids.sort()).toEqual(figures.map((row) => row.id).sort())
      expect(layout.primary).toEqual([...layout.main, ...layout.aside])
    }
  })
})
