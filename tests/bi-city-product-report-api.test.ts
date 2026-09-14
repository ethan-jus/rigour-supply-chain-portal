import { describe, expect, it, vi } from 'vitest'
const { get } = vi.hoisted(() => ({ get: vi.fn().mockResolvedValue({ rows: [] }) }))
vi.mock('@/api/core/client', () => ({ apiClient: { get } }))
import { getCityProductReport, getCityProductSupply } from '@/api/core/bi-city-product-report'

describe('city product report API contract', () => {
  it('forwards every supported filter and defaults to exact attribution', async () => {
    const query = {
      from: '2026-09-01T00:00:00Z',
      to: '2026-09-12T23:59:59Z',
      regionCode: 'WH',
      ownerStaffCode: 'E001',
      customerTypeCode: 'STORE',
      sourceSystemCode: 'DHB',
      productCategoryId: '123',
      brandId: '456',
      productId: '789',
      skuId: '790',
    }
    await getCityProductReport(query)
    expect(get).toHaveBeenLastCalledWith('/analytics/supply/dashboard/city-product-report', {
      params: { ...query, allocationMode: 'EXACT_ONLY' },
      stayOnUnauthorized: true,
    })
    expect(query).not.toHaveProperty('allocationMode')
    await getCityProductReport({ ...query, allocationMode: 'PROPORTIONAL' })
    expect(get.mock.lastCall?.[1].params.allocationMode).toBe('PROPORTIONAL')
  })
  it('does not turn API errors into empty or zero-valued reports', async () => {
    get.mockRejectedValueOnce(new Error('报表服务不可用'))
    await expect(getCityProductReport({})).rejects.toThrow('报表服务不可用')
  })
  it('queries stock only with an explicit warehouse and never forwards a sales city as a warehouse', async () => {
    const query = {
      from: '2026-09-01T00:00:00Z',
      to: '2026-09-12T23:59:59Z',
      productId: '789',
      skuId: '790',
      warehouseId: '800',
    }
    await getCityProductSupply(query)
    expect(get).toHaveBeenLastCalledWith('/analytics/supply/dashboard/city-product-report/supply', {
      params: query,
      stayOnUnauthorized: true,
    })
    expect(get.mock.lastCall?.[1].params).not.toHaveProperty('regionCode')
    get.mockRejectedValueOnce(new Error('库存快照不可用'))
    await expect(getCityProductSupply(query)).rejects.toThrow('库存快照不可用')
  })
})
