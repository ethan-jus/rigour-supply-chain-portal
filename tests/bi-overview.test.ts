import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BiOverviewBoard from '@/views/supply-chain/bi/components/BiOverviewBoard.vue'
import {
  aggregateGoals,
  collectionDonut,
  targetGauge,
  overviewPeriods,
  periodBuckets,
} from '@/views/supply-chain/bi/overview-model'
import { meetingFixture } from './fixtures/bi-meeting-data'
import type { SupplyDashboardOperatingAnalysis } from '@/api/core/bi'

describe('连续经营总览：年/月、真实聚合和目标口径', () => {
  it('历史全年查询完整12个月，当年对齐上年截止日期', () => {
    const now = new Date('2026-09-23T06:00:00Z')
    expect(overviewPeriods(2025, null, now).current).toEqual({
      from: '2025-01-01T00:00:00+08:00',
      to: '2025-12-31T23:59:59.999999+08:00',
    })
    expect(overviewPeriods(2026, null, now).previous.to).toBe('2025-09-23T23:59:59.999999+08:00')
  })
  it('闰年同比与短月环比不会查询不存在的日期', () => {
    expect(overviewPeriods(2024, null, new Date('2024-02-29T08:00:00Z')).previous.to).toBe(
      '2023-02-28T23:59:59.999999+08:00',
    )
    expect(overviewPeriods(2026, 3, new Date('2026-03-30T08:00:00Z')).previous.to).toBe(
      '2026-02-28T23:59:59.999999+08:00',
    )
    expect(() => overviewPeriods(2027, 1, new Date('2026-09-23T08:00:00Z'))).toThrow('尚未开始')
  })
  it('月末29/30/31日都归第四段，逐段总和与真实每日记录一致', () => {
    const data = meetingFixture().current
    data.from = '2026-08-01T00:00:00+08:00'
    data.to = '2026-08-31T23:59:59+08:00'
    data.salesTrend = [1, 7, 8, 14, 15, 21, 22, 28, 29, 30, 31].map((day) => ({
      metricCode: 'sales_amount',
      period: `2026-08-${String(day).padStart(2, '0')}`,
      value: day,
      secondaryValue: 0,
    }))
    expect(periodBuckets(data, false, false)).toEqual([8, 22, 36, 140])
  })
  it('未发生的区间为null，已发生但无交易的区间才为0', () => {
    const data = meetingFixture().current
    data.from = '2026-09-01T00:00:00+08:00'
    data.to = '2026-09-09T23:59:59+08:00'
    data.salesTrend = []
    expect(periodBuckets(data, false, false)).toEqual([0, 0, null, null])
    expect(periodBuckets(data, true, false)).toHaveLength(12)
    expect(periodBuckets(data, true, false).slice(9)).toEqual([null, null, null])
    expect(periodBuckets(null, false, false)).toEqual([null, null, null, null])
  })
  it('到账曲线只使用到账序列，不把订单累计回款当作到账', () => {
    const data = meetingFixture().current
    data.from = '2026-09-01T00:00:00+08:00'
    data.to = '2026-09-30T23:59:59+08:00'
    data.salesTrend = [
      { metricCode: 'sales_amount', period: '2026-09-05', value: 100, secondaryValue: 0 },
    ]
    data.collectionTrend = [
      { metricCode: 'receipt_amount', period: '2026-09-08', value: 280, secondaryValue: 0 },
    ]
    expect(periodBuckets(data, false, true)).toEqual([0, 280, 0, 0])
  })
  it('目标逐城市逐月份累加，不平均百分比或重复乘城市数', () => {
    const rows = ['BJ', 'HZ'].flatMap((regionCode) =>
      Array.from({ length: 12 }, (_, i) => ({
        regionCode,
        regionName: regionCode,
        month: i + 1,
        salesTarget: i === 1 && regionCode === 'BJ' ? 250000 : 100000,
        receiptTarget: 100000,
        newCustomerTarget: 200,
        repeatCustomerTarget: 100,
        configuredCount: i === 1 && regionCode === 'BJ' ? 1 : 0,
      })),
    )
    const analysis = { cityMonthlyGoals: rows } as SupplyDashboardOperatingAnalysis
    expect(aggregateGoals(analysis, 2)).toMatchObject({
      sales: 350000,
      receipt: 200000,
      cityCount: 2,
      newCustomer: 400,
      repeatCustomer: 200,
    })
    expect(aggregateGoals(analysis, null)).toMatchObject({
      sales: 2550000,
      receipt: 2400000,
      newCustomer: 4800,
      repeatCustomer: 2400,
    })
    expect(aggregateGoals(null, 9)).toBeNull()
  })
  it('目标弧按实际/目标绘制，超额保留真实百分比，缺失不冒充零', () => {
    const gauge = (actual: number | null, target: number | null) =>
      (
        targetGauge(actual, target).series as {
          data: { value: number }[]
          detail: { formatter: () => string }
        }[]
      )[0]!
    expect(gauge(57600, 100000).data[0]!.value).toBeCloseTo(57.6)
    expect(gauge(120000, 100000).data[0]!.value).toBe(100)
    expect(gauge(120000, 100000).detail.formatter()).toBe('120.0%')
    expect(gauge(null, 100000).detail.formatter()).toBe('—')
    expect(gauge(0, 0).detail.formatter()).toBe('—')
  })
  it('订单回款环图按订单累计回款计算，包含后续回款且与本期到账无关', () => {
    const data = meetingFixture().current
    const set = (code: string, value: number) => {
      data.metrics.find((m) => m.metricCode === code)!.value = value
    }
    set('sales_amount', 100)
    set('paid_amount', 20)
    set('receipt_amount', 50)
    const donut = () => collectionDonut(data)
    const slices = () =>
      (donut().series as { data: { value: number }[] }[])[0]!.data.map((d) => d.value)
    expect(slices()[0]).toBeCloseTo(20)
    expect(slices()[1]).toBeCloseTo(80)
    set('paid_amount', 70)
    expect(slices()).toEqual([70, 30])
    set('sales_amount', 0)
    expect((donut().graphic as { style: { text: string } }[])[0]!.style.text).toBe('—')
    expect(slices()).toEqual([0, 100])
    expect((collectionDonut(null).graphic as { style: { text: string } }[])[0]!.style.text).toBe(
      '—',
    )
  })
  it('城市交易榜使用同批订单回款20/100，到账榜独立显示50且不带回款率列', async () => {
    const snapshot = meetingFixture()
    snapshot.current.citySalesRanking = [
      {
        rankType: 'CITY',
        dimensionCode: 'CITY1',
        dimensionName: '测试城市',
        regionCode: 'CITY1',
        regionName: '测试城市',
        salesAmount: 100,
        paidAmount: 20,
        unpaidAmount: 80,
        orderCount: 1,
        customerCount: 1,
        rate: 0.2,
      },
    ]
    snapshot.analysis = {
      cityMonthlyGoals: [
        {
          regionCode: 'CITY1',
          regionName: '测试城市',
          month: 8,
          salesTarget: 100000,
          receiptTarget: 100000,
          newCustomerTarget: 200,
          repeatCustomerTarget: 100,
          configuredCount: 0,
        },
      ],
      cityReceipts: [{ regionCode: 'CITY1', regionName: '测试城市', receiptAmount: 50 }],
    } as unknown as SupplyDashboardOperatingAnalysis
    const wrapper = mount(BiOverviewBoard, {
      props: {
        snapshot,
        year: 2026,
        selectedMonth: 8,
        scopeLabel: '当前授权范围',
        loading: false,
        error: '',
      },
      global: { stubs: { EchartsChart: true, ElDialog: true } },
    })
    const table = () => wrapper.get('.overview-cities table')
    expect(table().text()).toContain('本期回款额')
    expect(table().text()).toContain('本期回款率')
    expect(table().find('tbody tr').text()).toContain('20.0%')
    const payments = wrapper.findAll('button').find((b) => b.text() === '本期到账排名')!
    await payments.trigger('click')
    expect(table().text()).toContain('本期到账')
    expect(table().text()).not.toContain('本期回款率')
    expect(table().find('tbody tr').text()).toContain('0.01') // 50 yuan in wan, rounded.
    wrapper.unmount()
  })
  it('年/月和到账排名可切换，全年复购使用全年去重字段', async () => {
    const snapshot = meetingFixture()
    snapshot.analysis = {
      customerRetention: {
        orderingCustomerCount: 10,
        returningCustomerCount: 2,
        newCustomerCount: 4,
        annualReturningCustomerCount: 6,
      },
      cityReceipts: [],
      cityMonthlyGoals: [],
    } as unknown as SupplyDashboardOperatingAnalysis
    const wrapper = mount(BiOverviewBoard, {
      props: {
        snapshot,
        year: 2026,
        selectedMonth: null,
        scopeLabel: '当前授权范围',
        loading: false,
        error: '',
      },
      global: { stubs: { EchartsChart: true, ElDialog: true } },
    })
    expect(wrapper.text()).toContain('60.0%')
    expect(wrapper.text()).toContain('按到账日期，包含历史订单本期到账')
    await wrapper.get('[aria-label="统计月份"]').setValue('8')
    expect(wrapper.emitted('period')?.at(-1)).toEqual([2026, 8])
    const receipts = wrapper.findAll('button').find((b) => b.text() === '本期到账排名')!
    await receipts.trigger('click')
    expect(receipts.classes()).toContain('active')
    expect(wrapper.find('.meeting-pages').exists()).toBe(false)
    wrapper.unmount()
  })
})
