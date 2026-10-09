import { beforeEach, describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { cityMeetingFixture } from './fixtures/bi-city-meeting-data'
import {
  cityMeetingRows,
  citySalesRows,
  customerRetention,
  rankCities,
} from '@/views/supply-chain/bi/city-meeting-model'
import { meetingTarget } from '@/views/supply-chain/bi/meeting-model'
import BiCityMeetingBoard from '@/views/supply-chain/bi/components/BiCityMeetingBoard.vue'

beforeEach(() => {
  HTMLElement.prototype.scrollTo = vi.fn()
})

describe('城市看板口径与主流程', () => {
  it('交易额与到账金额独立排名，回款不能回退到订单累计已收', () => {
    const source = cityMeetingFixture()
    const rows = cityMeetingRows(source)
    expect(rankCities(rows, 'sales')[0].name).toBe('杭州')
    expect(rankCities(rows, 'receipts')[0].name).toBe('宁波')
    expect(rows[0].receipts).toBe(268000)
    expect(rows[0].receiptRate).toBeCloseTo(78.8235)
    source.analysis = null
    expect(cityMeetingRows(source)[0].receipts).toBeNull()
  })
  it('保留没有本月订单但本月到账的城市，独立目标缺失不伪造零', () => {
    const source = cityMeetingFixture()
    source.analysis!.cityReceipts!.push({
      regionCode: 'OLD',
      regionName: '历史订单城市',
      receiptAmount: 990000,
      paymentCount: 1,
      customerCount: 1,
    })
    source.current.cityTargetCompletions = source.current.cityTargetCompletions.filter(
      (t) => t.metricCode !== 'RECEIPT_AMOUNT',
    )
    const rows = cityMeetingRows(source)
    const old = rankCities(rows, 'receipts')[0]
    expect(old.code).toBe('OLD')
    expect(old.sales).toBe(0)
    expect(old.receiptTarget).toBeNull()
    expect(meetingTarget(source.current, 'RECEIPT_AMOUNT').target).toBeNull()
  })
  it('城市名单以部门目标目录为准，零成交城市保留，非城市部门不混入排名', () => {
    const source = cityMeetingFixture()
    source.analysis!.cityMonthlyGoals = ['CITY-0', 'ZERO'].map((regionCode) => ({
      regionCode,
      regionName: regionCode === 'ZERO' ? '零成交城市' : '杭州',
      month: 9,
      salesTarget: 100000,
      receiptTarget: 100000,
      newCustomerTarget: 200,
      repeatCustomerTarget: 100,
      configuredCount: 0,
    }))
    source.analysis!.cityReceipts!.push({
      regionCode: 'OUTSIDE_CITY',
      regionName: '非城市销售部门',
      receiptAmount: 990000,
      paymentCount: 1,
      customerCount: 1,
    })
    const rows = cityMeetingRows(source)
    expect(rows.map((r) => r.code)).toEqual(['CITY-0', 'ZERO'])
    expect(rows.find((r) => r.code === 'ZERO')).toMatchObject({
      sales: 0,
      receipts: 0,
      salesTarget: 100000,
    })
  })
  it('复购只使用确认的跨月口径，去重总数不加总城市', () => {
    const source = cityMeetingFixture('CITY-0')
    expect(customerRetention(source)).toEqual({ customers: 112, returning: 56, rate: 50 })
    source.analysis = null
    expect(customerRetention(source).returning).toBeNull()
    source.analysis = {
      ...cityMeetingFixture().analysis!,
      customerRetention: { orderingCustomerCount: 0, returningCustomerCount: 0 },
    }
    expect(customerRetention(source).rate).toBeNull()
  })
  it('回款来源未就绪时不显示已缓存的目标实际值', () => {
    const source = cityMeetingFixture()
    source.current.freshness.push({ sourceCode: 'ORDER_PAYMENT_RECORD', status: 'FAILED' } as never)
    expect(meetingTarget(source.current, 'RECEIPT_AMOUNT').actual).toBeNull()
    expect(cityMeetingRows(source)[0].receiptRate).toBeNull()
  })
  it('单城连续滚动，销售比较替代全国城市比较，年月与城市可切换', async () => {
    const city = cityMeetingFixture('CITY-0')
    city.current.salesRanking = [
      { ...city.current.citySalesRanking[0], dimensionCode: 'A', dimensionName: '销售A' },
    ]
    const wrapper = mount(BiCityMeetingBoard, {
      props: {
        snapshot: city,
        allSnapshot: cityMeetingFixture(),
        regionCode: 'CITY-0',
        month: '2026-09',
        maxMonth: '2026-09',
        scopeLabel: '当前授权范围',
        embedded: true,
      },
      global: { stubs: { EchartsChart: true, ElDialog: true } },
    })
    expect(wrapper.findAll('.city-screen')).toHaveLength(0)
    expect(wrapper.text()).toContain('销售业绩对比')
    expect(wrapper.text()).not.toContain('全国城市')
    expect(wrapper.text()).not.toContain('下滑查看')
    expect(wrapper.get('[aria-label="选择城市"]').findAll('option')).toHaveLength(6)
    await wrapper.get('[aria-label="选择城市"]').setValue('CITY-2')
    expect(wrapper.emitted('city')!.at(-1)).toEqual(['CITY-2'])
    await wrapper.get('[aria-label="统计月份"]').setValue('')
    expect(wrapper.emitted('period')!.at(-1)).toEqual([2026, null])
    await wrapper.get('[aria-label="统计年份"]').setValue('2025')
    expect(wrapper.emitted('period')!.at(-1)).toEqual([2025, 9])
    await wrapper
      .findAll('button')
      .find((b) => b.text() === '本期到账排名')!
      .trigger('click')
    expect(wrapper.get('.city-sales-comparison thead').text()).toContain('本期到账')
    expect(wrapper.get('.city-sales-comparison thead').text()).not.toContain('本期回款率')
    expect(wrapper.get('.city-sales-comparison').text()).not.toContain('20,000.00')
    await wrapper.setProps({ loading: true, snapshot: null })
    expect(wrapper.find('.city-sales-comparison').exists()).toBe(false)
    await wrapper.setProps({ loading: false, snapshot: city })
    expect(wrapper.get('.city-sales-comparison thead').text()).toContain('本期到账')
    wrapper.unmount()
  })
  it('销售回款按订单累计，到账独立排名并保留仅历史订单到账的销售', () => {
    const source = cityMeetingFixture('CITY-0')
    source.current.salesRanking = [
      {
        ...source.current.citySalesRanking[0],
        dimensionCode: 'A',
        dimensionName: '销售A',
        salesAmount: 100,
        paidAmount: 20,
      },
    ]
    source.current.salesTargetCompletions = []
    source.analysis!.salesReceipts = [
      {
        ownerStaffCode: 'A',
        ownerStaffName: '销售A',
        paidAmount: 50,
        paymentCount: 1,
        customerCount: 1,
      },
      {
        ownerStaffCode: 'B',
        ownerStaffName: '销售B',
        paidAmount: 80,
        paymentCount: 1,
        customerCount: 1,
      },
    ]
    const trade = citySalesRows(source, false, false)
    expect(trade[0]).toMatchObject({ code: 'A', amount: 100, paid: 20, target: null })
    expect(trade.find((r) => r.code === 'B')).toMatchObject({ amount: 0, paid: 0 })
    expect(citySalesRows(source, true, false)[0]).toMatchObject({
      code: 'B',
      amount: 80,
      target: null,
    })
    source.analysis = null
    expect(citySalesRows(source, true, false)[0].amount).toBeNull()
  })
  it('个人目标来自接口，年度缺失月份不再由前端补齐', () => {
    const source = cityMeetingFixture('CITY-0')
    source.current.salesRanking = [
      { ...source.current.citySalesRanking[0], dimensionCode: 'A', dimensionName: '销售A' },
    ]
    source.current.salesTargetCompletions = [
      {
        dimensionType: 'SALES_OWNER',
        dimensionCode: 'A',
        dimensionName: '销售A',
        metricCode: 'SALES_AMOUNT',
        metricName: '交易',
        targetValue: 60000,
        actualValue: 0,
        achievementRate: 0,
        configuredMonthCount: 1,
        periodMonthCount: 1,
      },
    ]
    expect(citySalesRows(source, false, false)[0]).toMatchObject({
      target: 60000,
    })
    expect(citySalesRows(source, false, true)[0]).toMatchObject({
      target: null,
    })
    expect(citySalesRows(source, true, true)[0]).toMatchObject({
      target: null,
    })
    source.current.salesTargetCompletions = []
    expect(citySalesRows(source, false, true)[0].target).toBeNull()
  })
})

describe('销售榜离职人员过滤', () => {
  it('两榜分别判断零值，保留在职零业绩、历史到账、负值及未知状态人员', () => {
    const source = cityMeetingFixture('CITY-0')
    const staff = [
      ['TRADE', 'LEFT', 100, 0],
      ['CASH', 'LEFT', 0, 30],
      ['ZERO', 'LEFT', 0, 0],
      ['ACTIVE', 'ACTIVE', 0, 0],
      ['UNKNOWN', null, 0, 0],
      ['NEGATIVE', 'LEFT', -10, -5],
    ] as const
    source.analysis!.salesPeople = staff.map(([code, status]) => ({
      ownerStaffCode: code === 'UNKNOWN' ? 'NO_STATUS' : code,
      ownerStaffName: code,
      employmentStatus: status,
    }))
    source.current.salesRanking = staff
      .filter(([, , amount]) => amount !== 0)
      .map(([code, , amount]) => ({
        ...source.current.citySalesRanking[0],
        dimensionCode: code,
        dimensionName: code,
        salesAmount: amount,
      }))
    source.current.salesTargetCompletions = []
    source.analysis!.salesReceipts = staff
      .filter(([, , , amount]) => amount !== 0)
      .map(([code, , , amount]) => ({
        ownerStaffCode: code,
        ownerStaffName: code,
        paidAmount: amount,
        paymentCount: 1,
        customerCount: 1,
      }))
    expect(citySalesRows(source, false, false).map((r) => r.code)).toEqual([
      'TRADE',
      'ACTIVE',
      'NO_STATUS',
      'NEGATIVE',
    ])
    expect(citySalesRows(source, true, false).map((r) => r.code)).toEqual([
      'CASH',
      'ACTIVE',
      'NO_STATUS',
      'NEGATIVE',
    ])
    // 缺失到账来源不能误判为零并删掉离职人员。
    source.analysis!.salesReceipts = undefined as never
    expect(citySalesRows(source, true, false).find((r) => r.code === 'ZERO')?.amount).toBeNull()
  })
})

describe('城市销售上期对比与金额展示', () => {
  it('交易额与到账分别使用完整上期快照，来源失败保留未知值', () => {
    const source = cityMeetingFixture('CITY-0')
    const row = {
      ...source.current.citySalesRanking[0],
      dimensionCode: 'S',
      dimensionName: '销售',
      salesAmount: 12345.67,
    }
    source.current.salesRanking = [row]
    source.previous = { ...source.current, salesRanking: [{ ...row, salesAmount: 2345.67 }] }
    source.analysis!.salesReceipts = [
      {
        ownerStaffCode: 'S',
        ownerStaffName: '销售',
        paidAmount: 4567.89,
        paymentCount: 1,
        customerCount: 1,
      },
    ]
    source.previousAnalysis = {
      ...source.analysis!,
      salesReceipts: [{ ...source.analysis!.salesReceipts[0], paidAmount: 1000 }],
    }
    expect(citySalesRows(source, false, false)[0]).toMatchObject({
      amount: 12345.67,
      previous: 2345.67,
    })
    expect(citySalesRows(source, true, false)[0]).toMatchObject({ amount: 4567.89, previous: 1000 })
    source.previousAnalysis = null
    expect(citySalesRows(source, true, false)[0].previous).toBeNull()
  })
})
