import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api/core/client', () => ({
  apiClient: { get: vi.fn() },
}))

import { apiClient } from '@/api/core/client'
import {
  getFundDocument,
  getFundDocuments,
  getSalesOrder,
  getSalesOrders,
  getSalesPayment,
  getSalesPayments,
  getSalesRefund,
  getSalesRefunds,
  getSalesShipment,
  getSalesShipments,
} from '@/api/core/order-sales'

describe('订单中心真实接口封装', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset().mockResolvedValue({ total: 0, begin: 0, step: 20, items: [] })
  })

  it.each([
    [getSalesOrders, '/orders/sales'],
    [getSalesShipments, '/orders/sales-shipments'],
    [getSalesPayments, '/orders/sales-payments'],
    [getSalesRefunds, '/orders/sales-refunds'],
    [getFundDocuments, '/orders/fund-documents'],
  ])('列表请求使用Order Center路径 %s', async (request, path) => {
    await request({ begin: 0, step: 20 })
    expect(apiClient.get).toHaveBeenCalledWith(path, {
      params: { begin: 0, step: 20 },
      stayOnUnauthorized: true,
    })
  })

  it.each([
    [getSalesOrder, '/orders/sales/42'],
    [getSalesShipment, '/orders/sales-shipments/42'],
    [getSalesPayment, '/orders/sales-payments/42'],
    [getSalesRefund, '/orders/sales-refunds/42'],
    [getFundDocument, '/orders/fund-documents/42'],
  ])('详情请求使用Order Center路径 %s', async (request, path) => {
    await request(42)
    expect(apiClient.get).toHaveBeenCalledWith(path, { stayOnUnauthorized: true })
  })
})
