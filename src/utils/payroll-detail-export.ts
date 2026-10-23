import {
  commissionCategories,
  commissionRole,
  commissionCountExplanation,
  payrollAppliedRules,
} from '@/utils/payroll-commission-detail'
import type { PayrollRecord } from '@/api/core/payroll'
import { payrollPaid, payrollRemaining, payrollStatusLabel } from '@/utils/payroll-workflow'
import { payrollSalaryItems } from '@/utils/payroll-salary-items'
import { loadPayrollProductUnits, payrollUnitName } from '@/utils/payroll-dictionaries'
import { appendPayrollPaymentEvidence } from '@/utils/payroll-payment-export'
import { businessDateTime } from '@/utils/business-date'

/** Export persisted server evidence for the complete authorized result, never browser calculations. */
export async function buildPayrollWorkbook(records: PayrollRecord[]) {
  await loadPayrollProductUnits()
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
    page.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    page.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF245A86' } }
    page.getRow(1).height = 34
    page.eachRow((row, index) => {
      row.alignment = { vertical: 'middle', wrapText: true }
      if (index > 1) {
        row.height = 32
        row.eachCell((cell, column) => {
          const label = [...headers, ...columns][column - 1] || ''
          if (typeof cell.value === 'number' && label.includes('（元）')) cell.numFmt = '#,##0.00;[Red]-#,##0.00'
          if (typeof cell.value === 'number' && ['完成率', '发放比例', '加权贡献'].some(word => label.includes(word))) cell.numFmt = '0.00%'
          if (typeof cell.value === 'number' && label === '权重（%）') cell.numFmt = '0.00"%"'
        })
      }
    })
    page.views = [{ state: 'frozen', ySplit: 1 }]
    page.columns.forEach((column) => {
      column.width = 22
    })
    page.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1' }
    page.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length + columns.length },
    }
  }
  sheet(
    '薪酬概览',
    [
      '部门',
      '费用归属',
      '薪资标准',
      '底薪（元）',
      '绩效（元）',
      '补贴（元）',
      '提成（元）',
      '补发补扣（元）',
      '其他扣款（元）',
      '应发（元）',
      '应付工资（元）',
      '状态',
      '已登记发放（元）',
      '待发金额（元）',
      '发放凭证',
    ],
    records.map((row) => {
      const c = row.calculation
      return [
        ...identity(row),
        row.departmentName,
        row.calculation.scheme?.scheme.definition.role === 'HEADQUARTERS' ? '总部' : row.cityName,
        c.scheme?.scheme.definition.name || '历史规则',
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
        row.payments?.some(p => p.attachments?.length)
          ? '见发放凭证页' : '-',
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
      '基数单位',
      '标准',
      '标准单位',
      '方法',
      '付清日期',
      '计提金额（元）',
      '本期发放（元）',
      '规则',
      '说明',
      'ERP 分类',
      '规格编码',
      '规则编码',
      '订单日期',
      '订单金额（元）',
      '截至核算日累计回款（元）',
      '截至核算日退款（元）',
      '回款依据截止日期',
    ],
    records.flatMap((row) =>
      row.calculation.details.map((d) => [
        ...identity(row),
        d.orderNo,
        d.productName,
        commissionRole(d.recipientRoleCode),
        d.trace?.cityCode,
        d.quantity,
        payrollUnitName(d.unitCode),
        d.trace?.baseAmount,
        d.trace?.method === 'PERCENT' ? '元' : payrollUnitName(d.unitCode),
        d.trace?.rate,
        d.trace?.method === 'PERCENT' ? '%' : `元/${payrollUnitName(d.unitCode)}`,
        d.trace?.method === 'PERCENT' ? '按金额比例' : d.trace?.method === 'QUANTITY' ? '按商品数量' : '历史快照未记录',
        d.trace?.fullyPaidDate,
        d.accrued,
        d.released,
        d.ruleName,
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
        commissionRole(g.role),
        g.incomplete ? null : g.amount / 100,
        g.releasedIncomplete ? null : g.released / 100,
      ])
    })
  sheet(
    '商品分类汇总',
    [
      'ERP 分类',
      '订单数（笔）',
      '商品提成记录（条）',
      '已计算提成（元）',
      '待核定记录（条）',
      '提成合计（元）',
    ],
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
  workbook.getWorksheet('商品分类汇总')!.getCell('F1').note = commissionCountExplanation
  sheet(
    '实际使用规则',
    ['类型', '规则编码', '规则名称', '生效日期', '结束日期'],
    records.flatMap((row) =>
      payrollAppliedRules(row).map((r) => [
        ...identity(row),
        ({ SALARY: '薪资档案', PERFORMANCE: '绩效规则', ATTENDANCE: '考勤规则',
          ALLOWANCE: '补贴规则', COMMISSION: '提成规则' } as Record<string, string>)[r.kind] || '历史规则',
        r.ruleCode,
        r.name,
        r.effectiveFrom,
        r.effectiveTo,
      ]),
    ),
  )
  sheet('商品型号汇总', ['商品型号', '受益角色', '计提合计（元）', '本期发放（元）'], grouped('product'))
  sheet('商品组汇总', ['规则商品组', '受益角色', '计提合计（元）', '本期发放（元）'], grouped('rule'))
  sheet('城市汇总', ['城市', '受益角色', '计提合计（元）', '本期发放（元）'], grouped('city'))
  sheet(
    '城市总绩效汇总',
    [
      '绩效基数（元）',
      '实际绩效完成率',
      '计分后发放比例／历史综合系数',
      '保护期（天）',
      '考核期（天）',
      '本月绩效（元）',
    ],
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
    ['指标', '实际', '目标', '权重（%）', '完成率（%）', '计分系数', '加权贡献（%）', '依据'],
    records.flatMap((row) =>
      (row.calculation.scheme?.metrics || []).map((m) => [
        ...identity(row),
        m.name,
        m.actual,
        m.target,
        m.weight,
        m.completion,
        m.coefficient ??
          (row.calculation.scheme?.scheme.definition.manager.metrics.find((v) => v.code === m.code)
            ?.scoringMode === 'TIERED'
            ? '待核定'
            : '不适用'),
        m.contribution,
        m.evidence,
      ]),
    ),
  )
  sheet(
    '销售绩效',
    [
      '打卡与有效拜访绩效额度（元）',
      '缺卡与缺拜访扣减（元）',
      '打卡与有效拜访绩效（折算前）（元）',
      '回款达标绩效额度（元）',
      '回款目标（元）',
      '整单付清业绩（元）',
      '回款达标绩效（折算前）（元）',
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
    ['日期', '打卡', '有效拜访', '缺卡', '缺拜访', '原始扣减（封顶前）（元）', '核算状态'],
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
    ['原工资月份', '计入月份', '更正金额（元）', '原因'],
    records.flatMap((row) =>
      (row.calculation.corrections || []).map((c) => [
        ...identity(row),
        c.sourceMonth,
        c.targetMonth,
        c.amount,
        c.reason,
      ]),
    ),
  )
  sheet(
    '核对事项',
    ['说明'],
    records.flatMap((row) => row.calculation.issues.map((issue) => [...identity(row), issue])),
  )
  await appendPayrollPaymentEvidence(workbook, records)
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
  const exportedAt = businessDateTime(new Date()).replaceAll('-', '').replaceAll(':', '').replace(' ', '_')
  anchor.download = `${filename}_${exportedAt}.xlsx`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export const exportPayrollDetails = (row: PayrollRecord) =>
  exportPayrollRecords([row], `薪酬明细-${row.month}-${row.employeeCode}`)
