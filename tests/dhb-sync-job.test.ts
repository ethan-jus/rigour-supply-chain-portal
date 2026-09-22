import { defineComponent, h } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDhbSyncJob } from '@/composables/useDhbSyncJob'
const api = vi.hoisted(() => ({ start: vi.fn(), get: vi.fn(), latest: vi.fn() }))
vi.mock('@/api/core/dhb-page-sync', () => ({
  startDhbPageSyncJob: api.start, getDhbPageSyncJob: api.get, latestDhbPageSyncJob: api.latest,
}))
const command = { connectorId: 'c1', scope: 'ORDER_SALES_PACKAGE' as const, incremental: true, maxPages: 500 }
const running = { jobId: 'j1', connectorId: 'c1', scope: command.scope, status: 'RUNNING', stage: '正在同步订单', startedAt: '2026-09-22T00:00:00Z', heartbeatAt: '2026-09-22T00:00:00Z' }
function setup() {
  const completed = vi.fn()
  let state!: ReturnType<typeof useDhbSyncJob>
  const wrapper = mount(defineComponent({ setup() { state = useDhbSyncJob(completed); return () => h('div') } }))
  return { state, wrapper, completed }
}
beforeEach(() => { vi.useFakeTimers(); vi.resetAllMocks(); api.latest.mockResolvedValue(null); api.start.mockResolvedValue(running) })
afterEach(() => { vi.useRealTimers() })

describe('后台同步状态恢复', () => {
  it('提交立即返回并查询状态，长任务不占一个 HTTP 请求', async () => {
    const { state, wrapper, completed } = setup()
    await state.start(command)
    expect(state.busy.value).toBe(true)
    expect(completed).not.toHaveBeenCalled()
    api.get.mockResolvedValue({ ...running, status: 'SUCCEEDED', result: { status: 'SUCCEEDED', tenants: [] } })
    await vi.advanceTimersByTimeAsync(2000)
    expect(state.busy.value).toBe(false)
    expect(completed).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
  it('轮询超时只提示重连，不显示任务失败，不重新 POST', async () => {
    const { state, wrapper } = setup()
    await state.start(command)
    api.get.mockRejectedValue({ code: 'NETWORK_ERROR' })
    await vi.advanceTimersByTimeAsync(6000)
    expect(state.error.value).toBe('')
    expect(state.notice.value).toContain('重新连接')
    expect(state.job.value?.status).toBe('RUNNING')
    await state.start(command)
    expect(api.start).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
  it('POST 回执丢失后使用原编号查询，不自动重复提交', async () => {
    api.start.mockRejectedValue({ code: 'NETWORK_ERROR' })
    api.get.mockResolvedValue(running)
    const { state, wrapper } = setup()
    await state.start(command)
    const id = api.start.mock.calls[0]![0]
    expect(state.notice.value).toContain('确认原任务状态')
    await vi.advanceTimersByTimeAsync(2000)
    expect(api.get).toHaveBeenCalledWith(id)
    expect(api.start).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
  it('刷新或另一窗口打开时接续已有任务，不提交新任务', async () => {
    api.latest.mockResolvedValue(running)
    const { state, wrapper } = setup()
    await state.start(command)
    expect(api.start).not.toHaveBeenCalled()
    expect(state.job.value?.jobId).toBe('j1')
    wrapper.unmount()
  })
  it('服务重启的未知状态不解释成失败或允许重复启动', async () => {
    api.latest.mockResolvedValue({ ...running, status: 'UNKNOWN' })
    const { state, wrapper } = setup()
    await state.start(command)
    await state.start(command)
    expect(api.start).not.toHaveBeenCalled()
    expect(state.busy.value).toBe(true)
    expect(state.error.value).toBe('')
    wrapper.unmount()
  })
  it('明确的校验失败保留错误，不进入无效任务轮询', async () => {
    api.start.mockRejectedValue({ code: 'BAD_REQUEST', message: '连接器未配置' })
    const { state, wrapper } = setup()
    await state.start(command)
    expect(state.error.value).toBe('连接器未配置')
    expect(state.busy.value).toBe(false)
    await vi.advanceTimersByTimeAsync(4000)
    expect(api.get).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('关闭页面停止轮询，不发取消请求，也不响应迟到的结果', async () => {
    let resolve!: (v: unknown) => void
    api.get.mockReturnValue(new Promise(r => { resolve = r }))
    const { state, wrapper, completed } = setup()
    await state.start(command)
    await vi.advanceTimersByTimeAsync(2000)
    wrapper.unmount()
    resolve({ ...running, status: 'SUCCEEDED', result: { status: 'SUCCEEDED' } })
    await flushPromises()
    await vi.advanceTimersByTimeAsync(6000)
    expect(completed).not.toHaveBeenCalled()
    expect(api.get).toHaveBeenCalledTimes(1)
  })
})
