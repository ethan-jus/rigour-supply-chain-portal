import type { CockpitSection, Figure } from './cockpit-model'

interface AnalysisGroup {
  id: string
  label: string
  figures: string[]
}
interface Layout {
  label: string
  main: string[]
  aside: string[]
  groups: AnalysisGroup[]
}

const layouts: Record<CockpitSection, Layout> = {
  overview: {
    label: '经营监测',
    main: ['trend', 'cost-bridge'],
    aside: ['collection-progress', 'cities'],
    groups: [
      { id: 'cities', label: '城市与商品', figures: ['city-products', 'products'] },
      { id: 'sales', label: '全国销售业绩', figures: ['performance-ranking'] },
      { id: 'costs', label: '费用构成', figures: ['cost-structure'] },
    ],
  },
  sales: {
    label: '业绩监测',
    main: ['performance-ranking', 'monthly-sales'],
    aside: ['collection-progress', 'targets'],
    groups: [
      { id: 'collection', label: '销售回款比较', figures: ['sales-ranking'] },
      { id: 'movement', label: '业绩变化', figures: ['sales-movement'] },
    ],
  },
  'sales-collection': {
    label: '回款监测',
    main: ['receipt-trend', 'trend'],
    aside: ['collection-progress', 'aging'],
    groups: [{ id: 'receipts', label: '到账责任人', figures: ['receipt-ranking'] }],
  },
  'city-operating': {
    label: '城市经营',
    main: ['city-trend', 'cities', 'city-contacts', 'cost-bridge', 'city-costs'],
    aside: ['city-collection-progress', 'aging', 'products'],
    groups: [
      {
        id: 'team',
        label: '团队与目标',
        figures: ['performance-ranking', 'targets', 'city-sellers'],
      },
      { id: 'products', label: '商品与客户', figures: ['city-products', 'city-repeat'] },
    ],
  },
  customer: {
    label: '客户监测',
    main: ['customer-risk', 'city-repeat'],
    aside: ['segments'],
    groups: [
      { id: 'followup', label: '待跟进客户', figures: ['churn'] },
      { id: 'value', label: '客户贡献', figures: ['customer-value', 'segment-value'] },
    ],
  },
  'product-sales': {
    label: '商品动销',
    main: ['city-products', 'products'],
    aside: ['categories', 'brands'],
    groups: [{ id: 'coverage', label: '客户覆盖', figures: ['product-customers'] }],
  },
  'gross-profit': {
    label: '毛利监测',
    main: ['product-profit', 'margins'],
    aside: ['cost-coverage'],
    groups: [{ id: 'refunds', label: '退款影响', figures: ['refunds'] }],
  },
  'payment-risk': {
    label: '逾期监测',
    main: ['overdue-cities', 'overdue-sales'],
    aside: ['aging'],
    groups: [{ id: 'collection', label: '城市回款', figures: ['city-paid-rate'] }],
  },
  'city-cost': {
    label: '成本监测',
    main: ['cost-bridge', 'city-costs'],
    aside: ['cost-structure'],
    groups: [
      { id: 'goods', label: '货品与损耗', figures: ['sku-reference-cost', 'sku-costs'] },
      { id: 'people', label: '人力成本', figures: ['human-cost'] },
    ],
  },
  'product-inventory': {
    label: '供需监测',
    main: ['replenishment', 'inventory-flow'],
    aside: ['coverage'],
    groups: [{ id: 'stock', label: '历史留存', figures: ['inactive-stock'] }],
  },
  'inventory-risk': {
    label: '库存预警',
    main: ['risk-replenishment'],
    aside: ['risk-levels', 'risk-types'],
    groups: [],
  },
  activity: {
    label: '活动监测',
    main: ['conversion', 'campaigns'],
    aside: ['campaign-budget'],
    groups: [{ id: 'returns', label: '投入产出', figures: ['campaign-return'] }],
  },
}

const heights: Record<string, number> = {
  trend: 220,
  'city-trend': 220,
  'cost-bridge': 230,
  'collection-progress': 205,
  'city-collection-progress': 205,
  'performance-ranking': 280,
  'monthly-sales': 310,
  'city-products': 280,
  'city-costs': 260,
  'customer-risk': 260,
  'city-repeat': 240,
  'cost-structure': 285,
  replenishment: 310,
  coverage: 300,
  'inventory-flow': 240,
}

export function cockpitLayout(section: CockpitSection, figures: Figure[]) {
  const layout = layouts[section]
  const byId = new Map(figures.map((figure) => [figure.id, figure]))
  const assigned = new Set<string>()
  const take = (ids: string[]) =>
    ids.flatMap((id) => {
      const figure = byId.get(id)
      if (!figure || assigned.has(id)) return []
      assigned.add(id)
      return [figure]
    })
  const main = take(layout.main).map((figure) => ({
    ...figure,
    span: 12 as const,
    height:
      section === 'city-operating' && ['cities', 'city-contacts'].includes(figure.id) && !figure.comparison
        ? Math.max(280, figure.rows.length * 26 + 80)
        : heights[figure.id] || figure.height || 270,
  }))
  const aside = take(layout.aside).map((figure) => ({
    ...figure,
    span: 12 as const,
    height: heights[figure.id] || 230,
  }))
  const groups = layout.groups
    .map((group) => ({ ...group, figures: take(group.figures) }))
    .filter((group) => group.figures.length)
  // Keep new source-backed analyses reachable without silently adding another main row.
  const remainder = figures.filter((figure) => !assigned.has(figure.id))
  if (remainder.length) groups.push({ id: 'details', label: '补充分析', figures: remainder })
  return { label: layout.label, main, aside, primary: [...main, ...aside], groups }
}
