import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ElementPlus from 'element-plus'
import Button from '@/components/supply/DhbPageSyncButton.vue'
const mocks = vi.hoisted(() => ({ allowed: true, tasks: vi.fn(), sync: vi.fn() }))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => mocks.allowed }),
}))
vi.mock('@/api/core/dhb-orchestration', () => ({ getDhbSyncTasks: mocks.tasks }))
vi.mock('@/api/core/dhb-page-sync', () => ({
  syncDhbPage: mocks.sync,
  latestDhbPageSyncJob: vi.fn().mockResolvedValue(null),
  getDhbPageSyncJob: vi.fn(),
  startDhbPageSyncJob: async (id: string, command: unknown) => ({
    jobId: id, connectorId: 'connector-1', scope: 'CUSTOMER', status: 'SUCCEEDED',
    stage: '结束', startedAt: new Date().toISOString(), heartbeatAt: new Date().toISOString(),
    result: await mocks.sync(command),
  }),
}))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.allowed = true
  mocks.tasks.mockResolvedValue([{ connectorId: 'connector-1' }])
})
describe('逐页手动同步', () => {
  it('回款按钮仅提交RECEIPT并保留明确窗口，不在打开页面时写入', async () => {
    mocks.sync.mockResolvedValue({
      status: 'PARTIAL',
      tenants: [
        {
          steps: [
            {
              objectType: 'RECEIPT',
              status: 'PARTIAL',
              fetched: 2,
              changed: 1,
              unmapped: 1,
              message: '一笔待核销',
            },
          ],
        },
      ],
    })
    const w = mount(Button, {
      props: { scope: 'RECEIPT', label: '回款' },
      global: { plugins: [ElementPlus] },
    })
    expect(mocks.sync).not.toHaveBeenCalled()
    await w.get('button').trigger('click')
    await flushPromises()
    const state = w.vm as unknown as { run: () => Promise<void> }
    await state.run()
    await flushPromises()
    expect(mocks.sync).toHaveBeenCalledTimes(1)
    expect(mocks.sync).toHaveBeenCalledWith({
      scope: 'RECEIPT',
      connectorId: 'connector-1',
      from: '2026-09-03T16:00:00.000Z',
      to: expect.any(String),
      maxPages: 100,
    })
    expect(w.text()).toContain('同步未全部完成')
    expect(w.emitted('completed')).toHaveLength(1)
    w.unmount()
  })
  it('客户按钮使用服务端增量游标，连续点击仍不发送人工日期窗口', async () => {
    mocks.sync.mockResolvedValue({
      status: 'SUCCEEDED',
      tenants: [{ steps: [{ objectType: 'CUSTOMER', fetched: 0, changed: 0 }] }],
    })
    const w = mount(Button, {
      props: { scope: 'CUSTOMER', label: '客户' },
      global: { plugins: [ElementPlus] },
    })
    expect(w.get('button').text()).toBe('同步')
    await w.get('button').trigger('click')
    await flushPromises()
    expect(w.findComponent({ name: 'ElDatePicker' }).exists()).toBe(false)
    const state = w.vm as unknown as { run: () => Promise<void> }
    expect(mocks.sync).toHaveBeenCalledTimes(1)
    expect(w.findComponent({ name: 'ElSelect' }).exists()).toBe(false)
    await state.run()
    expect(mocks.sync).toHaveBeenCalledTimes(2)
    expect(mocks.sync).toHaveBeenLastCalledWith({
      scope: 'CUSTOMER',
      connectorId: 'connector-1',
      incremental: true,
      maxPages: 100,
    })
    w.unmount()
  })
  it('客户同步无法唯一确定连接时不让用户填写内部编号或猜选来源', async () => {
    mocks.tasks.mockResolvedValue([{ connectorId: 'one' }, { connectorId: 'two' }])
    const w = mount(Button, {
      props: { scope: 'CUSTOMER', label: '客户' },
      global: { plugins: [ElementPlus] },
    })
    await w.get('button').trigger('click')
    await flushPromises()
    expect(mocks.sync).not.toHaveBeenCalled()
    expect(w.findComponent({ name: 'ElSelect' }).exists()).toBe(false)
    expect(w.text()).toContain('存在多个订货宝连接')
    w.unmount()
  })
  it('分别显示新增修改修复和问题数量，不把总处理量当成修改量', async () => {
    mocks.sync.mockResolvedValue({
      status: 'SUCCEEDED_WITH_WARNINGS',
      tenants: [
        {
          steps: [
            {
              objectType: 'CUSTOMER',
              status: 'SUCCEEDED_WITH_WARNINGS',
              fetched: 16,
              changed: 9,
              created: 2,
              updated: 3,
              repaired: 4,
              duplicates: 1,
              rejected: 1,
              unmapped: 5,
            },
          ],
        },
      ],
    })
    const w = mount(Button, {
      props: { scope: 'CUSTOMER', label: '客户' },
      global: { plugins: [ElementPlus] },
    })
    await w.get('button').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('新增客户 2 条，修改客户 3 条，修复记录 4 条，问题 6 项')
    expect(w.findAll('.sync-metric strong').map((x) => x.text())).toEqual(['2', '3', '4', '6'])
    expect(w.text()).toContain('无需更新')
    expect(w.text()).toContain('处理失败')
    w.unmount()
  })
  it('旧服务没有明细时显示未提供，不虚构零新增和零修改', async () => {
    mocks.sync.mockResolvedValue({
      status: 'SUCCEEDED',
      tenants: [
        {
          steps: [
            { objectType: 'CUSTOMER', status: 'SUCCEEDED', fetched: 3, changed: 3, unmapped: 0 },
          ],
        },
      ],
    })
    const w = mount(Button, {
      props: { scope: 'CUSTOMER', label: '客户' },
      global: { plugins: [ElementPlus] },
    })
    await w.get('button').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('当前服务未提供完整数量明细')
    expect(w.findAll('.sync-metric strong').map((x) => x.text())).toEqual(['—', '—', '—', '—'])
    w.unmount()
  })
  it('没有同步权限时隐藏写入口', () => {
    mocks.allowed = false
    const w = mount(Button, {
      props: { scope: 'CUSTOMER', label: '客户' },
      global: { plugins: [ElementPlus] },
    })
    expect(w.find('button').exists()).toBe(false)
    expect(mocks.sync).not.toHaveBeenCalled()
    w.unmount()
  })
  it('请求失败不发出完成事件', async () => {
    mocks.sync.mockRejectedValue(new Error('连接器忙碌'))
    const w = mount(Button, {
      props: { scope: 'SALES_ORDER', label: '订单' },
      global: { plugins: [ElementPlus] },
    })
    await w.get('button').trigger('click')
    await flushPromises()
    await (w.vm as unknown as { run: () => Promise<void> }).run()
    await flushPromises()
    expect(w.emitted('completed')).toBeUndefined()
    expect(w.text()).toContain('连接器忙碌')
    w.unmount()
  })
})
