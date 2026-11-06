import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CostOverview from '@/views/supply-chain/bi/cost/CostOverview.vue'
import { monthlyTrend, overviewCards } from '@/views/supply-chain/bi/cost/cost-presentation'
import type { CostReport } from '@/api/core/bi-cost-dashboard'

function sample(): CostReport {
  const metric = (amount: string, count: number) => ({
    amount,
    count,
    unpaid: '0.00',
    draftCount: 0,
    draftAmount: '0.00',
    missingCount: 0,
    unassigned: '0.00',
  })
  return {
    meta: {
      snapshotId: 'test-snapshot',
      metricVersion: 'cost-v11',
      generatedAt: '2026-11-06T02:00:00Z',
      effectiveCutoff: '2026-11-06',
      period: {
        from: '2026-11-01',
        to: '2026-11-06',
        previousFrom: '2026-10-01',
        previousTo: '2026-10-06',
        compare: 'previous',
      },
      comparisonAvailable: false,
      comparisonReason: '无可比记录',
      includedSources: ['ERP', 'ORDER'],
      excludedScopes: [],
      dataState: 'READY',
      availableCategories: ['office', 'purchase', 'loss'],
      exportAllowed: true,
    },
    scope: 'opex',
    category: null,
    dimension: null,
    current: metric('10000.00', 2),
    previous: metric('0.00', 0),
    delta: null,
    growth: null,
    purchase: '60000.00',
    loss: '0.00',
    increased: null,
    decreased: null,
    categories: [],
    cityGroups: [],
    cities: [],
    matrix: [],
    changes: [],
    objects: [],
    dimensionCoverage: null,
    dimensions: [],
    cumulative: [],
    months: [],
    majorRecords: [],
    payrollComponents: [],
    scopeSummaries: [
      {
        scope: 'opex',
        label: '经营费用',
        current: metric('10000.00', 2),
        previous: metric('0.00', 0),
        comparisonAvailable: false,
        delta: null,
        growth: null,
        components: [],
      },
      {
        scope: 'purchase',
        label: '采购成本',
        current: { ...metric('60000.00', 1), reviewCount: 3 },
        previous: metric('40000.00', 1),
        comparisonAvailable: true,
        delta: '20000.00',
        growth: '50.0',
        components: [
          {
            key: 'GOODS',
            label: '采购货款',
            current: '50000.00',
            previous: '40000.00',
            delta: '10000.00',
            growth: '25.0',
            share: '83.3',
            count: 1,
            missing: false,
          },
          {
            key: 'FREIGHT',
            label: '采购运费',
            current: '10000.00',
            previous: '0.00',
            delta: '10000.00',
            growth: null,
            share: '16.7',
            count: 1,
            missing: false,
          },
        ],
      },
      {
        scope: 'loss',
        label: '商品损耗',
        current: metric('0.00', 0),
        previous: metric('0.00', 0),
        comparisonAvailable: false,
        delta: null,
        growth: null,
        components: [],
      },
    ],
  }
}

