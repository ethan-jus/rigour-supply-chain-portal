import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ElementPlus from 'element-plus'
import OrderPackageSyncButton from '@/components/supply/OrderPackageSyncButton.vue'

const mocks = vi.hoisted(() => ({
  allowed: true,
  tasks: vi.fn(),
  sync: vi.fn(),
}))

vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => mocks.allowed }),
}))
vi.mock('@/api/core/dhb-orchestration', () => ({ getDhbSyncTasks: mocks.tasks }))
vi.mock('@/api/core/dhb-page-sync', () => ({
  latestDhbPageSyncJob: vi.fn().mockResolvedValue(null),
  getDhbPageSyncJob: vi.fn(),
  startDhbPageSyncJob: async (id: string, command: unknown) => ({
    jobId: id, connectorId: 'connector-1', scope: 'ORDER_SALES_PACKAGE', status: 'SUCCEEDED',
    stage: '结束', startedAt: new Date().toISOString(), heartbeatAt: new Date().toISOString(),
    result: await mocks.sync(command),
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.allowed = true
  mocks.tasks.mockResolvedValue([{ connectorId: 'connector-1' }])
})

describe('订单包同步按钮', () => {
  it('一个按钮按依赖顺序提交 ORDER_SALES_PACKAGE 增量同步，不填人工时间窗口', async () => {
    mocks.sync.mockResolvedValue({
      status: 'SUCCEEDED',
      tenants: [
        {
          steps: [
            { objectType: 'SALES_ORDER', status: 'SUCCEEDED', fetched: 3, created: 2, updated: 1, repaired: 0, rejected: 0, unmapped: 1 },
            { objectType: 'RECEIPT', status: 'SUCCEEDED', fetched: 2, created: 1, updated: 1, repaired: 0, rejected: 0, unmapped: 0 },
            { objectType: 'PAYMENT', status: 'SUCCEEDED', fetched: 1, created: 0, updated: 0, repaired: 0, rejected: 0, unmapped: 0 },
          ],
        },
      ],
    })
    const wrapper = mount(OrderPackageSyncButton, {
      global: { plugins: [ElementPlus] },
    })
    expect(wrapper.get('button').text()).toBe('同步订单')
    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(mocks.sync).toHaveBeenCalledTimes(1)
    expect(mocks.sync).toHaveBeenCalledWith({
      scope: 'ORDER_SALES_PACKAGE',
      connectorId: 'connector-1',
      incremental: true,
      maxPages: 500,
    })
    expect(wrapper.text()).toContain('同步完成：新增 3 条，修改 2 条，修复 0 条，问题 1 项')
    expect(wrapper.text()).toContain('订单')
    expect(wrapper.text()).toContain('收款')
    expect(wrapper.text()).toContain('付款')
    expect(wrapper.emitted('completed')).toHaveLength(1)
    wrapper.unmount()
  })

  it('缺少明细数量时不虚构零新增零修改', async () => {
    mocks.sync.mockResolvedValue({
      status: 'SUCCEEDED',
      tenants: [
        {
          steps: [
            { objectType: 'SALES_ORDER', status: 'SUCCEEDED', fetched: 1, changed: 1, unmapped: 0 },
            { objectType: 'RECEIPT', status: 'SUCCEEDED', fetched: 0, changed: 0, unmapped: 0 },
          ],
        },
      ],
    })
    const wrapper = mount(OrderPackageSyncButton, { global: { plugins: [ElementPlus] } })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('当前服务未提供完整数量明细')
    expect(wrapper.findAll('.package-sync-metric strong').map((node) => node.text())).toEqual([
      '—',
      '—',
      '—',
      '—',
    ])
    wrapper.unmount()
  })

  it('无法唯一确定连接时不发送请求，并保留可重试入口', async () => {
    mocks.tasks.mockResolvedValue([{ connectorId: 'one' }, { connectorId: 'two' }])
    const wrapper = mount(OrderPackageSyncButton, { global: { plugins: [ElementPlus] } })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(mocks.sync).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('存在多个订货宝连接')
    wrapper.unmount()
  })

  it('失败不发出完成事件，不吞错误信息', async () => {
    mocks.sync.mockRejectedValue({ code: 'SYNC_ALREADY_RUNNING', message: '连接器忙碌' })
    const wrapper = mount(OrderPackageSyncButton, { global: { plugins: [ElementPlus] } })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('completed')).toBeUndefined()
    expect(wrapper.text()).toContain('连接器忙碌')
    wrapper.unmount()
  })

  it('没有同步权限时隐藏写入口', async () => {
    mocks.allowed = false
    const wrapper = mount(OrderPackageSyncButton, { global: { plugins: [ElementPlus] } })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(mocks.sync).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
