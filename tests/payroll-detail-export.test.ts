import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { PayrollRecord } from '@/api/core/payroll'
import { buildPayrollWorkbook } from '@/utils/payroll-detail-export'
import { newPayrollScheme } from '@/utils/payroll-scheme'
import {
  clearBusinessDictionariesForTest,
  seedBusinessDictionaryForTest,
} from '@/utils/business-dictionary'
const attachments = vi.hoisted(() => ({ content: vi.fn(), link: vi.fn() }))
vi.mock('@/api/core/payroll-payment-attachments', () => ({ payrollPaymentAttachmentContent: attachments.content,
  payrollPaymentAttachmentLink: attachments.link }))

beforeEach(() => {
  attachments.content.mockReset()
  attachments.link.mockReset().mockResolvedValue({ url: 'https://bucket.cos.ap-beijing.myqcloud.com/receipt.pdf?q-signature=example', expiresAt: '2099-10-30T08:00:00Z' })
  clearBusinessDictionariesForTest()
  seedBusinessDictionaryForTest('', 'PRODUCT_UNIT', [{ code: 'BOX', name: '业务整箱' }])
})
afterEach(clearBusinessDictionariesForTest)

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
  it('金额明确人民币元、数值可汇总，所有工作表不导出版本列', async () => {
    const workbook = await buildPayrollWorkbook([record('A')])
    workbook.eachSheet(page => expect(page.getRow(1).values).not.toContain('版本'))
    const page = workbook.getWorksheet('薪酬概览')!
    expect(page.getRow(1).values).toContain('底薪（元）')
    expect(page.getRow(1).values).toContain('应付工资（元）')
    expect(page.getRow(1).values).toContain('发放凭证')
    expect(page.getRow(1).values).not.toContain('凭证图片')
    expect(page.getCell('G2').value).toBe(3000)
    expect(page.getCell('G2').numFmt).toContain('0.00')
  })
  it('发放图片嵌入Excel，PDF为七天签名链接，无文件显示短横线且不导出历史凭证号', async () => {
    const row = record('A')
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aC5sAAAAASUVORK5CYII='), c => c.charCodeAt(0))
    attachments.content.mockResolvedValue(new Blob([png], { type: 'image/png' }))
    row.payments = [{ id: 'P1', requestId: 'R1', paidDate: '2026-10-21', amount: 3000,
      referenceNo: 'BANK-20261021', reason: '发放登记', createdTime: '2026-10-21T03:00:00Z',
      attachments: [
        { id: 'F1', fileName: '银行回单.png', contentType: 'image/png', size: png.length, createdBy: 'U', createdByName: '李四', createdTime: '2026-10-21T03:00:00Z' },
        { id: 'F2', fileName: '汇总.pdf', contentType: 'application/pdf', size: 100, createdBy: 'U', createdByName: '李四', createdTime: '2026-10-21T03:00:00Z' },
      ] }]
    const old = record('C')
    old.payments = [{ id: 'P0', requestId: 'R0', paidDate: '2026-09-30', amount: 100,
      referenceNo: 'OLD-REFERENCE', reason: '', createdTime: '2026-09-30T00:00:00Z' }]
    const workbook = await buildPayrollWorkbook([row, record('B'), old])
    expect(attachments.content).toHaveBeenCalledExactlyOnceWith('A', 'P1', 'F1')
    const receipts = workbook.getWorksheet('发放凭证')!
    expect(receipts.getImages()).toHaveLength(1)
    expect(receipts.getCell('E2').value).toBe(3000)
    expect(receipts.getCell('E3').master.address).toBe('E2')
    expect(receipts.getCell('A3').master.address).toBe('A2')
    expect(receipts.autoFilter).toBeNull()
    expect(receipts.getCell('F3').value).toEqual(expect.objectContaining({ text: '汇总.pdf', hyperlink: expect.stringContaining('https://') }))
    expect(receipts.getCell('H3').value).toBe('2099-10-30 16:00:00')
    expect(attachments.link).toHaveBeenCalledExactlyOnceWith('A', 'P1', 'F2')
    expect(JSON.stringify(receipts.getSheetValues())).not.toContain('BANK-20261021')
    const { Workbook } = await import('exceljs')
    const restored = new Workbook()
    await restored.xlsx.load(await workbook.xlsx.writeBuffer())
    expect(restored.getWorksheet('发放凭证')!.getImages()).toHaveLength(1)
    expect(restored.getWorksheet('发放凭证')!.getImages()[0]!.range.br).toBeDefined()
    expect(restored.getWorksheet('薪酬概览')!.getCell('R2').value).toEqual(
      { formula: 'HYPERLINK("#\'发放凭证\'!F2","见发放凭证页")', result: '见发放凭证页' })
    expect(restored.getWorksheet('薪酬概览')!.getCell('R2').hyperlink).toBeUndefined()
    expect(restored.getWorksheet('发放凭证')!.getCell('F3').value).toEqual(expect.objectContaining({ hyperlink: expect.stringContaining('q-signature=example') }))
    expect(workbook.getWorksheet('薪酬概览')!.getCell('R3').value).toBe('-')
    expect(receipts.getCell('G3').value).toBe('-')
    expect(receipts.getCell('F4').value).toBe('-')
    expect(receipts.getCell('G4').value).toBe('-')
    expect(JSON.stringify(receipts.getSheetValues())).not.toContain('OLD-REFERENCE')
    attachments.content.mockRejectedValue(new Error('403'))
    await expect(buildPayrollWorkbook([row])).rejects.toThrow('导出未完成')
  })
  it('同笔多凭证合并基本信息，多笔发放保持独立且金额不重复', async () => {
    const row = record('A')
    const pdf = (id: string) => ({ id, fileName: `${id}.pdf`, contentType: 'application/pdf', size: 100,
      createdBy: 'U', createdByName: '李四', createdTime: '2026-10-21T03:00:00Z' })
    row.payments = [
      { id: 'P1', requestId: 'R1', paidDate: '2026-10-20', amount: 2000, referenceNo: '', reason: '',
        createdTime: '', attachments: [pdf('F1'), pdf('F2')] },
      { id: 'P2', requestId: 'R2', paidDate: '2026-10-21', amount: 1000, referenceNo: '', reason: '',
        createdTime: '', attachments: [pdf('F3'), pdf('F4')] },
    ]
    const workbook = await buildPayrollWorkbook([row])
    const { Workbook } = await import('exceljs')
    const restored = new Workbook()
    await restored.xlsx.load(await workbook.xlsx.writeBuffer())
    const page = restored.getWorksheet('发放凭证')!
    expect(page.getCell('C3').master.address).toBe('C2')
    expect(page.getCell('C5').master.address).toBe('C4')
    expect(page.getCell('D2').value).toBe('2026-10-20')
    expect(page.getCell('D4').value).toBe('2026-10-21')
    expect([2, 4].reduce((sum, index) => sum + Number(page.getCell(index, 5).value), 0)).toBe(3000)
    expect([2, 3, 4, 5].map(index => page.getCell(index, 6).text)).toEqual(['F1.pdf', 'F2.pdf', 'F3.pdf', 'F4.pdf'])
    expect(page.getCell('F3').master.address).toBe('F3')
    expect(page.getCell('F3').hyperlink).toContain('q-signature=example')
  })
  it('签名链接失败或已过期时停止导出，不生成无法打开的凭证文件名', async () => {
    const row = record('A')
    row.payments = [{ id: 'P', requestId: 'R', paidDate: '2026-09-30', amount: 100, referenceNo: '',
      reason: '', createdTime: '2026-09-30T00:00:00Z', attachments: [{ id: 'F', fileName: '回单.pdf',
        contentType: 'application/pdf', size: 10, createdBy: 'U', createdByName: '李四', createdTime: '2026-09-30T00:00:00Z' }] }]
    const pdfOnly = await buildPayrollWorkbook([row])
    expect(pdfOnly.getWorksheet('薪酬概览')!.getCell('R2').value).toEqual(
      { formula: 'HYPERLINK("#\'发放凭证\'!F2","见发放凭证页")', result: '见发放凭证页' })
    expect(pdfOnly.getWorksheet('发放凭证')!.getImages()).toHaveLength(0)
    for (const link of [{ url: 'javascript:alert(1)', expiresAt: '2099-01-01' },
      { url: 'https://example.com/pdf', expiresAt: '2020-01-01' }]) {
      attachments.link.mockResolvedValue(link)
      await expect(buildPayrollWorkbook([row])).rejects.toThrow('链接生成失败')
    }
    attachments.link.mockRejectedValue(new Error('403'))
    await expect(buildPayrollWorkbook([row])).rejects.toThrow('导出未完成')
  })
  it('总部薪酬按总部归属导出，规则类型为中文', async () => {
    const row = record('HQ')
    row.cityName = null
    row.calculation.scheme = { scheme: { definition: { ...newPayrollScheme(), role: 'HEADQUARTERS' } },
      appliedRules: [{ kind: 'SALARY', versionId: 'S', ruleCode: 'SAL-1', name: '薪资标准',
        effectiveFrom: '2026-09-01', effectiveTo: '2026-09-30' }] } as NonNullable<typeof row.calculation.scheme>
    const workbook = await buildPayrollWorkbook([row])
    expect(workbook.getWorksheet('薪酬概览')!.getCell('E2').value).toBe('总部')
    expect(workbook.getWorksheet('实际使用规则')!.getCell('D2').value).toBe('薪资档案')
  })
  it('导出全部员工与逐笔明细，商品组合计使用分且文本不变成公式', async () => {
    const workbook = await buildPayrollWorkbook([record('A'), record('B')])
    expect(workbook.getWorksheet('薪酬概览')!.rowCount).toBe(3)
    expect(workbook.getWorksheet('商品提成明细')!.rowCount).toBe(5)
    expect(workbook.getWorksheet('商品组汇总')!.getCell('G2').value).toBe(0.3)
    expect(workbook.getWorksheet('商品提成明细')!.getCell('E2').value).toBe('=SUM(1,1)')
    expect(workbook.getWorksheet('商品提成明细')!.getCell('I2').value).toBe('业务整箱')
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
    const categories = restored.getWorksheet('商品分类汇总')!
    expect(categories.getCell('E1').value).toBe('订单数（笔）')
    expect(categories.getCell('F1').value).toBe('商品提成记录（条）')
    expect(JSON.stringify(categories.getCell('F1').note)).toContain('不是商品件数')
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
        definition: {
          ...newPayrollScheme(),
          performanceMode: 'MANAGER',
          manager: { ...newPayrollScheme().manager, calculationMode: 'TIERED' },
        },
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
    expect(workbook.getWorksheet('每日过程明细')!.getCell('I1').value).toBe('原始扣减（封顶前）（元）')
  })
})
