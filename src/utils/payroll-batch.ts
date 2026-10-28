import { calculatePayroll, changePayrollStatus, type PayrollRecord } from '@/api/core/payroll'
import type { PayrollBatchItem } from '@/api/core/payroll/models/PayrollBatchItem'
import { errorMessage } from '@/api/core/error'

export function payrollBatchSkipReason(
  row: PayrollRecord,
  action: 'confirm' | 'recalculate',
  currentMonth: string,
) {
  if (action === 'confirm') {
    if (row.paymentBlockReason) return row.paymentBlockReason
    if (row.month >= currentMonth) return '月份尚未结束，仅可预核算'
    if (row.statusCode !== 'READY')
      return row.statusCode === 'REVIEW' ? '有待处理事项，请处理后重算' : '已确认或已发放'
    if (
      row.calculation.issues.length ||
      row.calculation.netPay == null ||
      row.calculation.grossPay == null
    )
      return '工资依据或金额不完整，请重新核算'
  } else if (!['REVIEW', 'READY'].includes(row.statusCode)) return '已确认或已发放，不能重算'
  return ''
}

/** 每人独立调用原有事务接口；确认使用 HR 看过的版本，不自动确认后来变化的工资。 */
export async function runPayrollBatch(
  items: PayrollBatchItem[],
  action: 'confirm' | 'recalculate',
  reason: string,
  shouldContinue: () => boolean,
) {
  for (const item of items) {
    if (item.status !== 'WAITING') continue
    if (!shouldContinue()) {
      item.status = 'STOPPED'
      item.message = '未执行，可重新选择后处理'
      continue
    }
    item.status = 'RUNNING'
    try {
      if (action === 'confirm') {
        const saved = await changePayrollStatus(item.record, 'confirm', reason)
        if (saved.statusCode !== 'CONFIRMED') throw new Error('未返回已确认结果，请刷新核对')
        item.record = saved
        item.status = 'SUCCESS'
        item.message = '已确认，待登记发放'
      } else {
        const rows = await calculatePayroll(item.record.month, [item.record.employeeCode])
        const saved = rows.find(
          (r) => r.employeeCode === item.record.employeeCode && r.month === item.record.month,
        )
        if (saved) item.record = saved
        item.status = saved ? 'SUCCESS' : 'SKIPPED'
        item.message = !saved
          ? '工资已被确认或发放，系统跳过重算'
          : saved.statusCode === 'REVIEW'
            ? '已重算，仍有待处理事项，请查看薪酬明细'
            : '已重算，待 HR 确认'
      }
    } catch (error) {
      item.status = 'FAILED'
      item.message = errorMessage(error, '操作未完成，请刷新核对后再处理')
    }
  }
}
