import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ElementPlus from 'element-plus'
import Issues from '@/components/supply/DhbShipmentSyncIssues.vue'
vi.mock('@/components/supply/DhbCustomerSourceReview.vue', () => ({
  default: { template: '<span />' },
}))
const mocks = vi.hoisted(() => ({
  issues: vi.fn(),
  tasks: vi.fn(),
  replay: vi.fn(),
  push: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
}))
vi.mock('@/api/core/dhb-orchestration', () => ({
  getDhbShipmentIssues: async (_connector: string, offset: number, limit: number) => {
    const groups = await mocks.issues()
    const rows = groups.flatMap((g: { items: unknown[] }) => g.items)
    return { total: rows.length, items: rows.slice(offset, offset + limit) }
  },
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
  it('显示具体待关联资料，内部错误和重复机制说明不出现在业务列表', async () => {
    mocks.issues.mockResolvedValue([
      {
        items: [
          row({
            requiredDataType: 'CUSTOMER',
            requiredSourceId: 'CUS1',
            relatedSalesOrderNo: 'DH001',
          }),
          row({
            sourceId: 'FH002',
            errorCode: 'DHB_SHIPMENT_BUSINESS_TIME_MISSING',
            errorMessage: '缺少发货/创建/更新时间，不能生成ERP销售出库单',
          }),
          row({
            sourceId: 'FH003',
            errorCode: 'SQL_ERROR',
            errorMessage: 'SQL Exception checkpoint Raw projection',
            handlingAdvice: '查看Raw和日志',
          }),
        ],
      },
    ])
    const w = setup()
    await flushPromises()
    expect(w.text()).toContain('客户 CUS1 待关联（销售单 DH001）')
    expect(w.text()).toContain('未取得发货时间')
    expect(w.text()).toContain('发货信息未同步完整')
    expect(w.text()).toContain('关联客户')
    expect(w.text()).not.toMatch(/checkpoint|Raw|Exception|ERP|最多\s*500|保存即代表|补取失败/)
    w.unmount()
  })
  it('同单跨处理阶段只展示销售发货问题，排除无关调拨', async () => {
    mocks.issues.mockResolvedValue([
      {
        items: [
          row({
            sourceObjectType: 'ERP_STOCK_OUT',
            errorMessage: '旧库存错误',
            updatedAt: '2026-11-14T00:00:00Z',
          }),
          row({
            requiredDataType: 'SALES_ORDER',
            requiredSourceId: 'DH-EXACT',
            relatedSalesOrderNo: 'DH-EXACT',
            errorMessage: '发货同步不会夹带创建订单',
          }),
          row({
            sourceObjectType: 'ERP_STOCK_OUT',
            sourceId: 'TRANSFER-ONLY',
            errorMessage: '调拨出库缺少仓库',
          }),
        ],
      },
    ])
    const w = setup()
    await flushPromises()
    expect(w.text()).toContain('销售单 DH-EXACT 待关联')
    expect(w.text()).not.toContain('旧库存错误')
    expect(w.text()).not.toContain('TRANSFER-ONLY')
    expect(w.text()).not.toContain('不会夹带创建订单')
    expect(w.findAll('button').filter((b) => b.text() === '重试')).toHaveLength(1)
    w.unmount()
  })
  it('待处理项分页避免一次堆满页面，单笔处理通知主列表刷新', async () => {
    mocks.issues.mockResolvedValue([
      { items: Array.from({ length: 25 }, (_, i) => row({ sourceId: `FH-${i}` })) },
    ])
    const w = setup()
    await flushPromises()
    expect(w.findAll('button').filter((b) => b.text() === '重试')).toHaveLength(20)
    await w.findComponent({ name: 'ElPagination' }).vm.$emit('update:current-page', 2)
    await w.findComponent({ name: 'ElPagination' }).vm.$emit('current-change', 2)
    await flushPromises()
    expect(w.findAll('button').filter((b) => b.text() === '重试')).toHaveLength(5)
    await w
      .findAll('button')
      .find((b) => b.text() === '重试')!
      .trigger('click')
    await flushPromises()
    expect(w.emitted('repaired')).toHaveLength(1)
    w.unmount()
  })

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
    expect(w.text()).toContain('发货信息未同步完整')
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
      .find((b) => b.text() === '重试')!
      .trigger('click')
    await flushPromises()
    expect(mocks.replay).toHaveBeenCalledWith('t1', {
      sourceObjectType: 'SALES_SHIPMENT',
      sourceId: 'FH001',
    })
    expect(w.text()).toContain('FH001 未处理完成')
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
    const button = w.findAll('button').find((b) => b.text() === '重试')!
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
    expect(w.text()).toContain('同步设置异常')
    w.unmount()
  })
  it('业务保存资料关联后自动处理原发货，无需再点重试', async () => {
    const w = setup()
    await flushPromises()
    w.findComponent({ name: 'DhbDependencyManualLink' }).vm.$emit(
      'saved',
      row({ requiredDataType: 'SALES_ORDER', requiredSourceId: 'DH001' }),
    )
    await flushPromises()
    expect(mocks.replay).toHaveBeenCalledTimes(1)
    expect(mocks.replay).toHaveBeenCalledWith('t1', {
      sourceObjectType: 'SALES_SHIPMENT',
      sourceId: 'FH001',
    })
    expect(w.text()).toContain('已处理完成')
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
    expect(w.findAll('button').some((b) => b.text() === '重试')).toBe(false)
    expect(w.text()).toContain('销售单 DH001 的客户 CUS1 尚未关联')
    expect(w.text()).not.toContain('发货资料关联冲突')
    await w
      .findAll('button')
      .find((b) => b.text() === '核对资料')!
      .trigger('click')
    expect(mocks.push).toHaveBeenCalledWith('/supply-chain/integration')
    w.unmount()
  })
})
