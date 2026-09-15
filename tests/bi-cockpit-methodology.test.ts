import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import type { SupplyDashboardOverview } from '@/api/core/bi'
import {
  buildCockpit,
  cockpitSections,
  type CockpitOptions,
  type CockpitSection,
} from '@/views/supply-chain/bi/cockpit-model'
import {
  buildMetricExplanations,
  hasMetricExplanation,
} from '@/views/supply-chain/bi/cockpit-methodology'
import CockpitMetricGuide from '@/views/supply-chain/bi/components/CockpitMetricGuide.vue'

const options: CockpitOptions = {
  period: 'month',
  productDimension: 'PRODUCT',
  inventoryUnit: 'BOX',
  costGroup: '全部',
}
const source = () =>
  ({
    from: '2026-09-01T00:00:00+08:00',
    to: '2026-09-12T23:59:59+08:00',
    metrics: [
      { metricCode: 'sales_amount', value: 1000 },
      { metricCode: 'paid_amount', value: 1200 },
      { metricCode: 'unpaid_amount', value: -200 },
    ],
    citySalesRanking: [],
    salesRanking: [],
  }) as unknown as SupplyDashboardOverview

describe('看板业务口径', () => {
  it('每个专题的全部指标和图表都有明确说明，不留无公式的占位说明', () => {
    const data = source()
    for (const section of Object.keys(cockpitSections) as CockpitSection[]) {
      const model = buildCockpit(data, section, options)
      for (const kpi of model.kpis)
        expect(hasMetricExplanation('kpi', kpi.label), `${section}/${kpi.label}`).toBe(true)
      for (const figure of model.figures)
        expect(hasMetricExplanation('figure', figure.id), `${section}/${figure.id}`).toBe(true)
      const explanations = buildMetricExplanations(data, model.kpis, model.figures, options)
      expect(
        explanations.every((entry) => entry.formula && entry.source && entry.rules.length),
      ).toBe(true)
      expect(JSON.stringify(explanations)).not.toContain('尚未提供完整')
    }
    for (const id of [
      'city-products',
      'city-repeat',
      'sales-growth',
      'receipt-ranking',
      'sales-movement',
      'sku-reference-cost',
    ])
      expect(hasMetricExplanation('figure', id)).toBe(true)
  })

  it('解释合计回款率，保留超额值，与按到账日统计明确分开', () => {
    const data = source()
    const model = buildCockpit(data, 'sales-collection', options)
    const entries = buildMetricExplanations(data, model.kpis, model.figures, options)
    const rate = entries.find((entry) => entry.id === 'kpi:回款率')!
    expect(rate.value).toBe('120.0%')
    expect(rate.rules.join(' ')).toContain('¥1,200.00 ÷ ¥1,000.00 × 100% = 120.0%')
    expect(rate.rules.join(' ')).toContain('不是各城市、销售或订单回款率的算术平均')
    expect(entries.find((entry) => entry.id === 'figure:receipt-trend')?.formula).toContain(
      '回款发生日期',
    )
    data.metrics[0].value = 0
    const empty = buildCockpit(data, 'sales', options)
    expect(
      buildMetricExplanations(data, empty.kpis, empty.figures, options).find(
        (entry) => entry.id === 'kpi:回款率',
      )?.value,
    ).toBe('—')
  })

  it('同组指标也分别展示自己的首行公式，不拿金额公式解释人数或天数', () => {
    const data = source()
    for (const [section, label, formula] of [
      ['payment-risk', '逾期客户', '去重客户数'],
      ['payment-risk', '平均逾期天数', '÷ 逾期未收订单数'],
      ['customer', '复购客户', '至少有2笔'],
      ['city-cost', '成本率', '经营成本 ÷ 销售额'],
      ['activity', '活动费用', '已用费用之和'],
      ['inventory-risk', '高风险', '风险等级为高的记录数'],
      ['product-inventory', '留存数量', '当前ERP库存快照'],
    ]) {
      const model = buildCockpit(data, section as CockpitSection, options)
      const entry = buildMetricExplanations(data, model.kpis, model.figures, options).find(
        (item) => item.id === `kpi:${label}`,
      )!
      expect(entry.formula, `${section}/${label}`).toContain(formula)
      expect(entry.rules.length).toBeGreaterThan(0)
    }
  })

  it('前六位排除未归属销售，同额稳定排序，不跟随累计回款排序切换', () => {
    const data = source()
    data.salesRanking = [
      { dimensionCode: 'UNKNOWN', dimensionName: '未归属', salesAmount: 99999 },
      ...Array.from({ length: 7 }, (_, i) => ({
        dimensionCode: `S${7 - i}`,
        dimensionName: `销售${7 - i}`,
        salesAmount: 100,
        paidAmount: i * 10,
      })),
    ].map((row) => ({
      orderCount: 1,
      customerCount: 1,
      unpaidAmount: 50,
      paidAmount: 0,
      ...row,
    })) as never
    data.salesMonthlyPerformance = ['2026-08', '2026-09'].flatMap((period) =>
      data.salesRanking.map((row) => ({
        period,
        ownerStaffCode: row.dimensionCode,
        ownerStaffName: row.dimensionName,
        salesAmount: 50,
        paidAmount: 20,
        customerCount: 1,
      })),
    ) as never
    const model = buildCockpit(data, 'sales', { ...options, rankingMetric: 'paidAmount' })
    const figure = model.figures.find((item) => item.id === 'monthly-sales')!
    expect(figure.title).toBe('销售额前6位 · 月度趋势')
    expect(figure.smallMultiples?.series.map((row) => row.name)).toEqual([
      '销售1',
      '销售2',
      '销售3',
      '销售4',
      '销售5',
      '销售6',
    ])
    const entry = buildMetricExplanations(data, model.kpis, model.figures, options).find(
      (item) => item.id === 'figure:monthly-sales',
    )!
    expect(entry.formula).toContain('最多6位已归属销售')
    expect(entry.rules.join(' ')).toContain('不是重点员工或绩效评价')
    expect(entry.rules.join(' ')).toContain('当前展示6位：销售1、销售2、销售3、销售4、销售5、销售6')
  })

  it('说明单人趋势和变化图不会错误宣称销售额Top6', () => {
    const data = source()
    const model = buildCockpit(data, 'sales', { ...options, ownerStaffCode: 'S1' })
    const entry = buildMetricExplanations(data, model.kpis, model.figures, {
      ownerStaffCode: 'S1',
    }).find((item) => item.id === 'figure:monthly-sales')!
    expect(entry.formula).toContain('订单日期')
    expect(entry.formula).not.toContain('6位')
  })

  it('样例成本公开实际使用的参数，真实销售不标样例；受限成本不泄露演示计算', () => {
    const data = source()
    const model = buildCockpit(data, 'city-cost', options)
    const entries = buildMetricExplanations(data, model.kpis, model.figures, options)
    const assumptions = entries.find((item) => item.id === 'cost-assumptions')!
    expect(assumptions.sample).toBe(true)
    expect(assumptions.rules.join(' ')).toContain('× 31.00%')
    expect(assumptions.rules.join(' ')).toContain('× 12天')
    expect(entries.find((item) => item.id === 'kpi:销售额')?.sample).not.toBe(true)
    const limited = buildCockpit(data, 'city-cost', { ...options, costScopeLimited: true })
    expect(
      buildMetricExplanations(data, limited.kpis, limited.figures, options).some(
        (item) => item.id === 'cost-assumptions',
      ),
    ).toBe(false)
  })

  it('图旁打开聚焦本图，再能查全部口径并搜索；内容按文本渲染', async () => {
    const data = source(),
      model = buildCockpit(data, 'sales-collection', options)
    const entries = buildMetricExplanations(data, model.kpis, model.figures, options)
    const wrapper = mount(CockpitMetricGuide, {
      props: { entries, scope: '2026年9月 · 全部城市', focus: 'kpi:回款率' },
      global: { plugins: [ElementPlus] },
    })
    expect(wrapper.findAll('article')).toHaveLength(1)
    expect(wrapper.text()).toContain('120.0%')
    await wrapper.find('button').trigger('click')
    expect(wrapper.findAll('article').length).toBeGreaterThan(1)
    await wrapper.find('input').setValue('期间实际回款')
    expect(wrapper.text()).toContain('回款发生日期')
    await wrapper.find('input').setValue('<script>')
    expect(wrapper.findAll('article')).toHaveLength(0)
    wrapper.unmount()
  })
})
