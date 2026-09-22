import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/api/core/client', () => ({
  apiClient: { get: mocks.get, post: mocks.post },
}))

import {
  exportOrderRegisterCsv,
  getOrderRegisterCreators,
  getOrderRegisterLines,
  getOrderRegisterOrders,
  getOrderRegisterPayments,
  getOrderRegisterPeriod,
  getOrderRegisterReceivables,
} from '@/api/core/order-register'

import { getErpManagedProducts } from '@/api/core/erp-product'

describe('订单注册读接口契约', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.get.mockResolvedValue({})
  })

  it('商品集合用单个逗号参数，保持网关签名与后端解析一致', () => {
    void getErpManagedProducts({ begin: 0, step: 200, productIds: [15, 14, 21] })
    expect(mocks.get.mock.calls.at(-1)![1].params.productIds).toBe('15,14,21')
    void getOrderRegisterLines({ begin: 0, step: 20, productIds: [15, 14] })
    expect(mocks.get.mock.calls.at(-1)![1].params.productIds).toBe('15,14')
    void exportOrderRegisterCsv('lines', { productIds: [15, 14] })
    expect(mocks.get.mock.calls.at(-1)![1].params.productIds).toBe('15,14')
  })

  it('订单/明细/收款/统计使用同一 BASE 和 stayOnUnauthorized', () => {
    void getOrderRegisterOrders({ begin: 0, step: 20 })
    expect(mocks.get).toHaveBeenLastCalledWith('/orders/register/orders', {
      params: { begin: 0, step: 20 },
      stayOnUnauthorized: true,
    })

    void getOrderRegisterLines({ begin: 0, step: 20, productCode: 'P1' })
    expect(mocks.get).toHaveBeenLastCalledWith('/orders/register/lines', {
      params: { begin: 0, step: 20, productCode: 'P1' },
      stayOnUnauthorized: true,
    })

    void getOrderRegisterPayments({ begin: 0, step: 20, paymentNo: 'R1' })
    expect(mocks.get).toHaveBeenLastCalledWith('/orders/register/payments', {
      params: { begin: 0, step: 20, paymentNo: 'R1' },
      stayOnUnauthorized: true,
    })

    void getOrderRegisterPeriod({ dateFrom: '2026-09-01', dateTo: '2026-09-10' })
    expect(mocks.get).toHaveBeenLastCalledWith('/orders/register/statistics/period', {
      params: { dateFrom: '2026-09-01', dateTo: '2026-09-10' },
      stayOnUnauthorized: true,
    })

    void getOrderRegisterReceivables({ asOfDate: '2026-09-10', hasUnpaid: true })
    expect(mocks.get).toHaveBeenLastCalledWith('/orders/register/statistics/receivables', {
      params: { asOfDate: '2026-09-10', hasUnpaid: true },
      stayOnUnauthorized: true,
    })
  })

  it('创建人下拉是独立端点', () => {
    void getOrderRegisterCreators()
    expect(mocks.get).toHaveBeenLastCalledWith('/orders/register/creators', {
      stayOnUnauthorized: true,
    })
  })

  it('导出走同筛选的 CSV 端点，返回 Blob 且不吞超时', () => {
    void exportOrderRegisterCsv('orders', { orderNo: 'A001' })
    expect(mocks.get).toHaveBeenLastCalledWith('/orders/register/orders/export', {
      params: { orderNo: 'A001' },
      responseType: 'blob',
      timeout: 180000,
      stayOnUnauthorized: true,
    })

    void exportOrderRegisterCsv('period', { dateFrom: '2026-09-01', dateTo: '2026-09-10' })
    expect(mocks.get).toHaveBeenLastCalledWith('/orders/register/statistics/period/export', {
      params: { dateFrom: '2026-09-01', dateTo: '2026-09-10' },
      responseType: 'blob',
      timeout: 180000,
      stayOnUnauthorized: true,
    })

    void exportOrderRegisterCsv('receivables', { asOfDate: '2026-09-10' })
    expect(mocks.get).toHaveBeenLastCalledWith('/orders/register/statistics/receivables/export', {
      params: { asOfDate: '2026-09-10' },
      responseType: 'blob',
      timeout: 180000,
      stayOnUnauthorized: true,
    })
  })
})
