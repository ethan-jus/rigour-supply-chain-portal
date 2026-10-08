import { defineComponent, h, nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { apiClient } from '@/api/core/client'
import { useDhbSyncJob } from '@/composables/useDhbSyncJob'
import DhbSyncJobProgress from '@/components/supply/DhbSyncJobProgress.vue'
import type { DhbPageSyncJob, PageSyncCommand } from '@/api/core/dhb-page-sync'

// 只替换 HTTP 传输，不 mock API 解包/同步 API/composable，覆盖真实 NON_NULL 响应链路。
const originalAdapter = apiClient.defaults.adapter
const wrappers: VueWrapper[] = []
const envelope = (fields: Record<string, unknown> = {}) => ({
  code: 'OK',
  message: 'success',
  requestId: 'contract-test',
  timestamp: '2026-09-22T09:20:00Z',
  ...fields,
})
const command: PageSyncCommand = {
  scope: 'CUSTOMER',
  connectorId: 'c1',
  incremental: true,
  maxPages: 100,
}
function running(id = 'j1', scope = command.scope): DhbPageSyncJob {
  return {
    jobId: id,
    connectorId: 'c1',
    scope,
    status: 'RUNNING',
    stage: '后台处理中',
    startedAt: '2026-09-22T09:20:00Z',
    heartbeatAt: '2026-09-22T09:20:00Z',
  }
}
function transport(reply: (config: InternalAxiosRequestConfig) => unknown) {
  const calls = vi.fn(async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => ({
    data: reply(config),
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  }))
  apiClient.defaults.adapter = calls
  return calls
}
function setup() {
  let state!: ReturnType<typeof useDhbSyncJob>
  const wrapper = mount(
    defineComponent({
      setup() {
        state = useDhbSyncJob(vi.fn())
        return () => h(DhbSyncJobProgress, { job: state.job.value, notice: state.notice.value })
      },
    }),
    { global: { stubs: { ElAlert: { props: ['title'], template: '<p>{{ title }}</p>' } } } },
  )
  wrappers.push(wrapper)
  return { state, wrapper }
}
beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount())
  apiClient.defaults.adapter = originalAdapter
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('后台任务真实响应契约', () => {
  it.each(['CUSTOMER', 'ORDER_SALES_PACKAGE', 'SALESPERSON'] as const)(
    '%s 在 HTTP 环境没有 randomUUID 时仍用安全随机编号提交任务',
    async (scope) => {
      const getRandomValues = vi.fn(crypto.getRandomValues.bind(crypto))
      vi.stubGlobal('crypto', { getRandomValues })
      const calls = transport((config) =>
        config.method === 'get'
          ? envelope()
          : envelope({ data: running(config.url!.split('/').at(-1), scope) }),
      )
      const { state } = setup()
      await state.start({ ...command, scope })
      expect(calls.mock.calls.map(([c]) => c.method)).toEqual(['get', 'post'])
      expect(state.error.value).toBe('')
      expect(state.job.value?.jobId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      )
      expect(state.job.value?.scope).toBe(scope)
      expect(getRandomValues).toHaveBeenCalledTimes(1)
      await state.start({ ...command, scope })
      expect(calls).toHaveBeenCalledTimes(2)
    },
  )

  it.each([
    ['CUSTOMER', {}],
    ['CUSTOMER', { data: null }],
    ['ORDER_SALES_PACKAGE', {}],
    ['ORDER_SALES_PACKAGE', { data: null }],
  ] as const)('%s 无任务响应 %j 只提交一次正确范围的新任务', async (scope, empty) => {
    const calls = transport((config) =>
      config.method === 'get'
        ? envelope(empty)
        : envelope({ data: running(config.url!.split('/').at(-1), scope) }),
    )
    const { state, wrapper } = setup()
    await state.start({ ...command, scope })
    await nextTick()
    expect(calls.mock.calls.map(([c]) => c.method)).toEqual(['get', 'post'])
    expect(JSON.parse(calls.mock.calls[1]![0].data).scope).toBe(scope)
    expect(state.job.value?.scope).toBe(scope)
    expect(state.notice.value).toBe('')
    expect(wrapper.text()).not.toMatch(/NaN|当前连接正在处理订单同步|排队中/)
    await state.start({ ...command, scope })
    expect(calls).toHaveBeenCalledTimes(2)
  })

  it('无 data 的业务错误仍拒绝，不当作业务对象返回', async () => {
    const failure = envelope({ code: 'FORBIDDEN', message: '无权限' })
    transport(() => failure)
    await expect(apiClient.get('/contract-read')).rejects.toMatchObject(failure)
  })

  it.each([
    {},
    { ...running(), jobId: '' },
    { ...running(), scope: '' },
    { ...running(), status: 'BAD' },
    { ...running(), startedAt: 'invalid' },
  ])('残缺任务 %j 不显示占用，不擅自开始同步', async (badJob) => {
    const calls = transport(() => envelope({ data: badJob }))
    const { state, wrapper } = setup()
    await state.start(command)
    await nextTick()
    expect(state.job.value).toBeNull()
    expect(state.busy.value).toBe(false)
    expect(state.error.value).toContain('任务状态响应不完整')
    expect(wrapper.text()).not.toMatch(/NaN|订单同步|排队中/)
    expect(calls).toHaveBeenCalledTimes(1)
  })

  it('提交响应残缺时保留原请求编号查询，不能重复 POST', async () => {
    const calls = transport((config) =>
      config.method === 'post'
        ? envelope({ data: {} })
        : config.url!.endsWith('/jobs')
          ? envelope()
          : envelope({ data: running(config.url!.split('/').at(-1)) }),
    )
    const { state } = setup()
    await state.start(command)
    expect(state.job.value).toBeNull()
    expect(state.notice.value).toContain('确认原任务状态')
    await vi.advanceTimersByTimeAsync(2000)
    expect(calls.mock.calls.map(([c]) => c.method)).toEqual(['get', 'post', 'get'])
    expect(calls.mock.calls[2]![0].url).toBe(calls.mock.calls[1]![0].url)
    expect(state.job.value?.status).toBe('RUNNING')
  })

  it('轮询返回残缺数据不覆盖已知任务，也不误报完成', async () => {
    const calls = transport((config) =>
      config.url!.endsWith('/jobs') ? envelope({ data: running() }) : envelope({ data: {} }),
    )
    const { state } = setup()
    await state.start(command)
    await vi.advanceTimersByTimeAsync(2000)
    expect(state.job.value?.jobId).toBe('j1')
    expect(state.notice.value).toContain('重新连接')
    expect(calls.mock.calls.every(([c]) => c.method === 'get')).toBe(true)
  })

  it('展示层对缺失时间和状态显示待核实，不出现 NaN 或假排队', () => {
    const wrapper = mount(DhbSyncJobProgress, {
      props: {
        job: { ...running(), status: undefined, startedAt: undefined } as unknown as DhbPageSyncJob,
        notice: '',
      },
      global: { stubs: { ElAlert: true } },
    })
    wrappers.push(wrapper)
    expect(wrapper.text()).not.toMatch(/NaN|排队中/)
    expect(wrapper.text()).toContain('已用时 —')
  })

  it('后台没有整页更新时计时仍每秒前进，结束后固定', async () => {
    vi.setSystemTime(new Date('2026-09-22T09:21:00Z'))
    const wrapper = mount(DhbSyncJobProgress, {
      props: { job: running(), notice: '' },
      global: { stubs: { ElAlert: true } },
    })
    wrappers.push(wrapper)
    expect(wrapper.text()).toContain('已用时 1分0秒')
    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.text()).toContain('已用时 1分2秒')
    await wrapper.setProps({
      job: { ...running(), status: 'SUCCEEDED', finishedAt: '2026-09-22T09:21:02Z' },
    })
    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.text()).toContain('已用时 1分2秒')
  })

  it('服务时间在未来时明确提示校时，不再一直显示零秒', () => {
    vi.setSystemTime(new Date('2026-09-22T01:20:00Z'))
    const wrapper = mount(DhbSyncJobProgress, {
      props: { job: running(), notice: '' },
      global: { stubs: { ElAlert: true } },
    })
    wrappers.push(wrapper)
    expect(wrapper.text()).toContain('服务时间待校准')
    expect(wrapper.text()).not.toContain('0分0秒')
  })

  it('扫描结束但有待处理项仍显示警告', () => {
    const wrapper = mount(DhbSyncJobProgress, {
      props: {
        job: {
          ...running(),
          status: 'SUCCEEDED',
          result: {
            batchId: 'b1',
            status: 'PARTIAL',
            triggerType: 'MANUAL',
            startedAt: running().startedAt,
            finishedAt: running().startedAt,
            tenants: [],
          },
        },
        notice: '',
      },
      global: { stubs: { ElAlert: { props: ['type'], template: '<p>{{ type }}</p>' } } },
    })
    wrappers.push(wrapper)
    expect(wrapper.text()).toContain('warning')
  })
})
