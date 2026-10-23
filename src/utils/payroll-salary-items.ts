import type { PayrollRecord } from '@/api/core/payroll'
import type { PayrollSalaryItem } from '@/api/core/payroll/models/PayrollSalaryItem'
import { payrollMoney, payrollPaid } from './payroll-workflow'

const difference = (amount: number | null | undefined, standard: number | null | undefined) =>
  amount == null || standard == null ? null : Math.round((amount - standard) * 100) / 100

/** 展示核算快照；不在前端重算工资，折算和人工覆盖单列以保证分项可对账。 */
export function payrollSalaryItems(record: PayrollRecord): PayrollSalaryItem[] {
  const c = record.calculation
  const s = c.scheme
  const p = c.performanceDetail
  const isManager = ['CITY_MANAGER', 'TRAINEE_MANAGER'].includes(s?.scheme.definition.role || '')
  const isHeadquarters = s?.scheme.definition.role === 'HEADQUARTERS'
  const performanceMode = s?.scheme.definition.performanceMode
  const tier = s?.scheme.definition.baseSalary.tiers.find((t) => t.code === s.salaryTier)
  const base = tier?.amount ?? s?.scheme.definition.baseSalary.fixedAmount
  const result: PayrollSalaryItem[] = [
    {
      name: '底薪',
      standard: base,
      change: difference(c.baseSalary, base),
      amount: c.baseSalary,
      basis:
        c.input.baseOverride != null
          ? `HR 核定：${c.input.reason}`
          : `${tier ? tier.name + '档' : '固定标准'} · 员工薪资标准及折算规则`,
    },
  ]
  if (p && p.processPay != null && p.collectionPay != null) {
    result.push(
      {
        name: '打卡与有效拜访绩效',
        standard: p.processBudget,
        change: difference(p.processPay, p.processBudget),
        amount: p.processPay,
        basis: '考核额度 − 逐日任务扣减；扣减以该部分额度封顶',
      },
      {
        name: '回款达标绩效',
        standard: p.collectionBudget,
        change: difference(p.collectionPay, p.collectionBudget),
        amount: p.collectionPay,
        basis: `整单付清业绩 ${payrollMoney(p.collections)} / 目标 ${payrollMoney(p.collectionTarget)}；达标封顶，保护期免考`,
      },
    )
    const adjustment = difference(c.performance, p.processPay + p.collectionPay)
    if (adjustment !== 0)
      result.push({
        name: '绩效折算 / 核定差额',
        amount: adjustment,
        basis:
          c.input.performanceOverride != null
            ? `HR 核定：${c.input.reason}`
            : '按薪资标准折算；与上述两项之和等于本月绩效',
      })
  } else
    result.push({
      name: isManager ? '城市总绩效' : isHeadquarters ? '总部人员绩效' : '绩效',
      standard: s?.performanceBase,
      change: difference(c.performance, s?.performanceBase),
      amount: c.performance,
      basis:
        c.input.performanceOverride != null
          ? `HR 核定：${c.input.reason}`
          : performanceMode === 'NONE'
            ? '本月规则不计绩效'
            : isManager && performanceMode === 'MANAGER'
              ? s?.scheme.definition.manager?.calculationMode === 'ACTUAL_COMPLETION'
                ? '绩效基数 × 单项指标计分后的加权发放比例；保护期和折算见绩效明细'
                : '历史规则：绩效基数 × 综合阶梯系数；保护期和折算见绩效明细'
              : isHeadquarters && performanceMode === 'FIXED'
                ? `个人绩效基数 × 本人当月绩效完成率（${s?.performanceCompletionPercent == null ? '待核定' : s.performanceCompletionPercent + '%'}），再执行绩效折算`
                : '按本月绩效规则及折算依据计算',
    })
  const allowances = s?.scheme.definition.allowances ?? []
  if (allowances.length) {
    for (const item of allowances)
      result.push({
        name: item.name,
        standard: item.amount,
        change: 0,
        amount: item.amount,
        basis: '补贴规则月度标准',
      })
    const adjustment = difference(
      c.allowance,
      allowances.reduce((sum, item) => sum + (item.amount ?? 0), 0),
    )
    if (adjustment !== 0)
      result.push({
        name: '补贴折算 / 核定差额',
        amount: adjustment,
        basis:
          c.input.allowanceOverride != null
            ? `HR 核定：${c.input.reason}`
            : '按补贴规则折算；与上述项目之和等于本月补贴',
      })
  } else
    result.push({
      name: '固定补贴',
      amount: c.allowance,
      basis: c.allowance === 0 ? '本月无适用补贴' : '按本月补贴依据计算',
    })
  result.push(
    {
      name: '商品提成',
      amount: c.commission,
      basis: '分类 → 商品规格 → 订单行，分别保留销售 / 城市总受益角色',
    },
    {
      name: '补发补扣',
      amount: c.correctionAmount ?? 0,
      basis: `${c.corrections?.length || 0} 条更正记录，详见调整与历史`,
    },
    {
      name: '应发工资',
      amount: c.grossPay,
      total: true,
      basis: '底薪 + 绩效 + 补贴 + 提成 + 补发补扣',
    },
    {
      name: '其他扣款',
      amount: c.deduction,
      basis: c.deduction ? c.input.reason || '本月人工调整' : '本月无其他扣款',
    },
    {
      name: '应付工资',
      amount: c.netPay,
      total: true,
      basis: '应发工资 − 其他扣款；绩效扣减已体现在绩效内，不再次扣除',
    },
    {
      name: '实际发放',
      amount: payrollPaid(record),
      total: true,
      basis: `${record.payments?.length || 0} 条发放登记，详见调整与历史`,
    },
  )
  return result
}
