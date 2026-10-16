import { commissionCategories, payrollAppliedRules } from '@/utils/payroll-commission-detail'
import type { PayrollRecord } from '@/api/core/payroll'
import { payrollPaid, payrollRemaining, payrollStatusLabel } from '@/utils/payroll-workflow'
import { payrollSalaryItems } from '@/utils/payroll-salary-items'

/** Export persisted server evidence for the complete authorized result, never browser calculations. */
export async function buildPayrollWorkbook(records: PayrollRecord[]) {
  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()
  const identity = (row: PayrollRecord) => [row.month, row.employeeCode, row.employeeName]
  const headers = ['月份', '员工编号', '姓名']
  const sheet = (
    name: string,
    columns: string[],
    values: (string | number | null | undefined)[][],
  ) => {
    const page = workbook.addWorksheet(name)
    page.addRow([...headers, ...columns])
    values.forEach((row) => page.addRow(row.map((value) => value ?? '待核定')))
    page.getRow(1).font = { bold: true }
    page.views = [{ state: 'frozen', ySplit: 1 }]
    page.columns.forEach((column) => {
      column.width = 22
    })
    page.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length + columns.length },
    }
  }
  sheet(
    '薪酬概览',
    [
      '部门',
      '城市',
      '薪资标准',
      '版本',
      '底薪',
      '绩效',
      '补贴',
      '提成',
      '补发补扣',
      '其他扣款',
      '应发',
      '应付工资',
      '状态',
      '已登记发放',
      '待发金额',
      '凭证',
    ],
    records.map((row) => {
      const c = row.calculation
      return [
        ...identity(row),
        row.departmentName,
        row.cityName,
        c.scheme?.scheme.definition.name || '历史规则',
        c.scheme?.scheme.version,
        c.baseSalary,
        c.performance,
        c.allowance,
        c.commission,
        c.correctionAmount ?? 0,
        c.deduction,
        c.grossPay,
        c.netPay,
        payrollStatusLabel(row, ''),
        payrollPaid(row),
        c.netPay == null ? null : payrollRemaining(row),
        (row.payments || [])
          .map((p) => `${p.paidDate} / ${p.amount} / ${p.referenceNo}`)
          .join('；'),
      ]
    }),
  )
  sheet(
    '工资组成',
    ['工资项目', '标准 / 基数（元）', '扣减 / 调整（元）', '本月金额（元）', '计算依据'],
    records.flatMap((row) =>
      payrollSalaryItems(row).map((item) => [
        ...identity(row),
        item.name,
        'standard' in item ? item.standard : '—',
        'change' in item ? item.change : '—',
        item.amount,
        item.basis,
      ]),
    ),
  )
  sheet(
    '商品提成明细',
    [
      '订单',
      '商品规格',
      '受益角色',
      '城市',
      '数量',
      '单位',
      '计提基数',
      '标准',
      '方法',
      '付清日期',
      '计提金额',
      '本期发放',
      '规则',
      '版本',
      '说明',
      'ERP 分类',
      '规格编码',
      '规则编码',
      '订单日期',
      '订单金额',
      '截至核算日累计回款',
      '截至核算日退款',
      '回款依据截止日期',
    ],
    records.flatMap((row) =>
      row.calculation.details.map((d) => [
        ...identity(row),
        d.orderNo,
        d.productName,
        d.recipientRoleCode,
        d.trace?.cityCode,
        d.quantity,
        d.unitCode,
        d.trace?.baseAmount,
        d.trace?.rate,
        d.trace?.method,
        d.trace?.fullyPaidDate,
        d.accrued,
        d.released,
        d.ruleName,
        d.ruleRevision,
        d.message,
        d.trace?.product?.categoryPath,
        d.trace?.product?.variantCode,
        d.trace?.appliedRule?.ruleCode,
        d.trace?.orderDate,
        d.trace?.settlement?.orderAmount ?? '—',
        d.trace?.settlement?.paidAmount ?? '—',
        d.trace?.settlement?.refundedAmount ?? '—',
        d.trace?.settlement?.through ?? '—',
      ]),
    ),
  )
  const grouped = (dimension: 'product' | 'rule' | 'city') =>
    records.flatMap((row) => {
      const groups = new Map<
        string,
        {
          label: string
          role: string
          amount: number
          released: number
          incomplete: boolean
          releasedIncomplete: boolean
        }
      >()
      row.calculation.details.forEach((d) => {
        const label =
          dimension === 'product'
            ? d.productName
            : dimension === 'rule'
              ? d.ruleName || '待关联规则'
              : d.trace?.cityCode || row.cityName || '待关联城市'
        const stableKey =
          dimension === 'rule'
            ? `${d.ruleId}:${d.ruleRevision}`
            : dimension === 'product'
              ? `${d.trace?.variantId || label}:${d.unitCode}:${d.trace?.method}:${d.trace?.rate}`
              : label
        const key = `${stableKey}|${d.recipientRoleCode}`
        const value = groups.get(key) || {
          label,
          role: d.recipientRoleCode,
          amount: 0,
          released: 0,
          incomplete: false,
          releasedIncomplete: false,
        }
        value.incomplete ||= d.accrued == null
        value.releasedIncomplete ||= d.released == null
        value.amount += Math.round((d.accrued || 0) * 100)
        value.released += Math.round((d.released ?? 0) * 100)
        groups.set(key, value)
      })
      return [...groups.values()].map((g) => [
        ...identity(row),
        g.label,
        g.role,
        g.incomplete ? null : g.amount / 100,
        g.releasedIncomplete ? null : g.released / 100,
      ])
    })
  sheet(
    '商品分类汇总',
    ['ERP 分类', '订单数', '计提明细数', '已计算提成', '待核定明细数', '提成合计'],
    records.flatMap((row) =>
      commissionCategories(row.calculation.details).map((c) => [
        ...identity(row),
        c.name,
        c.orderCount,
        c.lineCount,
        c.knownAmount,
        c.pendingCount,
        c.amount,
      ]),
    ),
  )
  sheet(
    '实际使用规则',
    ['类型', '规则编码', '规则名称', '版本', '生效日期', '结束日期'],
    records.flatMap((row) =>
      payrollAppliedRules(row).map((r) => [
        ...identity(row),
        r.kind,
        r.ruleCode,
        r.name,
        r.version,
        r.effectiveFrom,
        r.effectiveTo,
      ]),
    ),
  )
  sheet('商品型号汇总', ['商品型号', '受益角色', '计提合计', '本期发放'], grouped('product'))
  sheet('商品组汇总', ['规则商品组', '受益角色', '计提合计', '本期发放'], grouped('rule'))
  sheet('城市汇总', ['城市', '受益角色', '计提合计', '本期发放'], grouped('city'))
  sheet(
    '城市总绩效汇总',
    ['绩效基数', '加权完成率', '综合绩效系数', '保护期天数', '考核期天数', '本月绩效'],
    records.flatMap((row) => {
      const s = row.calculation.scheme
      return s?.scheme.definition.performanceMode === 'MANAGER'
        ? [
            [
              ...identity(row),
              s.performanceBase,
              s.managerCompletion,
              s.managerCoefficient,
              s.protectedDays,
              s.assessedDays,
              row.calculation.performance,
            ],
          ]
        : []
    }),
  )
  sheet(
    '城市总绩效',
    ['指标', '实际', '目标', '权重', '完成率', '加权贡献', '依据'],
    records.flatMap((row) =>
      (row.calculation.scheme?.metrics || []).map((m) => [
        ...identity(row),
        m.name,
        m.actual,
        m.target,
        m.weight,
        m.completion,
        m.contribution,
        m.evidence,
      ]),
    ),
  )
  sheet(
    '销售绩效',
    [
      '打卡与有效拜访绩效额度',
      '缺卡与缺拜访扣减',
      '打卡与有效拜访绩效（折算前）',
      '回款达标绩效额度',
      '回款目标',
      '整单付清业绩',
      '回款达标绩效（折算前）',
    ],
    records.flatMap((row) => {
      const p = row.calculation.performanceDetail
      return p
        ? [
            [
              ...identity(row),
              p.processBudget,
              p.processDeduction,
              p.processPay,
              p.collectionBudget,
              p.collectionTarget,
              p.collections,
              p.collectionPay,
            ],
          ]
        : []
    }),
  )
  sheet(
    '每日过程明细',
    ['日期', '打卡', '有效拜访', '缺卡', '缺拜访', '原始扣减（封顶前）', '核算状态'],
    records.flatMap((row) =>
      (row.calculation.performanceDetail?.days || []).map((d) => [
        ...identity(row),
        d.date,
        d.checkins,
        d.effectiveVisits,
        d.missingCheckins,
        d.missingVisits,
        d.deduction,
        d.evidenceComplete ? '已按规则计算' : '来源未关联',
      ]),
    ),
  )
  sheet(
    '工资更正',
    ['原工资月份', '计入月份', '更正金额', '原因', '来源工资单'],
    records.flatMap((row) =>
      (row.calculation.corrections || []).map((c) => [
        ...identity(row),
        c.sourceMonth,
        c.targetMonth,
        c.amount,
        c.reason,
        c.sourcePayrollId,
      ]),
    ),
  )
  sheet(
    '核对事项',
    ['说明'],
    records.flatMap((row) => row.calculation.issues.map((issue) => [...identity(row), issue])),
  )
  return workbook
}

export async function exportPayrollRecords(records: PayrollRecord[], filename: string) {
  const workbook = await buildPayrollWorkbook(records)
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer())
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${filename}.xlsx`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export const exportPayrollDetails = (row: PayrollRecord) =>
  exportPayrollRecords([row], `薪酬明细-${row.month}-${row.employeeCode}`)
