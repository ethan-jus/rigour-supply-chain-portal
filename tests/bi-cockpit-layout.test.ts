import { describe, expect, it } from 'vitest'
import { cockpitLayout } from '@/views/supply-chain/bi/cockpit-layout'
import { cockpitSections, type Figure } from '@/views/supply-chain/bi/cockpit-model'

const figure = (id: string): Figure => ({ id, title: id, span: 6, option: {}, rows: [] })
describe('经营看板分析层级', () => {
  it('总览保留成本和经营结余，销售榜留在分析区', () => {
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
    expect(layout.primary.map((row) => row.id)).toEqual([
      'trend',
      'collection-progress',
      'cost-bridge',
      'cost-structure',
    ])
    expect(layout.groups.find((row) => row.id === 'sales')?.figures[0].id).toBe(
      'performance-ranking',
    )
  })
  it('单城市经营保留盈亏，团队目标和商品客户分组，不把所有图平铺', () => {
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
    expect(layout.primary.map((row) => row.id)).toEqual([
      'city-trend',
      'city-collection-progress',
      'aging',
      'cost-bridge',
    ])
    expect(layout.groups.map((row) => row.label)).toEqual(['团队与目标', '商品与客户'])
  })
  it('所有专题的既有或新增图形均可访问，且仅分配一次', () => {
    for (const section of Object.keys(cockpitSections) as (keyof typeof cockpitSections)[]) {
      const figures = ['trend', 'cost-bridge', 'cities', 'new-business-figure'].map(figure)
      const layout = cockpitLayout(section, figures)
      const ids = [...layout.primary, ...layout.groups.flatMap((group) => group.figures)].map(
        (row) => row.id,
      )
      expect(ids.sort()).toEqual(figures.map((row) => row.id).sort())
    }
  })
})
