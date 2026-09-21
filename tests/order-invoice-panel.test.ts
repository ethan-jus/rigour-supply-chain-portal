import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ElementPlus from 'element-plus'

const mocks = vi.hoisted(() => ({
  getInvoice: vi.fn(),
  apply: vi.fn(),
  upload: vi.fn(),
  complete: vi.fn(),
  withdraw: vi.fn(),
  can: vi.fn(() => true),
}))

vi.mock('@/api/core/order-register', () => ({
  getOrderInvoice: mocks.getInvoice,
  applyOrderInvoice: mocks.apply,
  uploadOrderInvoiceAttachments: mocks.upload,
  completeOrderInvoice: mocks.complete,
  withdrawOrderInvoice: mocks.withdraw,
}))

vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: mocks.can }),
}))

import OrderInvoicePanel from '@/views/supply-chain/order/components/OrderInvoicePanel.vue'

function invoice(overrides: Record<string, unknown> = {}) {
  return {
    id: '9',
    orderId: '1',
    orderNo: 'A001',
    statusCode: 'PENDING',
    statusName: '待开票',
    titleType: 'COMPANY',
    titleTypeName: '企业',
    title: '杭州测试有限公司',
    taxNo: '91330100TEST',
    invoiceType: 'NORMAL',
    invoiceTypeName: '普通发票',
    bankName: null,
    bankAccount: null,
    registerAddress: null,
    registerPhone: null,
    email: null,
    remark: null,
    amount: 1000,
    attachments: [],
    invoiceNo: null,
    appliedBy: '张三',
    appliedAt: '2026-09-20T02:00:00Z',
    invoicedBy: null,
    invoicedAt: null,
    updatedBy: '张三',
    updatedAt: '2026-09-20T02:00:00Z',
    ...overrides,
  }
}

function mountPanel() {
  return mount(OrderInvoicePanel, {
    props: { orderNo: 'A001' },
    global: { plugins: [ElementPlus] },
  })
}

describe('订单发票面板', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.can.mockReturnValue(true)
  })

  it('未申请时显示申请开票入口', async () => {
    mocks.getInvoice.mockResolvedValue(null)
    const wrapper = mountPanel()
    await flushPromises()
    expect(wrapper.text()).toContain('该订单尚未申请开票')
    const applyButton = wrapper.findAll('button').find((button) => button.text().includes('申请开票'))
    expect(applyButton).toBeTruthy()
  })

  it('无写权限时不显示申请开票按钮', async () => {
    mocks.can.mockReturnValue(false)
    mocks.getInvoice.mockResolvedValue(null)
    const wrapper = mountPanel()
    await flushPromises()
    const applyButton = wrapper.findAll('button').find((button) => button.text().includes('申请开票'))
    expect(applyButton).toBeUndefined()
    expect(wrapper.text()).toContain('需要「申请与登记发票」权限才能申请')
  })

  it('已撤回保留痕迹并允许重新申请', async () => {
    mocks.getInvoice.mockResolvedValue(invoice({ statusCode: 'REVOKED', statusName: '已撤回' }))
    const wrapper = mountPanel()
    await flushPromises()
    expect(wrapper.text()).toContain('上次申请已撤回')
    expect(wrapper.text()).toContain('申请开票')
  })

  it('待开票显示上传与完成开票，无附件时完成开票不可点', async () => {
    mocks.getInvoice.mockResolvedValue(invoice())
    const wrapper = mountPanel()
    await flushPromises()
    expect(wrapper.text()).toContain('待开票')
    expect(wrapper.text()).toContain('上传附件')
    const completeButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('完成开票'))
    expect(completeButton).toBeTruthy()
    expect(completeButton?.attributes('disabled')).toBeDefined()
  })

  it('有附件后完成开票可点击，并展示附件数量', async () => {
    mocks.getInvoice.mockResolvedValue(
      invoice({
        attachments: [
          { objectKey: 't/order-invoices/A001/a.png', fileName: 'a.png', url: 'https://x/a.png' },
        ],
      }),
    )
    const wrapper = mountPanel()
    await flushPromises()
    const completeButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('完成开票'))
    expect(completeButton?.attributes('disabled')).toBeUndefined()
  })

  it('已开票展示发票号码与开票日期', async () => {
    mocks.getInvoice.mockResolvedValue(
      invoice({
        statusCode: 'INVOICED',
        statusName: '已开票',
        invoiceNo: 'INV-0001',
        invoicedAt: '2026-09-20T16:00:00Z',
        attachments: [
          { objectKey: 't/order-invoices/A001/a.png', fileName: 'a.png', url: 'https://x/a.png' },
        ],
      }),
    )
    const wrapper = mountPanel()
    await flushPromises()
    expect(wrapper.text()).toContain('INV-0001')
    expect(wrapper.text()).toContain('2026-09-21')
    expect(wrapper.text()).not.toContain('撤回申请')
  })
})
