import { describe, expect, it } from 'vitest'
import type { PayrollRecord } from '@/api/core/payroll'
import { buildPayrollWorkbook } from '@/utils/payroll-detail-export'
import { newPayrollScheme } from '@/utils/payroll-scheme'

const record = (code: string): PayrollRecord => ({
  id: code,
  departmentId: 1,
  revision: 0,
  updatedTime: '2026-10-01T00:00:00Z',
  employeeCode: code,
  employeeName: '员工',
  month: '2026-09',
  statusCode: 'READY',
  departmentName: '销售部',
  cityName: '东莞',
  payments: [],
  calculation: {
    baseSalary: 3000,
    performance: 1000,
    allowance: 750,
    commission: 0.3,
    deduction: 0,
    grossPay: 4750.3,
    netPay: 4750.3,
    issues: [],
    details: [0.1, 0.2].map((amount, i) => ({
      sourceLineId: `${code}-${i}`,
      recipientRoleCode: 'SALES',
      orderNo: `ORDER-${i}`,
      productName: i === 0 ? '=SUM(1,1)' : '方便面另一口味',
      unitCode: 'BOX',
      quantity: 1,
      ruleId: 'noodles',
      ruleName: '方便面',
      ruleRevision: 1,
      accrued: amount,
      released: amount,
      message: '已整单付清',
    })),
    performanceDetail: null,
    heldCommission: 0,
    rules: [],
    sourceFingerprint: 'fixture',
    input: { revision: 0, baseOverride: null, performanceOverride: null, deduction: 0, reason: '' },
  },
})

describe('薪酬 Excel', () => {
  it('导出全部员工与逐笔明细，商品组合计使用分且文本不变成公式', async () => {
    const workbook = await buildPayrollWorkbook([record('A'), record('B')])
    expect(workbook.getWorksheet('薪酬概览')!.rowCount).toBe(3)
    expect(workbook.getWorksheet('商品提成明细')!.rowCount).toBe(5)
    expect(workbook.getWorksheet('商品组汇总')!.getCell('G2').value).toBe(0.3)
    expect(workbook.getWorksheet('商品提成明细')!.getCell('E2').value).toBe('=SUM(1,1)')
    const composition = workbook.getWorksheet('工资组成')!
    const amounts: Record<string, unknown> = {}
    composition.eachRow((row, index) => {
      if (index > 1 && row.getCell(2).value === 'A')
        amounts[String(row.getCell(4).value)] = row.getCell(7).value
    })
    expect(amounts).toMatchObject({
      底薪: 3000,
      绩效: 1000,
      固定补贴: 750,
      商品提成: 0.3,
      应付工资: 4750.3,
      实际发放: 0,
    })
    const buffer = await workbook.xlsx.writeBuffer()
    const { Workbook } = await import('exceljs')
    const restored = new Workbook()
    await restored.xlsx.load(buffer)
    expect(restored.getWorksheet('商品提成明细')!.rowCount).toBe(5)
  })
  it('缺失计提金额保留待核对，不能在商品组合计中伪装成零', async () => {
    const row = record('A')
    row.calculation.details[0]!.accrued = null
    const workbook = await buildPayrollWorkbook([row])
    expect(workbook.getWorksheet('商品组汇总')!.getCell('F2').value).toBe('待核定')
    expect(workbook.getWorksheet('商品组汇总')!.getCell('G2').value).toBe(0.3)
  })
  it('城市总导出综合系数，单项无系数不会误报待核定', async () => {
    const row = record('M')
    row.calculation.performance = 2400
    row.calculation.scheme = {
      scheme: {
        id: 'S',
        schemeId: 'S',
        version: 1,
        revision: 1,
        status: 'PUBLISHED',
        definition: { ...newPayrollScheme(), performanceMode: 'MANAGER' },
        reason: '测试',
        createdBy: 'test',
        publishedBy: 'test',
        updatedTime: '2026-09-01',
        publishedTime: '2026-09-01',
      },
      salaryTier: '',
      achievement: 25386,
      performanceBase: 2000,
      managerCompletion: 1.2693,
      managerCoefficient: 1.2,
      protectedDays: 0,
      assessedDays: 30,
      explanations: [],
      metrics: [
        {
          code: 'PAYMENT',
          name: '回款',
          actual: 25386,
          target: 20000,
          weight: 100,
          completion: 1.2693,
          coefficient: null,
          contribution: 1.2693,
          evidence: '订单服务',
        },
      ],
    }
    const workbook = await buildPayrollWorkbook([row])
    expect(workbook.getWorksheet('城市总绩效汇总')!.getRow(2).values).toEqual([
      undefined,
      '2026-09',
      'M',
      '员工',
      2000,
      1.2693,
      1.2,
      0,
      30,
      2400,
    ])
    expect(workbook.getWorksheet('城市总绩效')!.getRow(2).values).not.toContain('待核定')
    expect(workbook.getWorksheet('每日过程明细')!.getCell('I1').value).toBe('原始扣减（封顶前）')
  })
})
