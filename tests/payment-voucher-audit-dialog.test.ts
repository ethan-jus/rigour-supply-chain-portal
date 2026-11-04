import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import ElementPlus, { ElSelect } from 'element-plus'
import { clearBusinessDictionariesForTest, seedBusinessDictionaryForTest } from '@/utils/business-dictionary'
import type { AuditGroup } from '@/api/core/payment-voucher-audit'
const mocks = vi.hoisted(() => ({ scan: vi.fn(), review: vi.fn() }))
vi.mock('@/api/core/payment-voucher-audit', () => ({ scanPaymentVouchers: mocks.scan, reviewPaymentVouchers: mocks.review }))
vi.mock('@/api/core/order-register', () => ({ getPaymentVoucherTransactions: vi.fn().mockResolvedValue([]) }))
vi.mock('@/composables/useSupplyPermissions', () => ({ useSupplyPermissions: () => ({ can: () => true }) }))
import PaymentVoucherAuditDialog from '@/views/supply-chain/order/components/PaymentVoucherAuditDialog.vue'
const group: AuditGroup = {
  key: 'G', kind: 'TRANSACTION', transactionNo: 'T1', imageKey: null, result: 'EXCESS',
  reasons: [], voucherAmount: 300, allocatedAmount: 600, excessAmount: 300, unresolvedPayments: 0,
  fingerprint: 'f', reviews: [], reviewStale: false, auditStatusCode: 'PENDING_REVIEW',
  reasonCodes: ['DUPLICATE_ALLOCATION'], reviewMethod: 'SYSTEM', payments: [
    { id: '1', paymentNo: 'P1', orderId: '1', orderNo: 'SO1', customer: '客户', salesperson: '销售',
      amount: 600, time: null, status: 'CHECKED', excluded: false, primaryTransaction: 'T1', attachmentKeys: [], evidence: [] },
  ],
}
const scanResult = (g: AuditGroup) => ({ scannedAt: '2026-11-03T00:00:00Z', paymentsScanned: 1, paymentsWithEvidence: 0,
  counts: { [g.auditStatusCode]: 1 }, groups: [g] })
let wrapper: ReturnType<typeof mount> | undefined
beforeEach(() => {
  vi.clearAllMocks(); clearBusinessDictionariesForTest()
  for (const [code, values] of Object.entries({
    ORDER_COLLECTION_STATUS: {}, PAYMENT_RECEIPT_STATUS: {}, PAYMENT_CONFIRMATION_STATUS: {},
    PAYMENT_VOUCHER_AUDIT_STATUS: { PENDING_REVIEW: '待核查', NORMAL: '正常', ABNORMAL: '异常' },
    PAYMENT_VOUCHER_AUDIT_REASON: { DUPLICATE_ALLOCATION: '疑似重复计入', OTHER: '租户补充原因' },
  })) seedBusinessDictionaryForTest('ORDER', code, Object.entries(values).map(([code,name]) => ({code,name})))
  mocks.scan.mockResolvedValue(scanResult(structuredClone(group)))
})
afterEach(() => { wrapper?.unmount(); wrapper = undefined; document.body.innerHTML = '' })
async function openEvidence() {
  wrapper = mount(PaymentVoucherAuditDialog, { props: { modelValue: false }, global: { plugins: [ElementPlus] } })
  await wrapper.setProps({ modelValue: true }); await flushPromises()
  const open = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === '查看证据')!
  open.click(); await flushPromises()
}
describe('凭证核查三态与原因表单', () => {
  it('已财务确认仍待核查，异常须选原因，人工正常后退出问题列表并通知父页面', async () => {
    await openEvidence()
    expect(document.body.textContent).toContain('待核查')
    expect(document.body.textContent).toContain('疑似重复计入')
    const conclusion = wrapper!.findAllComponents(ElSelect).find(c => c.props('placeholder') === '选择人工核查结论')!
    conclusion.vm.$emit('update:modelValue', 'ABNORMAL'); await flushPromises()
    const textarea = document.querySelector('textarea')!
    textarea.value = '核对原图与跨月分配'; textarea.dispatchEvent(new Event('input')); await flushPromises()
    const save = () => [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === '保存核查结论')!
    expect(save().disabled).toBe(true)
    const reasons = wrapper!.findAllComponents(ElSelect).find(c => c.props('placeholder') === '核查原因（必选）')!
    reasons.vm.$emit('update:modelValue', ['OTHER']); await flushPromises()
    expect(save().disabled).toBe(false)
    conclusion.vm.$emit('update:modelValue', 'NORMAL'); await flushPromises()
    const review = { id:'R',fingerprint:'f',conclusion:'NORMAL',note:'核对原图与跨月分配',actor:'finance',time:'2026-11-03T00:00:00Z',paymentIds:['1'],reasonCodes:[] }
    mocks.review.mockResolvedValue(review)
    mocks.scan.mockResolvedValue(scanResult({ ...structuredClone(group), auditStatusCode:'NORMAL', reasonCodes:[], reviewMethod:'MANUAL', reviews:[review] }))
    save().click(); await flushPromises()
    expect(mocks.review).toHaveBeenCalledWith({groupKey:'G',fingerprint:'f',conclusion:'NORMAL',note:'核对原图与跨月分配',reasonCodes:[]})
    expect(wrapper!.emitted('reviewed')).toHaveLength(1)
    expect([...document.querySelectorAll('button')].some(b => b.textContent?.trim() === '查看证据')).toBe(false)
    expect([...document.querySelectorAll('.el-alert')].map(e => e.textContent).join(' ')).not.toContain('疑似重复计入')
  })
})
