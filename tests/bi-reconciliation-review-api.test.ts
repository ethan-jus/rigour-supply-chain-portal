import { describe, expect, it, vi } from 'vitest'
const { get, post } = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue({}),
  post: vi.fn().mockResolvedValue({}),
}))
vi.mock('@/api/core/client', () => ({ apiClient: { get, post } }))
import {
  captureReconciliationReview,
  getReconciliationReview,
  getOnlineReconciliationSources,
  captureOnlineReconciliationSource,
} from '@/api/core/bi-reconciliation-review'
describe('BI reconciliation review API', () => {
  it('uses the Integration source binding and never posts app tokens or import commands', async () => {
    await getOnlineReconciliationSources()
    expect(get).toHaveBeenCalledWith(
      '/integration/feishu/reconciliation-sources',
      expect.objectContaining({ stayOnUnauthorized: true }),
    )
    await captureOnlineReconciliationSource('configured-source')
    expect(post).toHaveBeenCalledWith(
      '/integration/feishu/reconciliation-captures',
      { sourceId: 'configured-source' },
      expect.objectContaining({ timeout: 180000, stayOnUnauthorized: true }),
    )
  })
  it('sends the source identity and scope rather than client-computed financial totals', async () => {
    const command = {
      batchId: 'batch',
      previousBatchId: 'older',
      from: '2026-09-01T00:00:00Z',
      to: '2026-09-12T00:00:00Z',
      sourceDeclaredComplete: false,
    }
    await captureReconciliationReview(command)
    expect(post).toHaveBeenCalledWith(
      '/analytics/reconciliation-reviews',
      command,
      expect.objectContaining({ stayOnUnauthorized: true }),
    )
  })
  it('uses local immutable review paging and preserves errors', async () => {
    const query = { kind: 'SKU' as const, page: 2, pageSize: 50, city: '北京', status: 'DIFF' }
    await getReconciliationReview('review', query)
    expect(get).toHaveBeenCalledWith('/analytics/reconciliation-reviews/review', {
      params: query,
      stayOnUnauthorized: true,
    })
    get.mockRejectedValueOnce(new Error('403'))
    await expect(getReconciliationReview('review', query)).rejects.toThrow('403')
  })
})
