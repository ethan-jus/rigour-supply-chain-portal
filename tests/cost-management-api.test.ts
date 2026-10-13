import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/core/client'
import {
  changeCostStatus,
  getCosts,
  saveCost,
  type CostCommand,
  type CostRecord,
} from '@/api/core/cost'
vi.mock('@/api/core/client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())
const command: CostCommand = {
  requestId: 'request',
  revision: 2,
  title: '费用',
  typeCode: 'DELIVERY',
  cityCode: 'CITY',
  cityName: '城市',
  departmentId: 1,
  ownerEmployeeCode: 'E1',
  costDate: '2026-09-01',
  amount: null,
  paymentStatusCode: 'UNPAID',
  logistics: {
    legCode: 'DELIVERY',
    sourceIds: ['11'],
    voucherIds: [],
    carrierName: '',
    trackingNo: '',
    transportMethodCode: 'EXPRESS',
    payerCode: 'COMPANY',
  },
  rental: null,
  remark: '',
  reason: '',
}
describe('cost service contracts', () => {
  it('sends logistics to Order and preserves unknown cost instead of converting it to zero', async () => {
    await saveCost('logistics', null, command)
    expect(apiClient.post).toHaveBeenCalledWith(
      '/orders/logistics-costs',
      expect.objectContaining({ amount: null, logistics: command.logistics }),
      expect.anything(),
    )
    expect(vi.mocked(apiClient.post).mock.calls[0][1]).not.toHaveProperty('rental')
  })
  it('sends marketing to ERP without a logistics payload', async () => {
    await saveCost('marketing', 'cost/1', { ...command, logistics: null, amount: 0 })
    expect(apiClient.put).toHaveBeenCalledWith(
      '/erp/costs/marketing/cost%2F1',
      expect.objectContaining({ amount: 0, revision: 2 }),
      expect.anything(),
    )
    expect(vi.mocked(apiClient.put).mock.calls[0][1]).not.toHaveProperty('logistics')
  })
  it('maps the reimbursement employee filter to the HR contract', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ begin: 0, step: 20, total: 0, items: [] })
    await getCosts('expenses', { begin: 0, step: 20, ownerEmployeeCode: 'E1' })
    expect(apiClient.get).toHaveBeenCalledWith(
      '/hr/expenses',
      expect.objectContaining({ params: expect.objectContaining({ employeeCode: 'E1' }) }),
    )
  })
  it('sends the visible revision when confirming, so stale pages cannot silently overwrite', async () => {
    await changeCostStatus(
      'logistics',
      { id: 'cost1', revision: 5 } as CostRecord,
      'confirm',
      '确认零元',
    )
    expect(apiClient.post).toHaveBeenCalledWith(
      '/orders/logistics-costs/cost1/confirm',
      { revision: 5, reason: '确认零元' },
      expect.anything(),
    )
  })
})
