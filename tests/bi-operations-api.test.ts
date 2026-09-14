import { describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/core/client'
import { deleteBiTarget, getBiTargets, getBiActions, updateBiAction, getBiActionEvents } from '@/api/core/bi-operations'
vi.mock('@/api/core/client', () => ({ apiClient: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() } }))
describe('BI operations API', () => {
  it('sends target month/dimension and optimistic revision without tenant override', () => {
    getBiTargets({ month: '2026-09', dimensionType: 'CITY', dimensionCode: 'BJ' })
    expect(apiClient.get).toHaveBeenCalledWith('/analytics/supply/dashboard/targets', {
      stayOnUnauthorized: true, params: { month: '2026-09', dimensionType: 'CITY', dimensionCode: 'BJ' },
    })
    deleteBiTarget('9', 3)
    expect(apiClient.delete).toHaveBeenCalledWith('/analytics/supply/dashboard/targets/9', {
      stayOnUnauthorized: true, params: { revision: 3 },
    })
  })
  it('uses distinct real followup endpoints and escapes business path segments', () => {
    getBiActions({ cityCode: 'BJ', status: 'OPEN', page: 2 })
    getBiActionEvents('a/b')
    expect(apiClient.get).toHaveBeenCalledWith('/analytics/supply/dashboard/actions/a%2Fb/events', { stayOnUnauthorized: true })
    const command = { assignee: 'E1', dueAt: '2026-09-15T10:00:00Z', status: 'IN_PROGRESS' as const, note: '确认下次联系', expectedRevision: 2 }
    updateBiAction('a/b', command)
    expect(apiClient.put).toHaveBeenCalledWith('/analytics/supply/dashboard/actions/a%2Fb', command, { stayOnUnauthorized: true })
  })
})
