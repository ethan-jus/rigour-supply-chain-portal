import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  check: vi.fn(),
}))

vi.mock('@/api/core/order-register', () => ({
  checkOrderRegisterPayment: mocks.check,
}))

import PaymentCheckDialog from '@/views/supply-chain/order/components/PaymentCheckDialog.vue'

function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: '9',
    paymentNo: 'PAY-0001',
    sourceRecordId: 'PAY-0001',
    orderId: '1',
    orderNo: 'SO-0001',
    dhbOrderNo: null,
    customerId: '2',
    customerCode: 'C-1',
    customerName: '测试客户',
    regionCode: 'HZ',
    regionName: '杭州',
    ownerEmployeeCode: 'EMP-1',
    ownerEmployeeName: '张三',
    departmentId: null,
    departmentName: null,
    orderDate: '2026-09-01T00:00:00Z',
    orderAmount: 1000,
    paidAmount: 600,
    paymentStatusCode: 'RECEIVED',
    paymentTime: '2026-09-12T00:00:00Z',
    transactionNo: null,
    attachments: [],
    attachmentViews: [
      { objectKey: 't/fund-attachments/SO-0001/a.png', fileName: 'a.png', url: 'https://x/a.png' },
    ],
    createdBy: null,
    createdTime: null,
    updatedBy: null,
    updatedTime: null,
    syncedBy: null,
    syncedAt: null,
    checkedBy: null,
    checkedAt: null,
    revision: 1,
    ...overrides,
  }
}

function mountDialog(overrides: Record<string, unknown> = {}) {
  return mount(PaymentCheckDialog, {
    props: { modelValue: true, payment: payment(overrides) },
    global: { plugins: [ElementPlus] },
    attachTo: document.body,
  })
}

function bodyButton(text: string) {
  const button = Array.from(document.body.querySelectorAll('button')).find(
    (node) => node.textContent?.trim() === text,
  )
  if (!button) throw new Error(`button not found: ${text}`)
  return button
}

function bodyInput(placeholder: string) {
  const input = document.body.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`)
  if (!input) throw new Error(`input not found: ${placeholder}`)
  return input
}

describe('核对回款弹窗', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
    mocks.check.mockResolvedValue(payment({ paymentStatusCode: 'CHECKED', checkedBy: 'finance-1' }))
  })

  it('展示订单金额、回款金额与回款凭据', async () => {
    mountDialog()
    await flushPromises()

    expect(document.body.textContent).toContain('SO-0001')
    expect(document.body.textContent).toContain('¥1,000.00')
    expect(document.body.textContent).toContain('¥600.00')
    expect(document.body.textContent).toContain('回款凭据')
    expect(document.querySelectorAll('.fund-attachment-thumbnails__image').length).toBeGreaterThan(0)
  })

  it('未填写交易单号时提示，不发出请求', async () => {
    mountDialog()
    await flushPromises()

    bodyButton('审核通过').click()
    await flushPromises()

    expect(mocks.check).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('请填写交易单号')
  })

  it('填写流水号审核通过：调用接口并回传已核对视图', async () => {
    const wrapper = mountDialog()
    await flushPromises()

    const input = bodyInput('银行流水号 / 支付渠道流水号')
    input.value = 'TXN-998877'
    input.dispatchEvent(new Event('input'))
    await flushPromises()

    bodyButton('审核通过').click()
    await flushPromises()

    expect(mocks.check).toHaveBeenCalledWith('9', { transactionNo: 'TXN-998877' })
    expect(wrapper.emitted('checked')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false])
    wrapper.unmount()
  })

  it('流水号重复被后端拒绝时，在弹窗内显示原因', async () => {
    mocks.check.mockRejectedValue({
      code: 'CONFLICT',
      message: '交易单号已被其他回款单使用，请核对后重试',
    })
    const wrapper = mountDialog()
    await flushPromises()

    const input = bodyInput('银行流水号 / 支付渠道流水号')
    input.value = 'TXN-DUP'
    input.dispatchEvent(new Event('input'))
    await flushPromises()

    bodyButton('审核通过').click()
    await flushPromises()

    expect(document.body.textContent).toContain('交易单号已被其他回款单使用')
    wrapper.unmount()
  })
})
