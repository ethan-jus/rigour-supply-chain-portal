import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  apiClient,
  createDhbManualResolution,
  getDhbOpenIssues,
  getDhbSyncTasks,
  queryDhbWarehousingReceipts,
  replayDhbOrderObject,
  syncDhbOrchestration,
} from '@/api'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('订货宝统一同步编排接口', () => {
  it('手动同步只调用 Integration 统一编排入口', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
      batchId: 'batch-1',
      status: 'SUCCEEDED',
      triggerType: 'MANUAL',
      startedAt: '2026-08-25T08:00:00Z',
      finishedAt: '2026-08-25T08:00:01Z',
      tenants: [],
    })

    await syncDhbOrchestration({ maxPages: 100 })

    expect(post).toHaveBeenCalledWith(
      '/integration/dhb/orchestration/sync',
      { maxPages: 100 },
      { timeout: 900000, stayOnUnauthorized: true },
    )
  })

  it('支持传递分段同步开关', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
      batchId: 'batch-2',
      status: 'SUCCEEDED',
      triggerType: 'MANUAL',
      startedAt: '2026-08-25T08:00:00Z',
      finishedAt: '2026-08-25T08:00:01Z',
      tenants: [],
    })

    await syncDhbOrchestration({
      maxPages: 1,
      includeDictionary: true,
      includeIam: true,
      includeErp: false,
      includeCrm: false,
      includeOrder: false,
    })

    expect(post).toHaveBeenCalledWith(
      '/integration/dhb/orchestration/sync',
      {
        maxPages: 1,
        includeDictionary: true,
        includeIam: true,
        includeErp: false,
        includeCrm: false,
        includeOrder: false,
      },
      { timeout: 900000, stayOnUnauthorized: true },
    )
  })

  it('查询待处理闭环问题只走同步中心分类入口', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue([])

    await getDhbOpenIssues(200)

    expect(get).toHaveBeenCalledWith('/integration/dhb/sync-center/open-issues', {
      params: { limit: 200 },
      stayOnUnauthorized: true,
    })
  })

  it('加载同步任务用于单对象重放任务匹配', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue([])

    await getDhbSyncTasks()

    expect(get).toHaveBeenCalledWith('/integration/dhb/sync-tasks', {
      stayOnUnauthorized: true,
    })
  })

  it('人工裁决保存到同步中心手工裁决接口', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})

    await createDhbManualResolution({
      connectorId: 'connector-1',
      resolutionType: 'TRANSFER_INBOUND_RECEIPT',
      sourceObjectType: 'ERP_STOCK_OUT',
      sourceId: 'FH.20260821.0144',
      selectedSourceObjectType: 'WAREHOUSING_RECEIPT',
      selectedSourceId: 'RK.20260821.0049',
    })

    expect(post).toHaveBeenCalledWith(
      '/integration/dhb/sync-center/manual-resolutions',
      {
        connectorId: 'connector-1',
        resolutionType: 'TRANSFER_INBOUND_RECEIPT',
        sourceObjectType: 'ERP_STOCK_OUT',
        sourceId: 'FH.20260821.0144',
        selectedSourceObjectType: 'WAREHOUSING_RECEIPT',
        selectedSourceId: 'RK.20260821.0049',
      },
      { stayOnUnauthorized: true },
    )
  })

  it('单对象重放调用订单同步任务 run 接口并传来源对象', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({})

    await replayDhbOrderObject('task-1', {
      sourceObjectType: 'ERP_STOCK_OUT',
      sourceId: 'FH.20260821.0144',
    })

    expect(post).toHaveBeenCalledWith(
      '/integration/dhb/orders/sync-tasks/task-1/run',
      {
        sourceObjectType: 'ERP_STOCK_OUT',
        sourceId: 'FH.20260821.0144',
      },
      { timeout: 240000, stayOnUnauthorized: true },
    )
  })

  it('候选入库单详情通过供应链入库单查询接口读取', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ total: 0, items: [] })

    await queryDhbWarehousingReceipts('connector-1', 0, 200)

    expect(post).toHaveBeenCalledWith(
      '/integration/dhb/supply-chain/connector-1/warehousing-receipts/query',
      { begin: 0, step: 200 },
      { timeout: 240000, stayOnUnauthorized: true },
    )
  })
})
