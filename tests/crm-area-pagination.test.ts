import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/core/client'
import { getAllCrmCustomerAreas } from '@/api/core/crm'

vi.mock('@/api/core/client', () => ({ apiClient: { get: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())

describe('complete CRM area loading', () => {
  it('respects the 200-row API limit and fetches remaining areas', async () => {
    const first = Array.from({ length: 200 }, (_, id) => ({ id: String(id) }))
    vi.mocked(apiClient.get).mockResolvedValueOnce({ begin: 0, step: 200, total: 201, items: first })
      .mockResolvedValueOnce({ begin: 200, step: 200, total: 201, items: [{ id: '200' }] })
    expect(await getAllCrmCustomerAreas()).toHaveLength(201)
    expect(apiClient.get).toHaveBeenNthCalledWith(2, '/crm/customer-areas', expect.objectContaining({ params: { begin: 200, step: 200 } }))
  })
  it('handles a genuinely empty result without retrying', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ begin: 0, step: 200, total: 0, items: [] })
    expect(await getAllCrmCustomerAreas()).toEqual([])
    expect(apiClient.get).toHaveBeenCalledTimes(1)
  })
  it('rejects truncated pages instead of presenting incomplete areas as complete', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ begin: 0, step: 200, total: 2, items: [] })
    await expect(getAllCrmCustomerAreas()).rejects.toThrow('归属地区返回不完整')
  })
})