describe('成本总览的业务口径及展示', () => {
  it('经营费用分项常显且与经营费用合计一致，不重复展示采购和损耗', async () => {
    const report = sample()
    const items = [
      { key: 'freight', amount: '180.00' },
      { key: 'warehouse', amount: '6000.00' },
      { key: 'office', amount: '2500.00' },
      { key: 'marketing', amount: '1000.00' },
      { key: 'labor', amount: '0.00' },
      { key: 'expense', amount: '320.00' },
    ] as const
    report.categories = items.map(({ key, amount }) => ({
      key,
      label: key,
      current: amount,
      count: amount === '0.00' ? 0 : 1,
      previous: null,
      delta: null,
      growth: null,
      share: null,
      missing: false,
    }))
    const wrapper = mount(CostOverview, {
      props: {
        report,
        available: [...items.map(({ key }) => key), 'premises_unknown', 'purchase', 'loss'],
        comparisonLabel: '较上期',
        month: 11,
      },
      global: { stubs: { EchartsChart: true, CostRing: true, CostComparisonBars: true } },
    })
    const cards = wrapper.findAll('.expense-card')
    expect(cards).toHaveLength(6)
    expect(wrapper.find('.overview-expenses').element.closest('details')).toBeNull()
    expect(wrapper.find('.overview-expenses').text()).not.toContain('采购成本')
    expect(wrapper.find('.overview-expenses').text()).not.toContain('商品损耗')
    const cents = cards.reduce(
      (sum, card) => sum + Math.round(Number(card.find('strong').text().replaceAll(',', '')) * 100),
      0,
    )
    expect(cents).toBe(1000000)
    expect(cards[4]!.text()).toContain('0.00')
    expect(cards[4]!.text()).toContain('暂无已确认单据')
    await cards[0]!.trigger('click')
    expect(wrapper.emitted('category')).toEqual([['freight']])
    report.categories.push({
      key: 'premises_unknown',
      label: '待分类场地费用',
      current: '20.00',
      count: 1,
      previous: null,
      delta: null,
      growth: null,
      share: null,
      missing: false,
    })
    await wrapper.setProps({ report: { ...report } })
    expect(wrapper.findAll('.expense-card')).toHaveLength(7)
    expect(wrapper.findAll('.expense-card').at(-1)!.text()).toContain('待分类场地费用')
    await wrapper.setProps({ available: ['office', 'purchase'] })
    expect(wrapper.findAll('.expense-card')).toHaveLength(1)
    expect(wrapper.find('.expense-card').text()).toContain('办公费用')
    wrapper.unmount()
  })
  it('三类成本使用自身比较结果，不把采购并入经营费用或把零显示为缺失', async () => {
    const report = sample()
    const wrapper = mount(CostOverview, {
      props: {
        report,
        available: ['office', 'purchase', 'loss'],
        comparisonLabel: '较上期',
        month: 11,
      },
      global: { stubs: { EchartsChart: true, CostRing: true, CostComparisonBars: true } },
    })
    expect(wrapper.findAll('.scope-card')).toHaveLength(3)
    expect(wrapper.find('.scope-card.opex').text()).toContain('10,000.00')
    expect(wrapper.find('.scope-card.opex').text()).toContain('暂无可比期记录')
    const purchase = wrapper.find('.scope-card.purchase')
    expect(purchase.text()).toContain('60,000.00')
    expect(purchase.text()).toContain('+20,000.00')
    expect(purchase.text()).toContain('50.0%')
    expect(purchase.text()).toContain('采购货款 50,000.00')
    expect(purchase.text()).toContain('3 笔待核对')
    expect(wrapper.find('.scope-card.loss').text()).toContain('0.00')
    await purchase.trigger('click')
    expect(wrapper.emitted('scope')).toEqual([['purchase']])
    expect(report.current.amount).toBe('10000.00')
    expect(wrapper.find('.brief-hero').exists()).toBe(false)
    expect(wrapper.find('.overview-charts').exists()).toBe(true)
    expect(wrapper.find('details.payroll-costs').exists()).toBe(false)
    wrapper.unmount()
  })

  it('隐藏无权限口径，旧接口缺少采购比较信息时不伪造比较和单据数', () => {
    const report = sample()
    report.scopeSummaries = undefined
    const fallback = overviewCards(report, ['office', 'purchase'])
    expect(fallback.map((c) => c.scope)).toEqual(['opex', 'purchase'])
    expect(fallback[1]).toMatchObject({
      amount: '60000.00',
      count: undefined,
      comparable: false,
      delta: null,
      growth: null,
    })
    expect(overviewCards(sample(), ['office']).map((c) => c.scope)).toEqual(['opex'])
  })

  it('新接口明确无可比数据时不回退到父级的比较金额', () => {
    const report = sample()
    report.delta = '999.00'
    report.growth = '99.9'
    report.meta.comparisonAvailable = true
    expect(overviewCards(report, ['office'])[0]).toMatchObject({
      comparable: false,
      delta: null,
      growth: null,
    })
  })

  it('月度图保留可比期缺口、真实零值和点击月份，使用统一金额刻度', () => {
    const months = [
      {
        year: 2026,
        month: 1,
        label: '2026-01',
        current: '0.00',
        previous: '20.00',
        cutoff: '2026-01-31',
      },
      {
        year: 2026,
        month: 2,
        label: '2026-02',
        current: '110000.00',
        previous: null,
        cutoff: '2026-02-28',
      },
      {
        year: 2026,
        month: 3,
        label: '2026-03',
        current: '10.00',
        previous: '0.00',
        cutoff: '2026-03-06',
      },
    ]
    const chart = monthlyTrend(months) as {
      series: { data: unknown[]; connectNulls?: boolean }[]
      xAxis: { data: string[] }
      yAxis: { name: string }
    }
    expect(chart.series[0]!.data[0]).toEqual({ id: '2026-1', value: 0 })
    expect(chart.series[1]!.data).toEqual([
      { id: '2026-1', value: 20 },
      null,
      { id: '2026-3', value: 0 },
    ])
    expect(chart.series[1]!.connectNulls).toBe(false)
    expect(chart.yAxis.name).toBe('金额（万元）')
    expect(Array.isArray(chart.yAxis)).toBe(false)
    expect(chart.xAxis.data).toHaveLength(3)
    expect(monthlyTrend(months.map((m) => ({ ...m, previous: null }))).series).toHaveLength(1)
  })
})
