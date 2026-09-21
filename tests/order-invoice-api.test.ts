import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/api/core/client', () => ({
  apiClient: { get: mocks.get, post: mocks.post },
}))

import {
  applyOrderInvoice,
  completeOrderInvoice,
  getOrderInvoice,
  getOrderInvoicePage,
  getOrderInvoiceProfiles,
  uploadOrderInvoiceAttachments,
  withdrawOrderInvoice,
} from '@/api/core/order-register'

describe('订单开票接口契约', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.get.mockResolvedValue(null)
    mocks.post.mockResolvedValue({})
  })

  it('按订单号读取开票状态，未申请返回空数据', () => {
    void getOrderInvoice('A001')
    expect(mocks.get).toHaveBeenLastCalledWith('/orders/invoices', {
      params: { orderNo: 'A001' },
      stayOnUnauthorized: true,
    })
  })

  it('申请开票提交完整开票资料', () => {
    void applyOrderInvoice({
      orderNo: 'A001',
      titleType: 'COMPANY',
      title: '杭州测试有限公司',
      taxNo: '91330100TEST',
      invoiceType: 'SPECIAL',
      bankName: '工商银行',
      bankAccount: '6222020200000000000',
      registerAddress: '杭州市西湖区',
      registerPhone: '0571-88888888',
    })
    expect(mocks.post).toHaveBeenLastCalledWith(
      '/orders/invoices',
      expect.objectContaining({
        orderNo: 'A001',
        titleType: 'COMPANY',
        invoiceType: 'SPECIAL',
      }),
    )
  })

  it('上传附件使用 multipart，字段名为 files', () => {
    const file = new File(['x'], 'invoice.pdf', { type: 'application/pdf' })
    void uploadOrderInvoiceAttachments(9, [file])
    const [url, form, config] = mocks.post.mock.calls.at(-1) as [
      string,
      FormData,
      Record<string, unknown>,
    ]
    expect(url).toBe('/orders/invoices/9/attachments')
    expect(form).toBeInstanceOf(FormData)
    expect(form.getAll('files')).toHaveLength(1)
    expect(config).toMatchObject({ headers: { 'Content-Type': 'multipart/form-data' } })
  })

  it('完成开票要求发票号码与开票日期，撤回走状态端点', () => {
    void completeOrderInvoice(9, {
      invoiceNo: 'INV-0001',
      invoicedAt: '2026-09-20T16:00:00.000Z',
    })
    expect(mocks.post).toHaveBeenLastCalledWith('/orders/invoices/9/complete', {
      invoiceNo: 'INV-0001',
      invoicedAt: '2026-09-20T16:00:00.000Z',
    })
    void withdrawOrderInvoice(9)
    expect(mocks.post).toHaveBeenLastCalledWith('/orders/invoices/9/withdraw', {})
  })

  it('发票管理分页按状态/订单号/客户/申请时间筛选', () => {
    void getOrderInvoicePage({
      begin: 0,
      step: 20,
      status: 'PENDING',
      orderNo: 'A001',
      customerName: '测试客户',
      appliedFrom: '2026-09-01T00:00:00.000Z',
      appliedTo: '2026-09-30T23:59:59.999Z',
    })
    expect(mocks.get).toHaveBeenLastCalledWith('/orders/invoices/page', {
      params: {
        begin: 0,
        step: 20,
        status: 'PENDING',
        orderNo: 'A001',
        customerName: '测试客户',
        appliedFrom: '2026-09-01T00:00:00.000Z',
        appliedTo: '2026-09-30T23:59:59.999Z',
      },
      stayOnUnauthorized: true,
    })
  })

  it('客户开票资料按订单号读取，供申请弹窗下拉回显', () => {
    void getOrderInvoiceProfiles('A001')
    expect(mocks.get).toHaveBeenLastCalledWith('/orders/invoices/profiles', {
      params: { orderNo: 'A001' },
      stayOnUnauthorized: true,
    })
  })
})
