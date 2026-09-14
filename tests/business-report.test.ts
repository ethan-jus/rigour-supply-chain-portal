import { beforeEach, describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { businessTable, businessMonth } from '@/views/supply-chain/bi/business-report'
import { buildCityProductExcel } from '@/views/supply-chain/bi/city-product-excel'
import { seedBusinessDictionaryForTest } from '@/utils/business-dictionary'
import { cityProductReport, reportRow } from './fixtures/city-product-report'

beforeEach(() =>
  seedBusinessDictionaryForTest('COMMON', 'PRODUCT_UNIT', [
    { code: 'BUCKET', name: '桶' },
    { code: 'BOX', name: '箱' },
  ]),
)
function monthlyReport() {
  const august = reportRow({
    specification: '原味',
    quantity: '12',
    quantities: [{ unitCode: 'BUCKET', quantity: '12' }],
    unitCode: 'BUCKET',
    salesAmount: '78.005',
    paidAmount: null,
    allocatedPaidAmount: null,
    unallocatedOrderCount: 1,
  })
  const september = {
    ...august,
    quantity: '24',
    quantities: [{ unitCode: 'BUCKET', quantity: '24' }],
    salesAmount: '156',
    paidAmount: '100',
    allocatedPaidAmount: null,
    unallocatedOrderCount: 0,
  }
  return cityProductReport({
    from: '2026-07-31T16:00:00Z',
    to: '2026-09-12T15:59:59Z',
    rows: [
      {
        ...august,
        quantity: '36',
        quantities: [{ unitCode: 'BUCKET', quantity: '36' }],
        salesAmount: '234.005',
        paidAmount: '100',
      },
    ],
    monthlyRows: [
      { month: '2026-08', metrics: august },
      { month: '2026-09', metrics: september },
    ],
    customerArchives: [{ regionCode: 'WH', regionName: '武汉', customerCount: 200 }],
  })
}

describe('business reporting from governed order facts', () => {
  it.each(['monthly', 'operating'] as const)(
    'surfaces the Feishu quantity warning in the %s business sheet heading and quantity cells',
    async (businessKind) => {
      const report = monthlyReport()
      report.orderTrace[0].sourceSystemCode = 'FEISHU'
      const original = structuredClone(report)
      const result = await buildCityProductExcel(report, {
        query: {},
        categoryName: '全部分类',
        businessKind,
      })
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.load(result.buffer)
      const sheet = workbook.worksheets[0]
      expect(sheet.getCell('A3').value).toContain('包含飞书导入订单，数量沿用系统原记录')
      const quantityColumns = businessTable(report, businessKind)
        .columns.map((column, index) => ({ ...column, index }))
        .filter((column) => column.type === 'quantity' || column.key === 'quantities')
      expect(quantityColumns.length).toBeGreaterThan(0)
      for (const column of quantityColumns) {
        expect(JSON.stringify(sheet.getCell(5, column.index + 1).note)).toContain(
          '不得直接作为订货箱数',
        )
        expect(JSON.stringify(sheet.getCell(6, column.index + 1).note)).toContain(
          '不得直接作为订货箱数',
        )
      }
      expect(report).toEqual(original)
    },
  )
  it('builds city/product/month matrix, subtotals and total without converting buckets to boxes', () => {
    const report = monthlyReport()
    const original = structuredClone(report)
    const table = businessTable(report, 'monthly')
    expect(table.columns.filter((column) => column.group === '2026-08')).toHaveLength(5)
    expect(table.rows.map((row) => row.kind)).toEqual(['detail', 'subtotal', 'total'])
    expect(table.rows[0].values).toMatchObject({
      unit: '桶',
      specification: '原味',
      '2026-08:quantity': '12',
      '2026-08:paidAmount': null,
      '2026-08:status': '待核对',
      '合计:paidAmount': '100',
      '合计:status': '待核对',
    })
    expect(table.rows[2].values['合计:quantity']).toBe('36 桶')
    expect(report).toEqual(original)
    expect(businessMonth('2026-08-31T16:00:00Z')).toBe('2026-09')
  })

  it('fails closed for old API, missing months, duplicate rows, sample rows and conflicting totals', () => {
    expect(() => businessTable(cityProductReport(), 'monthly')).toThrow('接口尚未更新')
    const report = monthlyReport()
    report.monthlyRows!.pop()
    expect(() => businessTable(report, 'monthly')).toThrow('与汇总不一致')
    const duplicate = monthlyReport()
    duplicate.monthlyRows!.push(duplicate.monthlyRows![0])
    expect(() => businessTable(duplicate, 'monthly')).toThrow('重复')
    const sample = monthlyReport()
    sample.monthlyRows![0].metrics.sample = true
    expect(() => businessTable(sample, 'monthly')).toThrow('包含样例')
  })

  it('does not sum overlapping customer counts or confuse archives with ordering customers', () => {
    const report = monthlyReport()
    report.categoryRows.push(
      reportRow({ categoryId: '2', categoryName: 'ERP分类', salesAmount: '200' }),
    )
    report.orderTrace.push({
      ...report.orderTrace[0],
      orderId: 'o2',
      regionCode: 'BJ',
      regionName: '北京',
    })
    report.customerArchives!.push({ regionCode: 'BJ', regionName: '北京', customerCount: 300 })
    const table = businessTable(report, 'operating')
    const total = table.rows.at(-1)!.values
    expect(total.customers).toBe(1)
    expect(total.orders).toBe(2)
    expect(total.archives).toBe(500)
    expect(total.orderPaid).toBe('200.00')
    expect(table.columns.some((column) => column.label === 'ERP分类销售额（元）')).toBe(true)
    expect(
      businessTable(report, 'operating', {}, true).columns.some(
        (column) => column.key === 'orderPaid',
      ),
    ).toBe(false)
    const legacy = cityProductReport()
    expect(businessTable(legacy, 'operating').rows.at(-1)!.values.archives).toBeNull()
  })

  it('exports merged month headers, business filters, numeric money, null disclosures and trace sheets', async () => {
    const report = monthlyReport()
    const result = await buildCityProductExcel(report, {
      query: { ...report, allocationMode: 'EXACT_ONLY' },
      categoryName: '方便面',
      businessKind: 'monthly',
    })
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(result.buffer)
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      '城市单品月报',
      '城市分类',
      '商品SKU',
      '订单核对',
      '统计口径',
    ])
    const sheet = workbook.worksheets[0]
    expect(sheet.getCell('G4').value).toBe('2026-08')
    expect(sheet.getCell('G4').isMerged).toBe(true)
    expect(sheet.getCell('H6').value).toBe(78.01)
    expect(sheet.getCell('H6').numFmt).toBe('#,##0.00')
    expect(sheet.getCell('I6').value).toBe('未提供')
    expect(sheet.getCell('K6').value).toBe('待核对')
    expect(sheet.getCell('A2').value).toContain('2026-08-01 至 2026-09-12')
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 5, xSplit: 6 })
    expect(sheet.getSheetValues().flat()).not.toContain('BUCKET')
  })

  it('honors selected business headers and rejects zero or obsolete fields', async () => {
    const report = monthlyReport()
    const context = {
      query: { allocationMode: 'EXACT_ONLY' as const },
      categoryName: '方便面',
      businessKind: 'operating' as const,
      businessColumns: ['city', 'sales'],
    }
    const result = await buildCityProductExcel(report, context)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(result.buffer)
    expect(workbook.worksheets[0].columnCount).toBe(2)
    expect(workbook.worksheets[0].getCell('B6').numFmt).toBe('#,##0.00')
    await expect(
      buildCityProductExcel(report, { ...context, businessColumns: [] }),
    ).rejects.toThrow('至少选择一个')
    await expect(
      buildCityProductExcel(report, { ...context, businessColumns: ['cityCode'] }),
    ).rejects.toThrow()
  })
})
