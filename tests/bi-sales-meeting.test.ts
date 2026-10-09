import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import BiSalesMeetingBoard from '@/views/supply-chain/bi/components/BiSalesMeetingBoard.vue'
import {
  personalGoal,
  salesDashboardRows,
  salesCustomerStats,
  salesProductTotals,
} from '@/views/supply-chain/bi/sales-dashboard-model'
import { salesDashboardFixture } from './fixtures/bi-sales-dashboard-data'
Element.prototype.scrollIntoView = vi.fn()
const props = () => ({
  snapshot: salesDashboardFixture(),
  detail: salesDashboardFixture(),
  selectedCode: '',
  regionCode: '',
  cities: [],
  period: { from: '2026-08-01', to: '2026-08-31' },
  maxDate: '2026-09-24',
  scopeLabel: '测试范围',
})
const render = (extra = {}) =>
  mount(BiSalesMeetingBoard, {
    props: { ...props(), ...extra },
    global: {
      stubs: { EchartsChart: { props: ['option'], template: '<div class="chart-stub" />' } },
    },
  })
describe('销售经营看板', () => {
  it('独立排序和离职零金额过滤，保留在职零金额', () => {
    const data = salesDashboardFixture()
    expect(salesDashboardRows(data, false, 8).map((p) => p.code)).toEqual([
      'S1',
      'S2',
      'S3',
      'S4',
      'S6',
    ])
    expect(salesDashboardRows(data, true, 8).map((p) => p.code)).toEqual(['S2', 'S1', 'S3', 'S6'])
    const first = salesDashboardRows(data, false, 8)[0]!
    expect(first.collectionRate).toBe(75)
    expect(first.previous).toBe(30000)
    expect(first.delta).toBe(6000)
  })
  it('正式月目标优先，四项年目标逐月补城市看板默认值', () => {
    const data = salesDashboardFixture().sales!
    data.goals.push({ code: 'S1', month: 8, metric: 'SALES_AMOUNT', target: 50000 })
    expect(personalGoal(data, 'S1', 'SALES_AMOUNT', 8).value).toBe(50000)
    expect(personalGoal(data, 'S1', 'SALES_AMOUNT', null).value).toBe(490000)
    expect(personalGoal(data, 'S1', 'RECEIPT_AMOUNT', null).value).toBe(240000)
    expect(personalGoal(data, 'S1', 'NEW_CUSTOMER', 8).value).toBe(20)
    expect(personalGoal(data, 'S1', 'NEW_CUSTOMER', null).value).toBe(2220)
    expect(personalGoal(data, 'S1', 'REPEAT_CUSTOMER', null).value).toBe(1110)
  })
  it('来源失败不把数据当零；年度客户独立去重', () => {
    const data = salesDashboardFixture()
    data.current.freshness.find((f) => f.sourceCode === 'ORDER_PAYMENT_RECORD')!.status = 'FAILED'
    expect(salesDashboardRows(data, true, 8).every((p) => p.amount == null)).toBe(true)
    expect(salesCustomerStats(data, true).returning).toBe(12)
  })
  it('完整元金额、上期对比、点击人员下钻', async () => {
    const w = render()
    expect(w.text()).toContain('36,000.00')
    expect(w.text()).toContain('上月同期(元)')
    expect(w.text()).not.toContain('万元')
    await w
      .findAll('button')
      .find((b) => b.text() === '张明')!
      .trigger('click')
    expect(w.emitted('select')?.[0]).toEqual(['S1'])
    w.unmount()
  })
  it('个人页具备四项目标，商品筛选不改变目标', async () => {
    const w = render({ selectedCode: 'S1' })
    expect(w.findAll('.sales-goal-grid article')).toHaveLength(4)
    expect(w.find('.sales-goal-grid').text()).toContain('新增合作客户数')
    expect(w.find('.sales-goal-grid').text()).toContain('复购客户数')
    const before = w.find('.sales-goal-grid').text()
    await w.get('[aria-label="商品品类"]').setValue('cloth')
    expect(w.find('.sales-products').text()).not.toContain('专业球杆')
    expect(w.find('.sales-goal-grid').text()).toBe(before)
    w.unmount()
  })
  it('商品数量保留小数，区分真实零数量和接口缺失', () => {
    const detail = salesDashboardFixture()
    detail.sales!.products[1]!.quantity = 0
    detail.sales!.products[2]!.quantity = null
    const w = render({ selectedCode: 'S1', detail })
    const rows = w.findAll('.sales-products tbody tr')
    expect(rows.map((r) => r.findAll('td')[1]!.text())).toEqual(['12.5', '0', '—'])
    expect(w.get('.sales-products tfoot td').text()).toBe('—')
    w.unmount()
  })
  it('商品合计覆盖筛选全部结果，翻页不变，品类商品型号筛选同步更新', async () => {
    const detail = salesDashboardFixture()
    const first = detail.sales!.products[0]!
    detail.sales!.products = Array.from({ length: 6 }, (_, i) => ({
      ...first,
      sku: `A${i}`,
      quantity: i + 1,
      sales: 100 + i,
      receipts: 20 + i,
      received: 50 + i,
    }))
    detail.sales!.products.push({
      ...first,
      categoryId: 'other',
      productId: 'P2',
      sku: 'B1',
      quantity: 99,
      sales: 999,
      receipts: 999,
      received: 999,
    })
    const w = render({ selectedCode: 'S1', detail })
    await w.get('[aria-label="商品品类"]').setValue('cloth')
    const cells = () =>
      w
        .get('.sales-products tfoot tr')
        .findAll('th, td')
        .map((c) => c.text())
    expect(cells()).toEqual(['筛选合计共 6 项', '21', '615.00', '135.00', '315.00', '51.2%'])
    await w.get('[aria-label="商品下一页"]').trigger('click')
    expect(w.findAll('.sales-products tbody tr')).toHaveLength(1)
    expect(cells()[2]).toBe('615.00')
    await w.get('[aria-label="商品"]').setValue('P1')
    await w.get('[aria-label="型号"]').setValue('A2')
    expect(cells()).toEqual(['筛选合计共 1 项', '3', '102.00', '22.00', '52.00', '51.0%'])
    w.unmount()
  })
  it('合计保留分摊精度，空结果为零，缺失数量不伪装成零', () => {
    const p = salesDashboardFixture().sales!.products[0]!
    expect(
      salesProductTotals([
        { ...p, sales: 0.104 },
        { ...p, sales: 0.104 },
      ]).sales,
    ).toBe(0.208)
    expect(salesProductTotals([])).toMatchObject({
      quantity: 0,
      sales: 0,
      receipts: 0,
      received: 0,
    })
    expect(salesProductTotals([{ ...p, quantity: null }]).quantity).toBeNull()
  })
  it('分摊到账先合计再展示，三行尾差不会改变实际到账总额', () => {
    const detail = salesDashboardFixture()
    const product = detail.sales!.products[0]!
    detail.sales!.products = [0.333333, 0.333333, 0.333334].map((receipts, i) => ({
      ...product,
      sku: `split-${i}`,
      receipts,
    }))
    const w = render({ selectedCode: 'S1', detail })
    expect(w.findAll('.sales-products tbody tr').map((row) => row.findAll('td')[3]!.text()))
      .toEqual(['0.33', '0.33', '0.33'])
    expect(w.get('.sales-products tfoot tr').findAll('th, td')[3]!.text()).toBe('1.00')
    w.unmount()
  })
  it('商品显示对应主图，无图保持占位且不影响金额', () => {
    const detail = salesDashboardFixture()
    detail.sales!.products[0]!.imageUrl = 'https://img.test/P1.png'
    const w = render({ selectedCode: 'S1', detail })
    const image = w.getComponent({ name: 'ElImage' })
    expect(image.props('src')).toBe('https://img.test/P1.png')
    expect(w.findAll('.sales-products tbody .sales-product-image-empty')).toHaveLength(2)
    expect(w.get('.sales-products tfoot').text()).toContain('36,000.00')
    w.unmount()
  })
  it('日视图隐藏趋势、目标和完成率，保留订单回款率', async () => {
    const w = render({ dayMode: true, period: { from: '2026-08-12', to: '2026-08-12' } })
    expect(w.find('.sales-ranking').text()).not.toContain('目标完成率')
    expect(w.find('.sales-ranking').text()).toContain('前一天')
    expect(w.find('.sales-ranking').text()).toContain('本期回款率')
    await w.setProps({ selectedCode: 'S1' })
    expect(w.find('.sales-performance-grid').exists()).toBe(false)
    expect(w.find('.sales-collections').text()).toContain('本期回款率')
    w.unmount()
  })
  it('目标缺失时客户月目标默认200和100，并展示真实完成数', () => {
    const detail = salesDashboardFixture()
    detail.sales!.goals = []
    const w = render({ selectedCode: 'S1', detail })
    expect(w.find('.sales-goal-grid').text()).not.toContain('目标待配置')
    expect(w.find('.sales-goal-grid').text()).toContain('目标 200家')
    expect(w.find('.sales-goal-grid').text()).toContain('目标 100家')
    expect(w.find('.sales-goal-grid').text()).toContain('15')
    w.unmount()
  })
})
