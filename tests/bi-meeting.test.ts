import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import {
  meetingPeriods,
  meetingTarget,
  meetingMetric,
  rate,
  changeLabel,
  cityRows,
  meetingLine,
} from '@/views/supply-chain/bi/meeting-model'
import BiMeetingBoard from '@/views/supply-chain/bi/components/BiMeetingBoard.vue'
import { meetingFixture } from './fixtures/bi-meeting-data'

describe('会议大屏经营口径', () => {
  it('本月只取上海时间已结束业务日，比较上月相同日数', () => {
    expect(meetingPeriods('2026-09', new Date('2026-09-21T16:01:00Z'))).toEqual({
      current: { from: '2026-09-01T00:00:00+08:00', to: '2026-09-21T23:59:59.999999+08:00' },
      previous: { from: '2026-08-01T00:00:00+08:00', to: '2026-08-21T23:59:59.999999+08:00' },
    })
  })
  it('完整月份比较完整上月，处理闰年、跨年和月初', () => {
    expect(meetingPeriods('2024-03', new Date('2024-04-02T00:00:00Z')).previous.to).toContain(
      '2024-02-29',
    )
    expect(meetingPeriods('2026-01', new Date('2026-01-22T00:00:00Z')).previous.from).toContain(
      '2025-12-01',
    )
    expect(() => meetingPeriods('2026-09', new Date('2026-09-01T00:00:00Z'))).toThrow(
      '尚无完整业务日',
    )
    expect(() => meetingPeriods('2026-10', new Date('2026-09-22T00:00:00Z'))).toThrow('未来月份')
  })
  it('缺失不是零，零基期不生成无限增长率', () => {
    expect(meetingMetric(null, 'receipt_amount')).toBeNull()
    expect(rate(50, 0)).toBeNull()
    expect(changeLabel(100, 0)).toBe('前期为零')
    expect(changeLabel(0, 0)).toBe('与前期持平')
    expect(changeLabel(100, null)).toBe('比较数据未就绪')
    const { current } = meetingFixture()
    current.freshness[0].status = 'NO_DATA'
    expect(meetingMetric(current, 'sales_amount')).toBeNull()
  })
  it('城市与销售目标不重复汇总，回款实际不取期间到账', () => {
    const { current } = meetingFixture()
    current.salesTargetCompletions = [
      {
        ...current.cityTargetCompletions[0],
        dimensionType: 'SALES',
        actualValue: 1,
        targetValue: 2,
      },
    ]
    expect(meetingTarget(current, 'SALES_AMOUNT').target).toBeCloseTo(1800000)
    expect(meetingTarget(current, 'PAID_AMOUNT').actual).toBeCloseTo(1028000)
    expect(meetingMetric(current, 'receipt_amount')).toBe(1062000)
    expect(meetingTarget(current, 'SALES_AMOUNT', 'S1').target).toBe(2)
  })
  it('缺目标不推算，部分覆盖标识且超过目标保留真实完成率', () => {
    const { current } = meetingFixture()
    current.cityTargetCompletions = []
    expect(meetingTarget(current, 'SALES_AMOUNT').rate).toBeNull()
    current.cityTargetCompletions = [
      {
        dimensionType: 'CITY',
        dimensionCode: 'A',
        dimensionName: 'A',
        metricCode: 'SALES_AMOUNT',
        metricName: '',
        targetValue: 100,
        actualValue: 120,
        achievementRate: 0,
        configuredMonthCount: 1,
        periodMonthCount: 2,
      },
    ]
    expect(meetingTarget(current, 'SALES_AMOUNT')).toMatchObject({ rate: 120, incomplete: true })
  })
  it('保留本期没有订单的前期城市，未取得前期时不补零', () => {
    const { current, previous } = meetingFixture()
    current.citySalesRanking = []
    expect(cityRows(current, previous)[0].amount).toBe(0)
    expect(cityRows(previous!, null)[0].previous).toBeNull()
  })
  it('不存在期间到账指标时，不用订单累计回款绘制到账趋势', () => {
    const { current } = meetingFixture()
    current.metrics = current.metrics.filter((row) => row.metricCode !== 'receipt_amount')
    const option = meetingLine(current, null, true) as { series: { data: unknown[] }[] }
    expect(option.series[0].data.every((value) => value === null)).toBe(true)
  })
})

describe('会议分页和核对交互', () => {
  it('提供五页，导航、键盘、目标明细和退出都可用', async () => {
    HTMLElement.prototype.scrollTo = vi.fn()
    const wrapper = mount(BiMeetingBoard, {
      props: {
        snapshot: meetingFixture(),
        month: '2026-09',
        maxMonth: '2026-09',
        scopeLabel: '全国',
        demo: true,
      },
      global: { stubs: { EchartsChart: true } },
    })
    expect(wrapper.findAll('.meeting-page')).toHaveLength(5)
    expect(wrapper.text()).toContain('供应链数字化平台')
    expect(wrapper.text()).not.toContain('瑞盖优选')
    await wrapper.get('[aria-label="第2页 目标达成"]').trigger('click')
    expect(wrapper.get('[aria-label="第2页 目标达成"]').attributes('aria-current')).toBe('page')
    expect(wrapper.findAll('.target-number')[1].text()).toBe('70.8%')
    await wrapper.findAll('.target-panel .meeting-link')[1].trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="dialog"]').text()).toContain('本期到账目标明细')
    await wrapper.get('[aria-label="关闭核对明细"]').trigger('click')
    await wrapper.trigger('keydown', { key: 'End' })
    expect(wrapper.get('[aria-label="第5页 回款风险"]').attributes('aria-current')).toBe('page')
    await wrapper.get('[aria-label="退出会议大屏"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })
})

describe('页面内看板与页签缓存', () => {
  it('切走再返回恢复当前屏，且没有关闭或旧看板入口', async () => {
    const { defineComponent, ref } = await import('vue')
    const active = ref(true)
    const Host = defineComponent({
      components: { BiMeetingBoard },
      setup: () => ({ active, snapshot: meetingFixture() }),
      template: `<KeepAlive><BiMeetingBoard v-if="active" embedded :snapshot="snapshot" month="2026-09" max-month="2026-09" scope-label="测试" /></KeepAlive>`,
    })
    const wrapper = mount(Host, { global: { stubs: { EchartsChart: true } } })
    await flushPromises()
    const board = wrapper.getComponent(BiMeetingBoard)
    const scroll = vi.fn()
    const stage = board.get('.meeting-stage').element as HTMLElement
    stage.scrollTo = scroll
    board.findAll('.meeting-page').forEach((page, index) => {
      Object.defineProperty(page.element, 'offsetTop', { value: index * 600, configurable: true })
    })
    await board.findAll('.meeting-navigation nav button')[1].trigger('click')
    expect(scroll).toHaveBeenLastCalledWith(expect.objectContaining({ top: 600 }))
    active.value = false
    await flushPromises()
    scroll.mockClear()
    active.value = true
    await flushPromises()
    expect(scroll).toHaveBeenLastCalledWith({ top: 600, behavior: 'instant' })
    expect(board.classes()).toContain('is-embedded')
    expect(board.find('[aria-label="退出会议大屏"]').exists()).toBe(false)
    expect(board.text()).not.toContain('核对业务明细')
    wrapper.unmount()
  })
})
