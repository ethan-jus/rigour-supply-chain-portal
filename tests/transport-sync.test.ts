import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { h, KeepAlive, ref } from 'vue'
import ElementPlus, { ElDatePicker } from 'element-plus'
import View from '@/views/supply-chain/cost/LogisticsTransportRecordsView.vue'

const api = vi.hoisted(() => ({ list: vi.fn(), sync: vi.fn(), runs: vi.fn() }))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ query: {} }),
}))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
}))
vi.mock('@/api/core/transport-records', () => ({
  getTransportRecords: api.list,
  getTransport: vi.fn(),
  confirmTransport: vi.fn(),
  exportSelectedTransport: vi.fn(),
}))
vi.mock('@/api/core/huolala', () => ({ huolalaApi: { sync: api.sync, runs: api.runs } }))
vi.mock('@/api/core/cost', () => ({
  getCostEmployees: vi.fn().mockResolvedValue([]),
  getCostCities: vi.fn().mockResolvedValue([]),
  changeCostStatus: vi.fn(),
}))
vi.mock('@/utils/business-dictionary', () => ({
  loadBusinessDictionaries: vi.fn().mockResolvedValue(undefined),
  businessDictionaryOptions: () => [],
  businessDictionaryLabel: (_module: string, _code: string, value: string) => value || '-',
}))

let wrapper: VueWrapper | undefined
const run = (status = 'RUNNING') => ({
  id: 'RUN-1',
  scope: 'ORDERS',
  status,
  fetched: 3,
  accepted: 3,
  unchanged: 0,
  rejected: status === 'PARTIAL' ? 1 : 0,
  startedAt: null,
  finishedAt: status === 'RUNNING' ? null : '2026-11-12T02:00:00Z',
  message: null,
})
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  vi.setSystemTime(new Date('2026-11-11T03:00:00Z'))
  vi.resetAllMocks()
  api.list.mockResolvedValue({
    page: { total: 0, begin: 0, step: 20, items: [] },
    platformRecords: {},
  })
  api.sync.mockResolvedValue(run())
  api.runs.mockResolvedValue([run()])
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.clearAllTimers()
  vi.useRealTimers()
  document.body.innerHTML = ''
})
async function render() {
  wrapper = mount(View, { attachTo: document.body, global: { plugins: [ElementPlus] } })
  await flushPromises()
}
async function click(label: string) {
  const button = wrapper!.findAll('button').find((item) => item.text() === label)
  expect(button, label).toBeTruthy()
  await button!.trigger('click')
  await flushPromises()
}
async function begin() {
  await click('同步货拉拉订单')
  await click('开始同步')
}

describe('运输列表同步完成后刷新', () => {
  it('提交并非完成；轮询到终态后重新读取列表，避免提前刷新后停留在旧结果', async () => {
    await render()
    await begin()
    expect(api.list).toHaveBeenCalledTimes(1)
    expect(document.body.textContent).toContain('同步中')
    await vi.advanceTimersByTimeAsync(5000)
    expect(api.runs).toHaveBeenCalledTimes(1)
    expect(api.list).toHaveBeenCalledTimes(1)
    api.runs.mockResolvedValue([run('SUCCEEDED')])
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    expect(api.list).toHaveBeenCalledTimes(2)
    expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ begin: 0 }))
    expect(document.body.textContent).toContain('同步完成，已读取3张货拉拉订单')
    await vi.advanceTimersByTimeAsync(10000)
    expect(api.runs).toHaveBeenCalledTimes(2)
  })

  it('读取进度失败后重试；部分成功刷新已有数据且不显示全部成功', async () => {
    await render()
    await begin()
    api.runs.mockRejectedValueOnce(new Error('temporary')).mockResolvedValue([run('PARTIAL')])
    await vi.advanceTimersByTimeAsync(5000)
    expect(api.list).toHaveBeenCalledTimes(1)
    expect(document.body.textContent).toContain('正在重试')
    await vi.advanceTimersByTimeAsync(5000)
    await flushPromises()
    expect(api.list).toHaveBeenCalledTimes(2)
    expect(document.body.textContent).toContain('同步未全部完成')
    expect(document.body.textContent).not.toContain('同步完成，已读取')
  })

  it('跨日再次打开同步默认取当天，不沿用缓存页面昨天的日期', async () => {
    await render()
    await click('同步货拉拉订单')
    await click('关闭')
    vi.setSystemTime(new Date('2026-11-12T03:00:00Z'))
    await click('同步货拉拉订单')
    expect(wrapper!.findAllComponents(ElDatePicker).at(-1)!.props('modelValue')).toEqual([
      '2026-11-12',
      '2026-11-12',
    ])
    await click('开始同步')
    expect(api.sync).toHaveBeenCalledWith('ORDERS', '2026-11-12', '2026-11-12', undefined)
  })

  it('缓存页离开后停止轮询，返回时刷新列表并继续跟踪原任务', async () => {
    const active = ref(true)
    wrapper = mount(
      { render: () => h(KeepAlive, null, { default: () => (active.value ? h(View) : h('div')) }) },
      { attachTo: document.body, global: { plugins: [ElementPlus] } },
    )
    await flushPromises()
    await begin()
    active.value = false
    await flushPromises()
    await vi.advanceTimersByTimeAsync(10000)
    expect(api.runs).not.toHaveBeenCalled()
    api.runs.mockResolvedValue([run('SUCCEEDED')])
    active.value = true
    await flushPromises()
    expect(api.runs).toHaveBeenCalledTimes(1)
    expect(api.list.mock.calls.length).toBeGreaterThan(1)
    expect(document.body.textContent).toContain('同步完成，已读取3张货拉拉订单')
  })

  it('页面销毁后不再轮询或刷新', async () => {
    await render()
    await begin()
    wrapper!.unmount()
    wrapper = undefined
    await vi.advanceTimersByTimeAsync(10000)
    expect(api.runs).not.toHaveBeenCalled()
    expect(api.list).toHaveBeenCalledTimes(1)
  })
})
