import { describe, it, expect, vi } from 'vitest'
import {
  eligiblePayrollEmployees,
  payrollPaid,
  payrollRemaining,
  payrollReviewGroups,
  payrollStatusLabel,
  previousPayrollMonth,
  runPayrollEmployees,
} from '@/utils/payroll-workflow'
import {
  changePayrollStatus,
  registerPayrollPayment,
  createPayrollCorrection,
  exportPayroll,
  type PayrollRecord,
  type PayrollPreparationEmployee,
} from '@/api/core/payroll'
import { apiClient } from '@/api/core/client'
vi.mock('@/api/core/client', () => ({ apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))
describe('月度薪酬流程', () => {
  it('待核对事项合并同类日期和订单，去重后保留全部原始原因', () => {
    const issues = [
      '2026-09-01：打卡记录待审核',
      '2026-09-02：沟通时长缺少可信依据',
      '2026-09-01：打卡记录待审核',
      '订单 SO1：订单发生时的部门归属待核对',
      '订单 SO2：订单发生时的部门归属待核对',
      '绩效规则冲突，请核定当月绩效',
      '当月任职部门资料缺失或发生调动',
      'SO3：存在退款，需核对净销售与冲回',
    ]
    const groups = payrollReviewGroups(issues)
    expect(groups.map((g) => [g.key, g.items.length])).toEqual([
      ['performance', 3],
      ['department', 3],
      [issues[7], 1],
    ])
    expect(groups.flatMap((g) => g.items).sort()).toEqual([...new Set(issues)].sort())
    expect(groups[2]?.label).toBe(issues[7])
    expect(groups[2]?.determination).toBeNull()
    expect(payrollReviewGroups()).toEqual([])
  })
  it('账号关联与任职缺项各自提示处理位置', () => {
    const groups = payrollReviewGroups([
      '销售打卡账号未关联员工，无法核对过程考核',
      '当月任职部门资料缺失或发生调动',
    ])
    expect(groups.map((g) => g.determination)).toEqual(['performance', 'department'])
    expect(groups[0]?.hint).toContain('当月绩效总额')
    expect(groups[1]?.hint).toContain('无需逐笔处理')
  })
  it('字典加载前状态也显示中文，加载后使用字典且保留部分发放口径', () => {
    const review = { statusCode: 'REVIEW' } as PayrollRecord
    expect(payrollStatusLabel(review, 'REVIEW')).toBe('待核对')
    expect(payrollStatusLabel(review, '-')).toBe('待核对')
    expect(payrollStatusLabel(review, '')).toBe('待核对')
    expect(payrollStatusLabel(review, '需要复核')).toBe('需要复核')
    expect(payrollStatusLabel({ ...review, statusCode: 'READY' }, 'READY')).toBe('待确认')
    expect(payrollStatusLabel({ ...review, statusCode: 'UNKNOWN' }, '')).toBe('UNKNOWN')
    expect(
      payrollStatusLabel(
        { statusCode: 'CONFIRMED', payments: [{ amount: 100 }] } as PayrollRecord,
        '待发放',
      ),
    ).toBe('部分发放')
  })
  it('默认上一个已结束月份，包括跨年', () => {
    expect(previousPayrollMonth(new Date(2026, 0, 12))).toBe('2025-12')
    expect(previousPayrollMonth(new Date(2026, 9, 12))).toBe('2026-09')
  })
  it('只选择未锁定销售，缺类别和总部不推断为销售', () => {
    const people = [
      { employeeCode: '1', payrollCategory: null, locked: false },
      { employeeCode: '2', payrollCategory: 'SALES', locked: true },
      { employeeCode: '3', payrollCategory: 'HEADQUARTERS', locked: false },
      { employeeCode: '4', payrollCategory: 'SALES', locked: false },
    ] as PayrollPreparationEmployee[]
    expect(eligiblePayrollEmployees(people).map((e) => e.employeeCode)).toEqual(['4'])
  })
  it('逐人核算超过100人时不截断，一人失败不阻断后续，重复人员只处理一次', async () => {
    const progress = vi.fn(),
      action = vi.fn(async (code: string) => {
        if (code === 'E2') throw new Error('来源缺失')
        return code
      })
    const codes = Array.from({ length: 101 }, (_, i) => `E${i}`)
    const rows = await runPayrollEmployees([...codes, 'E1'], action, progress)
    expect(action).toHaveBeenCalledTimes(101)
    expect(rows).toHaveLength(101)
    expect(rows[2]?.error).toBeInstanceOf(Error)
    expect(rows[100]?.value).toBe('E100')
    expect(progress).toHaveBeenLastCalledWith(101, 101)
  })
  it('停止批次仅停止后续员工，不撤销已经完成的人员', async () => {
    let proceed = true
    const action = vi.fn(async (code: string) => code)
    const rows = await runPayrollEmployees(
      ['E1', 'E2', 'E3'],
      action,
      (done) => {
        if (done === 1) proceed = false
      },
      () => proceed,
    )
    expect(rows.map((row) => row.code)).toEqual(['E1'])
    expect(action).toHaveBeenCalledTimes(1)
  })
  it('部分发放按分计算余额，历史已发放不伪造凭证且不显示待发', () => {
    const row = {
      statusCode: 'CONFIRMED',
      calculation: { netPay: 1000.3 },
      payments: [{ amount: 100.1 }, { amount: 200.2 }],
    } as PayrollRecord
    expect(payrollPaid(row)).toBe(300.3)
    expect(payrollRemaining(row)).toBe(700)
    expect(payrollRemaining({ ...row, statusCode: 'PAID', payments: [] })).toBe(0)
  })
  it('发放使用结构化凭证和版本，补差使用目标月份，撤回保留原因', async () => {
    const row = { id: 'pay/1', revision: 4 } as PayrollRecord
    await registerPayrollPayment(row, {
      requestId: 'request',
      paidDate: '2026-10-12',
      amount: 100,
      referenceNo: 'bank-1',
      reason: '首笔',
    })
    expect(apiClient.post).toHaveBeenCalledWith(
      '/hr/payroll/pay%2F1/paid',
      {
        requestId: 'request',
        revision: 4,
        paidDate: '2026-10-12',
        amount: 100,
        referenceNo: 'bank-1',
        reason: '首笔',
      },
      expect.anything(),
    )
    await createPayrollCorrection(row, {
      requestId: 'correction',
      targetMonth: '2026-11',
      amount: -20,
      reason: '冲回',
    })
    expect(apiClient.post).toHaveBeenCalledWith(
      '/hr/payroll/pay%2F1/corrections',
      expect.objectContaining({ revision: 4, targetMonth: '2026-11', amount: -20 }),
      expect.anything(),
    )
    await changePayrollStatus(row, 'reopen', '底薪录错')
    expect(apiClient.post).toHaveBeenCalledWith(
      '/hr/payroll/pay%2F1/reopen',
      { revision: 4, reason: '底薪录错' },
      expect.anything(),
    )
  })
  it('整月导出携带当前筛选，使用服务端完整导出接口', async () => {
    await exportPayroll({
      month: '2026-09',
      departmentId: 8,
      keyword: '张',
      statusCode: 'READY',
      begin: 0,
      step: 200,
    })
    expect(apiClient.get).toHaveBeenCalledWith(
      '/hr/payroll/export',
      expect.objectContaining({
        params: expect.objectContaining({
          month: '2026-09',
          departmentId: 8,
          statusCode: 'READY',
          keyword: '张',
        }),
      }),
    )
  })
})
