import type { PayrollPreparationEmployee, PayrollRecord } from '@/api/core/payroll'

export function payrollMoney(value: number | null | undefined) {
  return value == null
    ? '待核定'
    : Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function payrollRole(row: PayrollRecord) {
  const role = row.calculation.scheme?.scheme.definition.role
  return (
    (
      {
        SALES: '销售',
        CITY_MANAGER: '城市总',
        TRAINEE_MANAGER: '见习城市总',
        HEADQUARTERS: '总部',
      } as Record<string, string>
    )[role || ''] || '身份待核定'
  )
}
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
  return rows.filter((e) => (e.canCalculate ?? e.payrollCategory === 'SALES') && !e.locked)
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
    const configuredIssue: Omit<PayrollReviewGroup, 'items'> | undefined = issue.includes(
      '本月绩效完成率',
    )
      ? {
          key: 'personal-completion',
          label: '个人月度绩效完成率待核定',
          hint: '在“核定薪酬”中填写该员工本月绩效完成率，与底薪、绩效、补贴和扣款集中核对；保存后重新核算，不影响同部门其他员工。',
          determination: 'performance',
        }
      : /打卡拜访依据暂不可用|数据源.*不可用/.test(issue)
        ? {
            key: 'source-unavailable',
            label: '来源数据暂不可用',
            hint: '恢复销售打卡等来源服务后重新核算；数据缺失不能当作缺勤或零业绩。',
            determination: null,
          }
        : /付清业绩基数待核定|订单资料待核对|回款业绩依据待核对/.test(issue)
          ? {
              key: 'order-evidence',
              label: '订单归属或回款依据待核对',
              hint: '在订单管理核对历史归属、商品金额与付清依据，处理后重新计算。缺失依据不会当作零业绩。',
              determination: null,
            }
          : /提成.*(规则|标准).*(未配置|待配置)|标准日期未匹配提成规则/.test(issue)
            ? {
                key: 'commission-rule',
                label: '提成规则待完善',
                hint: '在提成设置补齐对应日期、部门和商品的规则；存量订单需核定历史政策。展开查看受影响订单。',
                determination: null,
              }
            : /(规则|员工薪资标准).*(未配置|冲突|缺失)|缺少.*底薪金额/.test(issue)
              ? {
                  key: 'configuration',
                  label: '薪资档案或规则待完善',
                  hint: '在员工档案或对应规则入口补齐当月有效配置，再重新核算。',
                  determination: null,
                }
              : undefined
    const group: Omit<PayrollReviewGroup, 'items'> =
      configuredIssue ||
      (issue.includes('销售打卡账号未关联员工') ||
      issue.includes('绩效') ||
      /^\d{4}-\d{2}-\d{2}：.*(打卡|沟通时长)/.test(issue)
        ? {
            key: 'performance',
            label: '本月绩效待核定',
            hint: '检查绩效规则、员工与销售账号关联、打卡及沟通时长依据，补齐后重新计算；确需调整时单独留痕。',
            determination: null,
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
                hint: '在“核定薪酬”中填写需要调整的金额及统一核定说明，保存后重新核算。',
                determination: 'amount',
              }
            : {
                key: issue,
                label: issue,
                hint: '请按明细核对订单或规则来源，处理后重新核算。部门和绩效核定不会略过此项检查。',
                determination: null,
              })
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
  if (row.statusCode === 'READY' && dictionaryLabel === '可确认') return '待确认'
  if (row.statusCode === 'CONFIRMED' && dictionaryLabel === '已确认') return '待发放'
  if (
    row.statusCode === 'REVIEW' &&
    (!dictionaryLabel || ['REVIEW', '-', '待核对'].includes(dictionaryLabel))
  )
    return '待处理'
  const labels: Record<string, string> = {
    REVIEW: '待处理',
    READY: '待确认',
    CONFIRMED: '待发放',
    PAID: '已发放',
  }
  return dictionaryLabel && dictionaryLabel !== row.statusCode && dictionaryLabel !== '-'
    ? dictionaryLabel
    : labels[row.statusCode] || row.statusCode
}
