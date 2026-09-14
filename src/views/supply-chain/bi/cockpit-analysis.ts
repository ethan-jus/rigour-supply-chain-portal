import type { SupplyDashboardOperatingAnalysis } from '@/api/core/bi'
import type { CockpitSection, Figure, DetailRow } from './cockpit-model'
import {
  bars,
  chartColors,
  exactAmount,
  heatmap,
  percent,
  ratio,
  ring,
  performanceColumns,
} from './cockpit-charts'
import { concreteDimension } from './cockpit-scope'

export const analysisSections: readonly CockpitSection[] = [
  'overview',
  'sales',
  'sales-collection',
  'city-operating',
  'customer',
  'product-sales',
]

export function operatingAnalysisFigures(
  data: SupplyDashboardOperatingAnalysis,
  section: CockpitSection,
): Figure[] {
  const figures: Figure[] = []
  if (['overview', 'city-operating', 'product-sales'].includes(section)) {
    const source = data.cityProducts
    const cityTotals = new Map<string, { name: string; amount: number }>()
    const categoryTotals = new Map<string, { name: string; amount: number }>()
    const key = (city: string | null, category: string) => JSON.stringify([city, category])
    const amounts = new Map(
      source.map((row) => [key(row.regionCode, row.categoryCode), row.salesAmount]),
    )
    for (const row of source) {
      const city = cityTotals.get(row.regionCode || '') || {
        name: row.regionName || '未归属城市',
        amount: 0,
      }
      city.amount += row.salesAmount
      cityTotals.set(row.regionCode || '', city)
      const category = categoryTotals.get(row.categoryCode) || {
        name: row.categoryName || '未分类',
        amount: 0,
      }
      category.amount += row.salesAmount
      categoryTotals.set(row.categoryCode, category)
    }
    const cities = [...cityTotals].sort((a, b) => b[1].amount - a[1].amount).slice(0, 8)
    const categories = [...categoryTotals].sort((a, b) => b[1].amount - a[1].amount).slice(0, 5)
    const plot = cities.map(([code, city]) => ({
      key: code,
      name: city.name,
      values: categories.map(([category]) => amounts.get(key(code || null, category)) ?? null),
    }))
    const rows: DetailRow[] = source.map((row) => ({
      key: key(row.regionCode, row.categoryCode),
      name: `${row.regionName || '未归属城市'} · ${row.categoryName || '未分类'}`,
      kind:
        concreteDimension(row.regionCode) && /^\d+$/.test(row.categoryCode) ? 'product' : undefined,
      dimension: 'CATEGORY',
      code: row.categoryCode,
      regionCode: row.regionCode,
      cells: {
        城市: row.regionName || '未归属城市',
        分类: row.categoryName,
        销售额: exactAmount(row.salesAmount),
        订单数: String(row.orderCount),
        客户数: String(row.customerCount),
      },
    }))
    figures.push({
      id: 'city-products',
      title: '城市与品类销售分布',
      span: section === 'product-sales' || section === 'overview' ? 12 : 6,
      height: 300,
      option: heatmap(
        plot,
        categories.map(([, category]) => category.name),
        { money: true, cellKey: (row, x) => key(row.key || null, categories[x][0]) },
      ),
      rows,
      note: '已归属城市及分类的订单行销售额；前8城市、前5品类，明细保留完整返回记录',
      empty: '当前范围没有城市品类销售记录',
    })
  }
  if (['city-operating', 'customer'].includes(section)) {
    const source = [...data.cityCustomers].sort(
      (a, b) => b.orderingCustomerCount - a.orderingCustomerCount,
    )
    const plot = source.map((row) => ({
      key: row.regionCode || 'UNKNOWN',
      name: row.regionName || '未归属城市',
      values: [
        row.repeatCustomerCount,
        Math.max(0, row.orderingCustomerCount - row.repeatCustomerCount),
      ],
    }))
    const single = source.length === 1 ? source[0] : null
    figures.push({
      id: 'city-repeat',
      title: '下单客户与期间复购',
      span: 6,
      option: single
        ? ring(
            [
              {
                key: single.regionCode || 'UNKNOWN',
                name: '期间复购',
                values: [single.repeatCustomerCount],
              },
              {
                key: single.regionCode || 'UNKNOWN',
                name: '仅下单一次',
                values: [Math.max(0, single.orderingCustomerCount - single.repeatCustomerCount)],
              },
            ],
            percent(ratio(single.repeatCustomerCount, single.orderingCustomerCount)),
            '期间复购率',
          )
        : bars(
            plot,
            [
              { name: '期间复购', color: chartColors[1] },
              { name: '仅下单一次', color: chartColors[0] },
            ],
            {
              stacked: true,
              vertical: true,
              unit: '客户',
            },
          ),
      rows: source.map((row) => ({
        key: row.regionCode || 'UNKNOWN',
        name: row.regionName || '未归属城市',
        kind: concreteDimension(row.regionCode) ? 'city' : undefined,
        code: row.regionCode || undefined,
        regionCode: row.regionCode,
        cells: {
          下单客户: String(row.orderingCustomerCount),
          期间复购客户: String(row.repeatCustomerCount),
          期间复购率: percent(ratio(row.repeatCustomerCount, row.orderingCustomerCount)),
        },
      })),
      note: '已归属城市内期间至少2笔未取消订单；分母为下单客户，跨城市客户不合计',
      empty: '当前范围没有下单客户',
    })
  }
  if (section === 'sales-collection') {
    const source = [...data.salesReceipts]
      .filter((row) => concreteDimension(row.ownerStaffCode))
      .sort(
        (a, b) => b.paidAmount - a.paidAmount || a.ownerStaffCode.localeCompare(b.ownerStaffCode),
      )
    let rank = 0
    const performance = source.map((row, i) => {
      if (!i || row.paidAmount !== source[i - 1].paidAmount) rank = i + 1
      return {
        key: row.ownerStaffCode,
        name: row.ownerStaffName || row.ownerStaffCode,
        region: '',
        value: row.paidAmount,
        rank,
      }
    })
    figures.push({
      id: 'receipt-ranking',
      title: '销售人员期间实际回款排行',
      span: 12,
      performance,
      performanceMetric: '期间实际回款',
      option: performanceColumns(performance.slice(0, 8), performance, '期间实际回款'),
      rows: source.map((row, i) => ({
        key: row.ownerStaffCode,
        name: row.ownerStaffName || row.ownerStaffCode,
        cells: {
          名次: String(performance[i].rank),
          期间实际回款: exactAmount(row.paidAmount),
          回款笔数: String(row.paymentCount),
          客户数: String(row.customerCount),
        },
      })),
      note: '按发生时间、BI归属销售汇总（可回退至客户销售或收款人）；人员筛选含经办回款',
      empty: '当前范围没有已归属销售的回款记录',
    })
  }
  return figures
}
