import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ElementPlus from 'element-plus'

const mocks = vi.hoisted(() => ({
  getSalesPayment: vi.fn(),
}))

vi.mock('@/api/core/order-sales', () => ({
  getSalesPayment: mocks.getSalesPayment,
}))

import PaymentDetailDrawer from '@/views/supply-chain/order/components/PaymentDetailDrawer.vue'

function paymentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    paymentNo: 'PAY001',
    sourceRecordId: 'SRC-9',
    orderId: 'o1',
    orderNo: 'A001',
    dhbOrderNo: null,
    customerId: 'c1',
    customerName: '测试客户',
    regionCode: 'HZ',
    regionName: '杭州',
    ownerEmployeeCode: 'E001',
    ownerEmployeeName: '张三',
    departmentId: 1,
    departmentName: '销售部',
    orderDate: '2026-09-10T08:00:00+08:00',
    orderAmount: 1000,
    paidAmount: 200,
    paymentStatusCode: 'CHECKED',
    paymentTime: '2026-09-11T08:00:00+08:00',
    transactionNo: 'TXN-1',
    attachments: ['t1/fund-attachments/c.png'],
    attachmentViews: [
      {
        objectKey: 't1/fund-attachments/c.png',
        fileName: '列表签发.png',
        url: 'https://cos.example/c.png',
      },
    ],
    createdBy: '李四',
    createdTime: '2026-09-11T08:00:00+08:00',
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

describe('回款详情抽屉', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('详情返回凭证时优先展示带预览地址的大图', async () => {
    mocks.getSalesPayment.mockResolvedValue({
      voucherKeys: ['t1/fund-attachments/b.png'],
      attachments: [
        {
          objectKey: 't1/fund-attachments/a.png',
          fileName: '收款截图.png',
          url: 'https://cos.example/a.png',
        },
      ],
      remark: '补录收款',
    })
    const wrapper = mount(PaymentDetailDrawer, {
      props: { modelValue: true, payment: paymentRow() },
      global: { plugins: [ElementPlus], stubs: { teleport: true } },
    })
    await flushPromises()
    expect(mocks.getSalesPayment).toHaveBeenCalledWith('p1')
    const images = wrapper.findAll('img')
    expect(images.some((node) => (node.attributes('src') || '').includes('cos.example/a.png'))).toBe(true)
    expect(wrapper.find('.fund-attachment-thumbnails--large').exists()).toBe(true)
    expect(wrapper.text()).toContain('PAY001')
    expect(wrapper.text()).toContain('补录收款')
    wrapper.unmount()
  })

  it('详情失败但有列表签发的凭证时静默降级为列表大图', async () => {
    mocks.getSalesPayment.mockRejectedValue({ message: '网络异常，请稍后重试' })
    const wrapper = mount(PaymentDetailDrawer, {
      props: { modelValue: true, payment: paymentRow() },
      global: { plugins: [ElementPlus], stubs: { teleport: true } },
    })
    await flushPromises()
    const images = wrapper.findAll('img')
    expect(images.some((node) => (node.attributes('src') || '').includes('cos.example/c.png'))).toBe(true)
    expect(wrapper.text()).not.toContain('网络异常')
    wrapper.unmount()
  })

  it('详情失败且列表未签发凭证时给出提示，不展示对象键文本', async () => {
    mocks.getSalesPayment.mockRejectedValue({ message: '网络异常，请稍后重试' })
    const wrapper = mount(PaymentDetailDrawer, {
      props: { modelValue: true, payment: paymentRow({ attachmentViews: [] }) },
      global: { plugins: [ElementPlus], stubs: { teleport: true } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('网络异常，请稍后重试')
    expect(wrapper.text()).not.toContain('c.png')
    wrapper.unmount()
  })

  it('未打开时不请求详情', async () => {
    const wrapper = mount(PaymentDetailDrawer, {
      props: { modelValue: false, payment: paymentRow() },
      global: { plugins: [ElementPlus], stubs: { teleport: true } },
    })
    await flushPromises()
    expect(mocks.getSalesPayment).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
