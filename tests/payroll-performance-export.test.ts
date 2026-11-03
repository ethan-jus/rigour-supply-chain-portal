import { beforeEach, afterEach, describe, expect, it } from 'vitest'
import { Workbook } from 'exceljs'
import type { PayrollPerformanceExport, PayrollRecord } from '@/api/core/payroll'
import { appendPayrollPerformance } from '@/utils/payroll-performance-export'
import { clearBusinessDictionariesForTest, seedBusinessDictionaryForTest } from '@/utils/business-dictionary'

beforeEach(() => seedBusinessDictionaryForTest('', 'PRODUCT_UNIT', [{ code: 'SET', name: '套' }, { code: 'BED', name: '床' }]))
afterEach(clearBusinessDictionariesForTest)

const record = {
  id: 'P1',
  revision: 2,
  month: '2026-10',
  employeeCode: 'E1',
  employeeName: '测试销售',
} as PayrollRecord
const report = (): PayrollPerformanceExport => ({
  payrollId: 'P1',
  payrollRevision: 2,
  month: '2026-10',
  employeeCode: 'E1',
  employeeName: '测试销售',
  cityName: '北京',
  categories: [
    { code: 'NOODLES', name: '方便面', salesAmount: 200, collectionAmount: 90, commission: null },
    { code: 'ACCESSORIES', name: '台球周边', salesAmount: 0, collectionAmount: 0, commission: 0 },
    { code: 'CLOTH', name: '台呢', salesAmount: 300, collectionAmount: 410, commission: 15 },
    { code: 'OTHER', name: '其他品类', salesAmount: 0, collectionAmount: 0, commission: 0 },
  ],
  clothSales: [
    {
      code: 'A300_A500',
      name: 'A300/A500B',
      salesAmount: 300,
      quantities: [
        { unitCode: 'SET', quantity: 2 },
        { unitCode: 'BED', quantity: 1 },
      ],
    },
    { code: 'A600_A800', name: 'A600/A700/A800', salesAmount: 0, quantities: [] },
    { code: 'SNOOKER', name: '澳洋斯诺克', salesAmount: 0, quantities: [] },
  ],
  salesAmount: 500,
  collectionAmount: 500,
  refundAmount: 0,
  collectionTarget: 1000,
  salesTarget: 2000,
  commission: null,
  issues: ['提成待核对，详见核对事项'],
  cityCode: 'C1',
  role: 'SALES',
  entryDate: '2026-09-29',
  leaveDate: null,
  summary: {
    expectedDays: 22,
    actualDays: 21,
    expectedCheckins: 140,
    actualCheckins: 137,
    expectedVisits: 60,
    actualVisits: 58,
    processDeduction: 120,
  },
  metrics: [],
  collectionTargetBasis: '入职第二个自然月，按规则考核',
})

describe('项目业绩汇总主表', () => {
  it('匹配业务截图的分组表头，每人一行，品类销售与到账分别取数', async () => {
    const book = new Workbook()
    appendPayrollPerformance(book, [record], [report()])
    const page = book.worksheets[0]!
    expect(page.name).toBe('项目业绩汇总')
    expect(page.getCell('A1').value).toBe('202610供应链项目业绩汇总表')
    expect(page.getCell('M2').master.address).toBe('K2')
    expect(page.getCell('V2').master.address).toBe('Q2')
    expect(page.getCell('A3').master.address).toBe('A2')
    expect(page.getCell('D4').value).toBe(22)
    expect(page.getCell('E4').value).toBe(21)
    expect(page.getCell('J4').value).toBe(120)
    expect(page.getCell('K4').value).toBe(200)
    expect(page.getCell('L4').value).toBe(90)
    expect(page.getCell('Q4').value).toBe('2 套 / 1 床')
    expect(page.getCell('T4').value).toBe(300)
    expect(page.getCell('U4').value).toBe(410)
    expect(page.getCell('X4').value).toBe(500)
    expect(page.getCell('AA4').value).toBe(500)
    expect(page.getCell('Y4').value).toEqual({ formula: 'X4/W4', result: 0.5 })
    expect(page.getCell('AB4').value).toEqual({ formula: 'AA4/Z4', result: 0.25 })
    expect(page.getCell('M4').value).toBe('-')
    expect(page.getCell('P4').value).toBe(0)
    expect(page.getCell('AC4').value).toBe('-')
    expect(page.getCell('AD4').value).toContain('提成待核对')
    expect(page.getRow(2).values.toString()).not.toContain('建联门店')
    expect(page.getRow(2).values.toString()).not.toContain('有效门店')
    expect(page.views[0]).toEqual(expect.objectContaining({ xSplit: 3, ySplit: 3 }))
    const restored = new Workbook()
    await restored.xlsx.load(await book.xlsx.writeBuffer())
    expect(restored.worksheets[0]!.getCell('X3').fill).toEqual(
      expect.objectContaining({ fgColor: { argb: 'FFF8CBAD' } }),
    )
    expect(restored.worksheets[0]!.autoFilter).toBe('A3:AD4')
    expect(restored.worksheets[0]!.getCell('Y4').numFmt).toBe('0.00%')
  })
  it('缺少或零指标不算完成率，同名档案保留员工编号防止合并', () => {
    const first = { ...report(), collectionTarget: null, salesTarget: 0 }
    const second = { ...report(), payrollId: 'P2', employeeCode: 'E2' }
    const book = new Workbook()
    appendPayrollPerformance(
      book,
      [record, { ...record, id: 'P2', employeeCode: 'E2' }],
      [first, second],
    )
    const page = book.worksheets[0]!
    expect(page.getCell('W4').value).toBe('-')
    expect(page.getCell('Y4').value).toBe('-')
    expect(page.getCell('AB4').value).toBe('-')
    expect(page.getCell('AD4').value).toContain('员工编号 E1')
    expect(page.getCell('AD5').value).toContain('员工编号 E2')
  })
  it('不能扩大勾选人员范围，也不能混合不同版本工资或重复行', () => {
    for (const rows of [
      [],
      [report(), report()],
      [{ ...report(), employeeCode: 'OTHER' }],
      [{ ...report(), payrollRevision: 3 }],
    ])
      expect(() => appendPayrollPerformance(new Workbook(), [record], rows)).toThrow(
        '业绩来源与所选工资单不一致',
      )
  })
  it('城市合计保留待核定空值，数量列不能回退成销售额', () => {
    const book = new Workbook()
    appendPayrollPerformance(book, [record], [report()])
    expect(book.getWorksheet('城市业绩汇总')!.getCell('G3').value).toBe(500)
    expect(book.getWorksheet('城市业绩汇总')!.getCell('I3').value).toBe('-')
    const missing = report()
    delete (missing.clothSales[0] as Partial<PayrollPerformanceExport['clothSales'][number]>).quantities
    expect(() => appendPayrollPerformance(new Workbook(), [record], [missing])).toThrow('按单位销量')
  })
  it('单位名称和新增单位从当前字典读取，不依赖床/套映射', () => {
    seedBusinessDictionaryForTest('', 'PRODUCT_UNIT', [{ code: 'SET', name: '业务套装' }, { code: 'BED', name: '整床' }, { code: 'ROLL', name: '卷' }])
    const data = report()
    data.clothSales[0]!.quantities.push({ unitCode: 'ROLL', quantity: 3 })
    const book = new Workbook()
    appendPayrollPerformance(book, [record], [data])
    expect(book.worksheets[0]!.getCell('Q4').value).toBe('2 业务套装 / 1 整床 / 3 卷')
  })
})
