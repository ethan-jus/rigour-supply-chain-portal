import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElMessageBox } from 'element-plus'
import Dialog from '@/views/supply-chain/hr/components/PayrollSettlementDialog.vue'
import {
  getPayrollDetail,
  changePayrollStatus,
  registerPayrollPayment,
  createPayrollCorrection,
  type PayrollRecord,
} from '@/api/core/payroll'
vi.mock('@/api/core/payroll', () => ({
  getPayrollDetail: vi.fn(),
  changePayrollStatus: vi.fn(),
  registerPayrollPayment: vi.fn(),
  createPayrollCorrection: vi.fn(),
}))
let wrapper: VueWrapper
const record = (statusCode = 'READY', paymentBlockReason: string | null = null): PayrollRecord => ({
  id: 'P1',
  month: '2026-09',
  employeeCode: 'E1',
  employeeName: '测试员工',
  statusCode,
  departmentId: 1,
  departmentName: '销售部',
  cityName: null,
  revision: 1,
  paymentBlockReason,
  calculation: {
    netPay: 1000,
    grossPay: 1000,
    heldCommission: 0,
    issues: [],
    details: [],
  } as unknown as PayrollRecord['calculation'],
  updatedTime: '2026-09-30T00:00:00Z',
})
beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-29T08:00:00Z'))
  vi.spyOn(ElMessageBox, 'alert').mockResolvedValue(
    'confirm' as Awaited<ReturnType<typeof ElMessageBox.alert>>,
  )
  wrapper = mount(Dialog, {
    global: { plugins: [ElementPlus], stubs: { teleport: true, PayrollCommissionSummary: true } },
  })
})
afterEach(() => {
  wrapper.unmount()
  vi.restoreAllMocks()
  vi.useRealTimers()
  document.body.innerHTML = ''
})
async function open(row: PayrollRecord, action: 'confirm' | 'paid') {
  await (wrapper.vm as unknown as { open: (r: PayrollRecord, a: string) => Promise<void> }).open(
    row,
    action,
  )
  await flushPromises()
}
it.each(['confirm', 'paid'] as const)(
  '%s 点击后依据最新考勤状态弹窗，不发起确认或登记请求',
  async (action) => {
    const reason = '该员工当月考勤尚未确认，请先确认考勤后再确认工资、登记发放'
    vi.mocked(getPayrollDetail).mockResolvedValue(
      record(action === 'paid' ? 'CONFIRMED' : 'READY', reason),
    )
    await open(record(), action)
    expect(getPayrollDetail).toHaveBeenCalledWith('P1')
    expect(ElMessageBox.alert).toHaveBeenCalledWith(
      reason,
      action === 'confirm' ? '暂不能确认工资' : '暂不能登记发放',
      expect.objectContaining({ confirmButtonText: '知道了', type: 'warning' }),
    )
    expect(wrapper.getComponent({ name: 'ElDialog' }).props('modelValue')).toBe(false)
    expect(changePayrollStatus).not.toHaveBeenCalled()
    expect(registerPayrollPayment).not.toHaveBeenCalled()
    expect(createPayrollCorrection).not.toHaveBeenCalled()
  },
)
it('本月未结束时点击确认工资说明限制，不打开可提交窗口', async () => {
  vi.mocked(getPayrollDetail).mockResolvedValue({ ...record(), month: '2026-10' })
  await open(record(), 'confirm')
  expect(ElMessageBox.alert).toHaveBeenCalledWith(
    expect.stringContaining('月份尚未结束'),
    '暂不能确认工资',
    expect.anything(),
  )
  expect(wrapper.getComponent({ name: 'ElDialog' }).props('modelValue')).toBe(false)
  expect(changePayrollStatus).not.toHaveBeenCalled()
})
it('考勤刚确认后以最新详情为准，不沿用列表里过期的阻断信息', async () => {
  vi.mocked(getPayrollDetail).mockResolvedValue(record())
  await open(record('READY', '旧考勤状态尚未确认'), 'confirm')
  expect(ElMessageBox.alert).not.toHaveBeenCalled()
  expect(wrapper.getComponent({ name: 'ElDialog' }).props('modelValue')).toBe(true)
  expect(wrapper.text()).toContain('确认薪酬')
  expect(changePayrollStatus).not.toHaveBeenCalled()
})

it('没有限制的待发放工资正常打开登记窗口，未自动保存或发起付款', async () => {
  vi.mocked(getPayrollDetail).mockResolvedValue(record('CONFIRMED'))
  await open(record('CONFIRMED'), 'paid')
  expect(ElMessageBox.alert).not.toHaveBeenCalled()
  expect(wrapper.getComponent({ name: 'ElDialog' }).props('modelValue')).toBe(true)
  expect(registerPayrollPayment).not.toHaveBeenCalled()
})
it('刷新后状态已变化时明确提示，不能沿用旧列表状态确认', async () => {
  vi.mocked(getPayrollDetail).mockResolvedValue(record('CONFIRMED'))
  await open(record('READY'), 'confirm')
  expect(ElMessageBox.alert).toHaveBeenCalledWith(
    expect.stringContaining('状态已变化'),
    '暂不能确认工资',
    expect.anything(),
  )
  expect(changePayrollStatus).not.toHaveBeenCalled()
})
