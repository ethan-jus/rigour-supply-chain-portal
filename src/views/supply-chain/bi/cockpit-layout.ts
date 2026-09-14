import type { CockpitSection, Figure } from './cockpit-model'

interface AnalysisGroup {
  id: string
  label: string
  figures: string[]
}
interface Layout {
  primary: string[]
  groups: AnalysisGroup[]
}
const layouts: Record<CockpitSection, Layout> = {
  overview: {
    primary: ['trend', 'collection-progress', 'cost-bridge', 'cost-structure'],
    groups: [
      { id: 'cities', label: '城市与商品', figures: ['cities', 'products', 'city-products'] },
      { id: 'sales', label: '全国销售业绩', figures: ['performance-ranking'] },
    ],
  },
  sales: {
    primary: ['performance-ranking', 'monthly-sales', 'collection-progress', 'targets'],
    groups: [
      { id: 'collection', label: '销售回款比较', figures: ['sales-ranking'] },
      { id: 'movement', label: '业绩变化', figures: ['sales-movement'] },
    ],
  },
  'sales-collection': {
    primary: ['trend', 'collection-progress', 'receipt-trend', 'aging'],
    groups: [{ id: 'receipts', label: '到账责任人', figures: ['receipt-ranking'] }],
  },
  'city-operating': {
    primary: [
      'city-trend',
      'city-collection-progress',
      'cities',
      'aging',
      'cost-bridge',
      'city-costs',
    ],
    groups: [
      {
        id: 'team',
        label: '团队与目标',
        figures: ['performance-ranking', 'targets', 'city-sellers'],
      },
      {
        id: 'products',
        label: '商品与客户',
        figures: ['products', 'city-products', 'city-repeat'],
      },
    ],
  },
  customer: {
    primary: ['segments', 'segment-value', 'city-repeat'],
    groups: [{ id: 'followup', label: '客户价值与待唤醒', figures: ['customer-value', 'churn'] }],
  },
  'product-sales': {
    primary: ['products', 'categories', 'city-products'],
    groups: [{ id: 'coverage', label: '品牌与客户覆盖', figures: ['brands', 'product-customers'] }],
  },
  'gross-profit': {
    primary: ['product-profit', 'cost-coverage'],
    groups: [{ id: 'drivers', label: '毛利与退货', figures: ['margins', 'refunds'] }],
  },
  'payment-risk': {
    primary: ['overdue-cities', 'aging'],
    groups: [
      {
        id: 'responsibility',
        label: '销售责任与回款',
        figures: ['overdue-sales', 'city-paid-rate'],
      },
    ],
  },
  'city-cost': {
    primary: ['cost-bridge', 'cost-structure', 'city-costs'],
    groups: [
      { id: 'goods', label: '货品与损耗', figures: ['sku-reference-cost', 'sku-costs'] },
      { id: 'people', label: '人力成本', figures: ['human-cost'] },
    ],
  },
  'product-inventory': {
    primary: ['inventory-flow', 'coverage'],
    groups: [{ id: 'stock', label: '补货与滞销', figures: ['replenishment', 'inactive-stock'] }],
  },
  'inventory-risk': {
    primary: ['risk-levels', 'risk-types'],
    groups: [{ id: 'replenishment', label: '补货优先级', figures: ['risk-replenishment'] }],
  },
  activity: {
    primary: ['campaigns', 'conversion'],
    groups: [
      { id: 'returns', label: '预算与投入产出', figures: ['campaign-budget', 'campaign-return'] },
    ],
  },
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
  const primary = take(layout.primary)
  const groups = layout.groups
    .map((group) => ({ ...group, figures: take(group.figures) }))
    .filter((group) => group.figures.length)
  // New business figures remain reachable until a dedicated analysis group is assigned.
  const remainder = figures.filter((figure) => !assigned.has(figure.id))
  if (remainder.length) groups.push({ id: 'details', label: '补充分析', figures: remainder })
  return {
    primary: fillRows(primary),
    groups: groups.map((group) => ({ ...group, figures: fillRows(group.figures) })),
  }
}

function fillRows(figures: Figure[]): Figure[] {
  const result: Figure[] = []
  let row: Figure[] = []
  let width = 0
  const flush = () => {
    result.push(...(row.length === 1 ? [{ ...row[0], span: 12 as const }] : row))
    row = []
    width = 0
  }
  for (const figure of figures) {
    const span = figure.compact ? 12 : figure.span
    if (width + span > 12) flush()
    row.push(figure)
    width += span
    if (width === 12) flush()
  }
  flush()
  return result
}
