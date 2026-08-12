import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient, syncErpData } from '@/api'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ERP统一同步接口', () => {
  it('商品和供应链对象共用 /erp/sync', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
      runId: 'run-1',
      objectType: 'BRAND',
      status: 'SUCCEEDED',
      connectorId: 'connector-1',
      fetched: 1,
      created: 1,
      changed: 0,
      duplicates: 0,
      rejected: 0,
      pages: 1,
      completedAt: '2026-08-10T12:00:00Z',
    })

    await syncErpData('BRAND', 3)
    await syncErpData('INVENTORY', 5)

    expect(post).toHaveBeenNthCalledWith(1, '/erp/sync',
      { objectType: 'BRAND', maxPages: 3 },
      { timeout: 300000, stayOnUnauthorized: true })
    expect(post).toHaveBeenNthCalledWith(2, '/erp/sync',
      { objectType: 'INVENTORY', maxPages: 5 },
      { timeout: 300000, stayOnUnauthorized: true })
  })
})
