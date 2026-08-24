import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient, syncDhbOrchestration } from '@/api'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('订货宝统一同步编排接口', () => {
  it('手动同步只调用 Integration 统一编排入口', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
      batchId: 'batch-1',
      status: 'SUCCEEDED',
      elapsedSeconds: 1.2,
      tenants: [],
    })

    await syncDhbOrchestration({ maxPages: 100 })

    expect(post).toHaveBeenCalledWith(
      '/integration/dhb/orchestration/sync',
      { maxPages: 100 },
      { timeout: 900000, stayOnUnauthorized: true },
    )
  })
})
