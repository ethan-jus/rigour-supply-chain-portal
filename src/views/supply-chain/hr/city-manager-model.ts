import type { PayrollPage, PayrollRule } from '@/api/core/payroll'

export interface ManagerGroup {
  employeeCode: string
  assignments: PayrollRule[]
}

// 分组、筛选都基于完整结果，不能只对接口的某一页做汇总。
export async function completePages<T>(fetchPage: (begin: number) => Promise<PayrollPage<T>>) {
  const rows: T[] = []
  let expectedTotal: number | undefined
  for (;;) {
    const page = await fetchPage(rows.length)
    if (page.total > 20000) throw new Error('记录超过查看上限，请联系管理员缩小数据权限范围')
    if (expectedTotal !== undefined && expectedTotal !== page.total)
      throw new Error('数据在查询期间发生变化，请刷新后重试')
    expectedTotal = page.total
    if (page.begin !== rows.length || (!page.items.length && rows.length < page.total))
      throw new Error('数据未完整返回，请刷新后重试')
    rows.push(...page.items)
    if (rows.length === page.total) return rows
    if (rows.length > page.total) throw new Error('返回记录数量异常，请刷新后重试')
  }
}

export function managerGroups(rules: PayrollRule[], employeeCode = '', cityCode = '') {
  const groups = new Map<string, ManagerGroup>()
  for (const row of rules) {
    const c = row.data
    if (c.kindCode !== 'CITY_MANAGER' || !c.employeeCode) continue
    if (employeeCode && c.employeeCode !== employeeCode) continue
    if (cityCode && c.cityCode !== cityCode) continue
    let group = groups.get(c.employeeCode)
    if (!group) {
      group = { employeeCode: c.employeeCode, assignments: [] }
      groups.set(c.employeeCode, group)
    }
    group.assignments.push(row)
  }
  return [...groups.values()]
}

export function shanghaiToday() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date())
}

export function managerTermStatus(row: PayrollRule, today = shanghaiToday()) {
  if (!row.data.enabled) return '已停用'
  if (row.data.effectiveFrom > today) return '未开始'
  if (row.data.effectiveTo < today) return '已结束'
  return '任期中'
}
