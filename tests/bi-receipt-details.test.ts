import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import BiReceiptDetails from '@/views/supply-chain/bi/components/BiReceiptDetails.vue'
import BiOverviewBoard from '@/views/supply-chain/bi/components/BiOverviewBoard.vue'
import { meetingFixture } from './fixtures/bi-meeting-data'
const { queryDetails } = vi.hoisted(() => ({ queryDetails: vi.fn() }))
vi.mock('@/api/core/bi', () => ({ getSupplyReceiptDetails: queryDetails }))
const query = { regionCode: 'HB', from: '2026-09-30T16:00:00Z', to: '2026-10-23T15:59:59.999999Z' }
beforeEach(() => {
  queryDetails.mockReset()
  queryDetails.mockResolvedValue({ total: 23, amount: 216, items: [] })
})
function open(kind: 'receipts' | 'unpaid', selected = query) {
  return mount(BiReceiptDetails, {
    props: { kind, query: selected, cityName: '河北省' },
    global: { plugins: [ElementPlus] },
  })
}
describe('城市回款分析明细', () => {
  it.each(['receipts', 'unpaid'] as const)(
    '保留 %s 的看板原始时间和城市范围，翻页继续使用同一范围',
    async (kind) => {
      const wrapper = open(kind)
      await flushPromises()
      expect(queryDetails).toHaveBeenLastCalledWith({ ...query, kind, begin: 0, step: 20 })
      expect(wrapper.text()).toContain('¥216.00')
      expect(wrapper.text()).toContain('2026-10-01 — 2026-10-23')
      await wrapper.find('.btn-next').trigger('click')
      await flushPromises()
      expect(queryDetails).toHaveBeenLastCalledWith({ ...query, kind, begin: 20, step: 20 })
      wrapper.unmount()
    },
  )
  it('缺少城市时不扩大成全部数据；接口失败显示重试', async () => {
    const wrapper = open('receipts', { ...query, regionCode: '' })
    await flushPromises()
    expect(queryDetails).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('城市或日期范围缺失')
    queryDetails.mockRejectedValueOnce(new Error('无权查看该范围'))
    await wrapper.setProps({ query })
    await flushPromises()
    expect(wrapper.text()).toContain('无权查看该范围')
    expect(wrapper.text()).not.toContain('¥216.00')
    wrapper.unmount()
  })
  it('切换查询时旧响应不能覆盖新范围', async () => {
    let resolveOld!: (value: unknown) => void
    queryDetails.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve
        }),
    )
    const wrapper = open('receipts')
    await wrapper.setProps({ query: { ...query, regionCode: 'TS' } })
    await flushPromises()
    resolveOld({ total: 9, amount: 999, items: [] })
    await flushPromises()
    expect(wrapper.text()).toContain('¥216.00')
    expect(wrapper.text()).not.toContain('¥999.00')
    wrapper.unmount()
  })
  it('卡片金额点击打开对应明细，使用当前快照日期', async () => {
    const snapshot = meetingFixture()
    snapshot.query.regionCode = 'HB'
    const wrapper = mount(BiOverviewBoard, {
      props: {
        snapshot,
        year: 2026,
        selectedMonth: 10,
        scopeLabel: '河北省',
        loading: false,
        error: '',
        cityContext: { code: 'HB', name: '河北省', options: [] },
      },
      global: { stubs: { EchartsChart: true, BiReceiptDetails: true, ElDialog: true } },
    })
    await wrapper.get('[aria-label="查看本期到账明细"]').trigger('click')
    expect(wrapper.getComponent(BiReceiptDetails).props()).toMatchObject({
      kind: 'receipts',
      query: { regionCode: 'HB', from: snapshot.current.from, to: snapshot.current.to },
    })
    wrapper.getComponent(BiReceiptDetails).vm.$emit('close')
    await wrapper.get('[aria-label="查看本期订单未回款明细"]').trigger('click')
    expect(wrapper.getComponent(BiReceiptDetails).props('kind')).toBe('unpaid')
    wrapper.unmount()
  })
})
