import type { PayrollPreparationEmployee, PayrollRecord } from '@/api/core/payroll'
export function previousPayrollMonth(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('sv-SE').slice(0, 7)
}
export function payrollPaid(row: PayrollRecord) {
  // 历史已发放单没有结构化登记，沿用已完成状态，不伪造付款日期和凭证。
  if (row.statusCode === 'PAID' && !row.payments?.length) return row.calculation.netPay ?? 0
  return (row.payments ?? []).reduce((sum, p) => sum + Math.round(Number(p.amount) * 100), 0) / 100
}
export function payrollRemaining(row: PayrollRecord) {
  return Math.max(0, Math.round(((row.calculation.netPay ?? 0) - payrollPaid(row)) * 100) / 100)
}
export function eligiblePayrollEmployees(rows: PayrollPreparationEmployee[]) {
  return rows.filter((e) => e.payrollCategory === 'SALES' && !e.locked)
}
export async function runPayrollEmployees<T>(
  codes: string[],
  action: (code: string) => Promise<T>,
  progress: (done: number, total: number) => void,
  shouldContinue: () => boolean = () => true,
) {
  const results: { code: string; value?: T; error?: unknown }[] = []
  const unique = [...new Set(codes)]
  // 每人独立事务；某人异常不阻断其余员工，也不重发已经完成的请求。
  for (const code of unique) {
    if (!shouldContinue()) break
    try {
      results.push({ code, value: await action(code) })
    } catch (error) {
      results.push({ code, error })
    }
    progress(results.length, unique.length)
  }
  return results
}

export interface PayrollReviewGroup {
  key: string
  label: string
  hint: string
  determination: 'department' | 'performance' | 'amount' | null
  items: string[]
}
/** 合并按天、按订单重复出现的待核对原因，原始说明全部保留供明细展开。 */
export function payrollReviewGroups(issues: string[] = []): PayrollReviewGroup[] {
  const groups = new Map<string, PayrollReviewGroup>()
  for (const issue of new Set(issues.filter(Boolean))) {
    const group: Omit<PayrollReviewGroup, 'items'> =
      issue.includes('销售打卡账号未关联员工') ||
      issue.includes('绩效') ||
      /^\d{4}-\d{2}-\d{2}：.*(打卡|沟通时长)/.test(issue)
        ? {
            key: 'performance',
            label: '本月绩效待核定',
            hint: 'HR 核对考核结果后，在此填写当月绩效总额（过程＋回款），说明核定依据，保存后自动重算。原始拜访记录保留。',
            determination: 'performance',
          }
        : issue.includes('订单发生时的部门归属待核对') || issue.includes('当月任职部门')
          ? {
              key: 'department',
              label: '部门归属待核定',
              hint: '在此核定本人当月所属部门，同月订单统一重算，无需逐笔处理。其他月份或其他销售的订单，使用对应员工、月份的核定结果。',
              determination: 'department',
            }
          : /底薪|薪资档案|补贴|扣款/.test(issue)
            ? {
                key: 'amount',
                label: '其他金额待核定',
                hint: '在“当月核定”的“其他金额”中填写需要调整的金额，填写一次说明后保存重算。',
                determination: 'amount',
              }
            : {
                key: issue,
                label: issue,
                hint: '请按明细核对订单或规则来源，处理后重新核算。部门和绩效核定不会略过此项检查。',
                determination: null,
              }
    const existing = groups.get(group.key)
    if (existing) existing.items.push(issue)
    else groups.set(group.key, { ...group, items: [issue] })
  }
  return [...groups.values()]
}
export function payrollStatusLabel(
  row: Pick<PayrollRecord, 'statusCode' | 'payments'>,
  dictionaryLabel: string,
) {
  if (row.statusCode === 'CONFIRMED' && row.payments?.length) return '部分发放'
  const labels: Record<string, string> = {
    REVIEW: '待核对',
    READY: '待确认',
    CONFIRMED: '待发放',
    PAID: '已发放',
  }
  return dictionaryLabel && dictionaryLabel !== row.statusCode && dictionaryLabel !== '-'
    ? dictionaryLabel
    : labels[row.statusCode] || row.statusCode
}
