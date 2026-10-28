import { beforeEach, describe, expect, it, vi } from 'vitest'
import { calculatePayroll, changePayrollStatus, type PayrollRecord } from '@/api/core/payroll'
import type { PayrollBatchItem } from '@/api/core/payroll/models/PayrollBatchItem'
import { payrollBatchSkipReason, runPayrollBatch } from '@/utils/payroll-batch'
import { payrollMoney } from '@/utils/payroll-workflow'
vi.mock('@/api/core/payroll', () => ({ calculatePayroll: vi.fn(), changePayrollStatus: vi.fn() }))
const record = (id: string, statusCode = 'READY') =>
  ({
    id,
    employeeCode: id,
    employeeName: id,
    revision: 7,
    month: '2026-09',
    statusCode,
    calculation: { grossPay: 100, netPay: 100, issues: [] },
  }) as unknown as PayrollRecord
const items = (): PayrollBatchItem[] =>
  ['A', 'B', 'C'].map((id) => ({ record: record(id), status: 'WAITING', message: '' }))
beforeEach(() => vi.resetAllMocks())
describe('工资批量操作', () => {
  it('批量确认跳过当月考勤未确认的工资，仍可重新核算', () => {
    const row = { ...record('A'), paymentBlockReason: '该员工当月考勤尚未确认' }
    expect(payrollBatchSkipReason(row, 'confirm', '2026-10')).toContain('考勤尚未确认')
    expect(payrollBatchSkipReason(row, 'recalculate', '2026-10')).toBe('')
  })
  it('重算成功后用新工资替换弹窗中的旧金额和版本', async () => {
    const old = record('A', 'REVIEW')
    old.calculation.netPay = null
    const saved = record('A')
    saved.revision = 8
    saved.calculation.netPay = 5652.87
    const rows: PayrollBatchItem[] = [{ record: old, status: 'WAITING', message: '' }]
    vi.mocked(calculatePayroll).mockResolvedValue([saved])
    await runPayrollBatch(rows, 'recalculate', '', () => true)
    expect(rows[0]!.record).toBe(saved)
    expect(rows[0]!.record.calculation.netPay).toBe(5652.87)
    expect(rows[0]!.status).toBe('SUCCESS')
  })
  it('确认只能处理已结束月份、依据及金额完整的待确认工资，0元是合法金额', () => {
    expect(payrollBatchSkipReason(record('A'), 'confirm', '2026-10')).toBe('')
    expect(payrollBatchSkipReason(record('A'), 'confirm', '2026-09')).toContain('尚未结束')
    expect(payrollBatchSkipReason(record('A', 'REVIEW'), 'confirm', '2026-10')).toContain('待处理')
    for (const status of ['CONFIRMED', 'PAID'])
      expect(payrollBatchSkipReason(record('A', status), 'recalculate', '2026-10')).toContain(
        '不能重算',
      )
    const row = record('A')
    row.calculation.netPay = null
    expect(payrollBatchSkipReason(row, 'confirm', '2026-10')).toContain('不完整')
    row.calculation.netPay = 0
    expect(payrollBatchSkipReason(row, 'confirm', '2026-10')).toBe('')
    row.calculation.issues = ['来源变化']
    expect(payrollBatchSkipReason(row, 'confirm', '2026-10')).toContain('不完整')
    expect(payrollMoney(null)).toBe('待核定')
    expect(payrollMoney(0)).toBe('0.00')
  })
  it('确认使用用户已核对的版本，一人来源冲突不会阻断后续，也不会重算后直接确认', async () => {
    const rows = items()
    vi.mocked(changePayrollStatus).mockImplementation(async (row) => {
      if (row.id === 'B') throw new Error('来源已变化，请重新核算')
      return { ...row, statusCode: 'CONFIRMED' }
    })
    await runPayrollBatch(rows, 'confirm', '核对完毕', () => true)
    expect(rows.map((r) => r.status)).toEqual(['SUCCESS', 'FAILED', 'SUCCESS'])
    expect(rows[1]!.message).toContain('来源已变化')
    expect(changePayrollStatus).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'A', revision: 7 }),
      'confirm',
      '核对完毕',
    )
    expect(calculatePayroll).not.toHaveBeenCalled()
  })
  it('停止只阻止后续人员，保留当前成功结果，不重发已处理请求', async () => {
    const rows = items()
    let proceed = true
    vi.mocked(changePayrollStatus).mockImplementation(async (row) => {
      proceed = false
      return { ...row, statusCode: 'CONFIRMED' }
    })
    await runPayrollBatch(rows, 'confirm', '', () => proceed)
    expect(rows.map((r) => r.status)).toEqual(['SUCCESS', 'STOPPED', 'STOPPED'])
    await runPayrollBatch(rows, 'confirm', '', () => true)
    expect(changePayrollStatus).toHaveBeenCalledTimes(1)
  })
  it('重算遇到并发锁定时说明跳过，仍有缺项时明确提示，预先跳过人员不发请求', async () => {
    const rows = items()
    rows[2]!.status = 'SKIPPED'
    vi.mocked(calculatePayroll).mockImplementation(async (_month, codes) =>
      codes[0] === 'A' ? [] : [record('B', 'REVIEW')],
    )
    await runPayrollBatch(rows, 'recalculate', '', () => true)
    expect(rows.map((r) => r.status)).toEqual(['SKIPPED', 'SUCCESS', 'SKIPPED'])
    expect(rows[1]!.message).toContain('仍有待处理')
    expect(calculatePayroll).toHaveBeenCalledTimes(2)
  })
})
