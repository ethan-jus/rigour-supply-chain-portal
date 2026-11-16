import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ElementPlus from 'element-plus'
import Issues from '@/components/supply/DhbShipmentSyncIssues.vue'
const mocks = vi.hoisted(() => ({
  issues: vi.fn(),
  tasks: vi.fn(),
  replay: vi.fn(),
  push: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('@/api/core/dhb-orchestration', () => ({
  getDhbOpenIssues: mocks.issues,
  getDhbSyncTasks: mocks.tasks,
  replayDhbOrderObject: mocks.replay,
}))
const row = (fields = {}) => ({
  sourceObjectType: 'SALES_SHIPMENT',
  sourceId: 'FH001',
  connectorId: 'c1',
  updatedAt: '2026-11-13T10:00:00Z',
  errorMessage: '销售单 DH001 的客户 CUS1 尚未关联',
  replaySupported: true,
  manualResolutionRequired: false,
  ...fields,
})
const setup = () =>
  mount(Issues, { props: { connectorId: 'c1' }, global: { plugins: [ElementPlus] } })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.issues.mockResolvedValue([{ items: [row()] }])
  mocks.tasks.mockResolvedValue([
    { id: 't1', connectorId: 'c1', objectType: 'ORDER', status: 'ACTIVE' },
  ])
  mocks.replay.mockResolvedValue({ status: 'SUCCEEDED' })
})
describe('发货依赖待处理闭环', () => {
  it('只显示同来源的发货问题，保留最新单号和具体缺失资料', async () => {
    mocks.issues.mockResolvedValue([
      {
        items: [
          row(),
          row({ errorMessage: '旧原因', updatedAt: '2026-11-12T10:00:00Z' }),
          row({ connectorId: 'other', sourceId: 'FH-OTHER' }),
          row({ sourceObjectType: 'SALES_ORDER', sourceId: 'DH-OTHER' }),
        ],
      },
    ])
    const w = setup()
    await flushPromises()
    expect(w.text()).toContain('DH001 的客户 CUS1')
    expect(w.text()).not.toContain('旧原因')
    expect(w.text()).not.toContain('FH-OTHER')
    expect(w.text()).not.toContain('DH-OTHER')
    w.unmount()
  })
  it('单笔重试只发该单来源标识，部分成功不报全部完成', async () => {
    mocks.replay.mockResolvedValue({ status: 'PARTIAL', errorMessage: 'DH001 的客户尚未关联' })
    const w = setup()
    await flushPromises()
    await w
      .findAll('button')
      .find((b) => b.text() === '继续关联')!
      .trigger('click')
    await flushPromises()
    expect(mocks.replay).toHaveBeenCalledWith('t1', {
      sourceObjectType: 'SALES_SHIPMENT',
      sourceId: 'FH001',
    })
    expect(w.text()).toContain('DH001 的客户尚未关联')
    expect(w.text()).not.toContain('FH001 已处理完成')
    w.unmount()
  })
  it('重复点击时仅提交一次，有多个任务时拒绝猜测选择', async () => {
    let complete!: (value: unknown) => void
    mocks.replay.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    const w = setup()
    await flushPromises()
    const button = w.findAll('button').find((b) => b.text() === '继续关联')!
    await button.trigger('click')
    await flushPromises()
    await button.trigger('click')
    await flushPromises()
    expect(mocks.replay).toHaveBeenCalledTimes(1)
    complete({ status: 'SUCCEEDED' })
    await flushPromises()
    mocks.tasks.mockResolvedValue([
      { id: 't1', connectorId: 'c1', objectType: 'ORDER', status: 'ACTIVE' },
      { id: 't2', connectorId: 'c1', objectType: 'ORDER', status: 'ACTIVE' },
    ])
    await button.trigger('click')
    await flushPromises()
    expect(mocks.replay).toHaveBeenCalledTimes(1)
    expect(w.text()).toContain('唯一可用')
    w.unmount()
  })
  it('读取失败不能显示无问题，冲突记录不提供直接重试', async () => {
    mocks.issues.mockRejectedValueOnce(new Error('network'))
    const w = setup()
    await flushPromises()
    expect(w.text()).toContain('暂时无法读取')
    mocks.issues.mockResolvedValue([{ items: [row({ manualResolutionRequired: true })] }])
    await w
      .findAll('button')
      .find((b) => b.text() === '刷新待处理项')!
      .trigger('click')
    await flushPromises()
    expect(w.findAll('button').some((b) => b.text() === '继续关联')).toBe(false)
    await w
      .findAll('button')
      .find((b) => b.text() === '核对资料')!
      .trigger('click')
    expect(mocks.push).toHaveBeenCalledWith('/supply-chain/integration')
    w.unmount()
  })
})
