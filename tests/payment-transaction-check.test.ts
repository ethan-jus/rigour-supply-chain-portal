import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ElementPlus from 'element-plus'
const { check } = vi.hoisted(() => ({ check: vi.fn() }))
vi.mock('@/api/core/order-register', () => ({ checkPaymentTransaction: check }))
import Dialog from '@/views/supply-chain/order/components/PaymentTransactionCheckDialog.vue'

describe('交易单号查重', () => {
  beforeEach(() => vi.clearAllMocks())
  it('sends the complete number without month filters and counts distinct payment records', async () => {
    check.mockResolvedValue([
      { paymentId: '1', paymentNo: 'PAY-1', paidAmount: 444.6, voucherAmount: 148.2 },
      { paymentId: '1', paymentNo: 'PAY-1', paidAmount: 444.6, voucherAmount: 148.2 },
      { paymentId: '2', paymentNo: 'PAY-2', paidAmount: 148.2, deleted: true },
    ])
    const wrapper = mount(Dialog, { props: { modelValue: false, transactionNo: ' TXN-123 ' }, global: { plugins: [ElementPlus], stubs: { teleport: true } } })
    await wrapper.setProps({ modelValue: true }); await flushPromises()
    expect(check).toHaveBeenCalledWith('TXN-123')
    expect(wrapper.text()).toContain('关联 2 条回款')
    expect(wrapper.text()).toContain('已删除')
    wrapper.unmount()
  })
  it('does not display an old response after the number changes', async () => {
    let resolve!: (rows: unknown[]) => void
    check.mockReturnValue(new Promise(r => { resolve = r }))
    const wrapper = mount(Dialog, { props: { modelValue: false, transactionNo: 'OLD' }, global: { plugins: [ElementPlus], stubs: { teleport: true } } })
    await wrapper.setProps({ modelValue: true }); await flushPromises()
    await wrapper.find('input').setValue('NEW')
    resolve([{ paymentId: 'old', paymentNo: 'STALE-PAYMENT' }]); await flushPromises()
    expect(wrapper.text()).not.toContain('STALE-PAYMENT')
    expect(wrapper.text()).not.toContain('未找到匹配')
    wrapper.unmount()
  })
})
