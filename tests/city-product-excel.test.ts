import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { beforeEach, describe, expect, it } from 'vitest'
import { seedBusinessDictionaryForTest } from '@/utils/business-dictionary'
import {
  buildCityProductExcel,
  resolveCityProductColumns,
} from '@/views/supply-chain/bi/city-product-excel'
import {
  cityProductColumns,
  cityProductMetricDefinitions,
} from '@/views/supply-chain/bi/city-product-export'
import { cityProductReport, reportRow } from './fixtures/city-product-report'

const context = {
  query: {
    from: '2026-09-01T00:00:00Z',
    to: '2026-09-12T23:59:59Z',
    productCategoryId: '001',
    regionCode: 'WH',
    ownerStaffCode: 'E001',
    customerTypeCode: 'STORE',
    sourceSystemCode: 'DHB',
  },
  categoryName: '方便面',
  labels: {
    region: [{ value: 'WH', label: '武汉' }],
    owner: [{ value: 'E001', label: '张三' }],
    customerType: [{ value: 'STORE', label: '门店' }],
    source: [{ value: 'DHB', label: '订货宝' }],
  },
}
beforeEach(() =>
  seedBusinessDictionaryForTest('COMMON', 'PRODUCT_UNIT', [
    { code: 'BOX', name: '箱' },
    { code: 'BOTTLE', name: '瓶' },
    { code: 'BUCKET', name: '桶' },
  ]),
)
const headers = (sheet: ExcelJS.Worksheet) => sheet.getRow(1).values as ExcelJS.CellValue[]
const cell = (sheet: ExcelJS.Worksheet, label: string, row = 2) =>
  sheet.getCell(row, headers(sheet).indexOf(label))
function statsValue(sheet: ExcelJS.Worksheet, label: string) {
  for (let index = 2; index <= sheet.rowCount; index++)
    if (sheet.getCell(index, 1).value === label) return sheet.getCell(index, 2).value
  throw new Error(`Missing metadata: ${label}`)
}
async function readWorkbook(result: Awaited<ReturnType<typeof buildCityProductExcel>>) {
  const directory = await mkdtemp(join(tmpdir(), 'city-product-excel-'))
  try {
    const path = join(directory, 'report.xlsx')
    await writeFile(path, new Uint8Array(result.buffer))
    const bytes = await readFile(path)
    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(path)
    return workbook
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

describe('city product real XLSX export', () => {
  it('adds a source-level Feishu notice to every detail sheet and quantity note without changing data or money', async () => {
    const report = cityProductReport()
    report.orderTrace.push({
      ...report.orderTrace[0],
      orderId: 'feishu-order',
      sourceSystemCode: 'FEISHU',
    })
    const original = structuredClone(report)
    const workbook = await readWorkbook(await buildCityProductExcel(report, context))
    const notice =
      '包含飞书导入订单，数量沿用系统原记录，交易单位/包装换算尚未核验；不得直接作为订货箱数。'
    for (const name of ['城市分类', '商品SKU', '订单核对']) {
      const sheet = workbook.getWorksheet(name)!
      expect(sheet.getCell('A1').value).toBe(notice)
      expect(sheet.getCell('A1').alignment.wrapText).toBe(true)
      expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 2 })
      expect(sheet.pageSetup.printTitlesRow).toBe('1:2')
    }
    const sheet = workbook.getWorksheet('商品SKU')!
    const labels = sheet.getRow(2).values as ExcelJS.CellValue[]
    const quantity = sheet.getCell(3, labels.indexOf('订货数量（未扣退货）'))
    const amount = sheet.getCell(3, labels.indexOf('商品销售额（元）'))
    expect(quantity.value).toBe(2.5)
    expect(JSON.stringify(quantity.note)).toContain(notice)
    expect(JSON.stringify(sheet.getCell(2, quantity.col).note)).toContain(notice)
    expect(amount.value).toBe(100.13)
    expect(amount.numFmt).toBe('#,##0.00')
    expect(sheet.rowCount).toBe(report.rows.length + 2)
    expect(workbook.getWorksheet('订单核对')!.rowCount).toBe(report.orderTrace.length + 2)
    expect(report).toEqual(original)
  })
  it('keeps quantity precision notes alongside the Feishu source warning even for custom export columns', async () => {
    const report = cityProductReport({ rows: [reportRow({ quantity: '0.1234567890123456789' })] })
    report.orderTrace[0].sourceSystemCode = 'FEISHU'
    const workbook = await readWorkbook(
      await buildCityProductExcel(report, { ...context, selectedColumns: { rows: ['quantity'] } }),
    )
    const sheet = workbook.getWorksheet('商品SKU')!
    expect(sheet.getCell('A1').value).toContain('包含飞书导入订单')
    expect(sheet.getCell('A3').value).toBe('0.1234567890123456789')
    expect(JSON.stringify(sheet.getCell('A3').note)).toContain('15 位')
    expect(JSON.stringify(sheet.getCell('A3').note)).toContain('不得直接作为订货箱数')
    expect(sheet.getRow(1).height).toBeGreaterThan(48)
  })
  it.each(['DHB', 'DINGHUOBAO', 'MANUAL', 'UNKNOWN'])(
    'does not add a Feishu warning when complete order traces only contain %s',
    async (sourceSystemCode) => {
      const report = cityProductReport()
      report.orderTrace[0].sourceSystemCode = sourceSystemCode
      const workbook = await readWorkbook(await buildCityProductExcel(report, context))
      for (const sheet of workbook.worksheets) {
        expect(JSON.stringify(sheet.getSheetValues())).not.toContain('包含飞书导入订单')
        sheet.eachRow((row) =>
          row.eachCell((cell) =>
            expect(JSON.stringify(cell.note) || '').not.toContain('不得直接作为订货箱数'),
          ),
        )
      }
      const sheet = workbook.getWorksheet('商品SKU')!
      expect(cell(sheet, '订货数量（未扣退货）').value).toBe(2.5)
      expect(cell(sheet, '商品销售额（元）').value).toBe(100.13)
    },
  )
  it('renders single business-day filters and order traces in Shanghai while retaining source instants', async () => {
    const report = cityProductReport({
      from: '2026-08-31T16:00:00Z',
      to: '2026-09-01T15:59:59.999999Z',
    })
    report.orderTrace[0].orderDate = '2026-08-31T16:00:00Z'
    const original = structuredClone(report)
    const result = await buildCityProductExcel(report, context)
    expect(result.filename).toBe('城市商品报表-方便面-2026-09-01-2026-09-01.xlsx')
    const workbook = await readWorkbook(result)
    const stats = workbook.getWorksheet('统计口径')!
    expect(statsValue(stats, '开始时间（北京时间）')).toBe('2026-09-01 00:00:00')
    expect(statsValue(stats, '结束时间（北京时间）')).toBe('2026-09-01 23:59:59')
    expect(cell(workbook.getWorksheet('订单核对')!, '订单日期（北京时间）').value).toBe(
      '2026-09-01 00:00:00',
    )
    expect(report).toEqual(original)
  })
  it('writes and reloads four complete sheets with typed decimals, zero/null, IDs and incomplete attribution', async () => {
    const report = cityProductReport({
      generatedAt: '2026-09-12T08:30:42Z',
      dataUpdatedAt: '2026-09-12T07:00:00Z',
      rows: Array.from({ length: 1203 }, (_, index) =>
        reportRow({
          skuCode: `SKU-${index}`,
          productId: '000900719925474099312345',
          paidAmount: index === 0 ? 0 : null,
          allocatedPaidAmount: 0,
          unallocatedOrderCount: index === 0 ? 0 : 2,
          quantity: '1.234e-7',
          refundAmount: '-10.07500',
        }),
      ),
      categoryRows: [
        reportRow({
          unitCode: null,
          quantity: null,
          quantities: [
            { unitCode: 'BOX', quantity: '2.500' },
            { unitCode: 'BOTTLE', quantity: '12.125' },
          ],
        }),
      ],
    })
    const original = structuredClone(report)
    const result = await buildCityProductExcel(report, context)
    expect(result.filename).toBe('城市商品报表-方便面-2026-09-01-2026-09-13.xlsx')
    const workbook = await readWorkbook(result)
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      '城市分类',
      '商品SKU',
      '订单核对',
      '统计口径',
    ])
    const [category, sku, trace, stats] = workbook.worksheets
    expect(sku.rowCount).toBe(1204)
    expect(category.rowCount).toBe(2)
    expect(trace.rowCount).toBe(2)
    expect(cell(sku, '商品名称', 1204).value).toBe(report.rows[1202].productName)
    expect(headers(category).slice(1, 8)).toEqual([
      '城市名称',
      '分类名称',
      '订货数量（分单位，未扣退货）',
      '商品销售额（元）',
      '已归属应收额（元）',
      '已归属回款额（元）',
      '其中分摊回款（元）',
    ])
    for (const sheet of [category, sku, trace])
      expect(headers(sheet).join('|')).not.toMatch(/ID|编码/)
    expect(cell(sku, '商品销售额（元）').type).toBe(ExcelJS.ValueType.Number)
    expect(cell(sku, '商品销售额（元）').value).toBe(100.13)
    expect(cell(sku, '商品销售额（元）').numFmt).toBe('#,##0.00')
    expect(cell(sku, '退款额（元）').value).toBe(-10.08)
    expect(cell(sku, '订货数量（未扣退货）').value).toBe(0.0000001234)
    expect(cell(sku, '已归属回款额（元）').value).toBe(0)
    expect(cell(sku, '已归属回款额（元）').type).toBe(ExcelJS.ValueType.Number)
    expect(cell(sku, '回款核对状态').value).toBe('已归属')
    expect(cell(sku, '已归属回款额（元）', 3).value).toBeNull()
    expect(cell(sku, '已归属回款额（元）', 3).type).toBe(ExcelJS.ValueType.Null)
    expect(cell(sku, '待核对订单数', 3).value).toBe(2)
    expect(cell(sku, '回款核对状态', 3).value).toBe('未完整')
    expect(headers(category)).not.toContain('订货数量（未扣退货）')
    expect(cell(category, '订货数量（分单位，未扣退货）').value).toBe('箱: 2.5；瓶: 12.125')
    expect(cell(trace, '未归属回款（元）').value).toBe(49.99)
    expect(cell(trace, '来源系统').value).toBe('订货宝')
    expect(cell(trace, '责任销售').value).toBe('张三')
    expect(cell(trace, '订单应收与整单行金额差额（元）').value).toBe(0)
    for (const sheet of workbook.worksheets) {
      expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 })
      expect(sheet.autoFilter).toBeTruthy()
      expect(sheet.getColumn(1).width).toBeGreaterThan(20)
      expect(sheet.getCell('A1').font.bold).toBe(true)
    }
    expect(statsValue(stats, '生成时间（北京时间）')).toBe('2026-09-12 16:30:42')
    expect(statsValue(stats, '数据最近同步时间（北京时间）')).toBe('2026-09-12 15:00:00')
    expect(statsValue(stats, '分类筛选名称')).toBe('方便面')
    expect(statsValue(stats, '回款分摊口径')).toBe('不分摊（仅精确归属）')
    expect(statsValue(stats, '商品回款完整性')).toBe('归属未完整')
    expect(statsValue(stats, '未归属说明')).toContain('空金额不是零')
    expect(statsValue(stats, '商品口径未归属回款（元）')).toBe(49.99)
    const texts = stats.getSheetValues().flat().join('|')
    for (const definition of cityProductMetricDefinitions) expect(texts).toContain(definition)
    for (const value of ['武汉', '张三', '门店', '订货宝']) expect(texts).toContain(value)
    expect(texts).not.toMatch(/E001|regionCode|EXACT_ONLY|分类筛选ID|skuCode/)
    expect(report).toEqual(original)
  })

  it('preserves precision overflow as original text with notes and a warning register', async () => {
    const result = await buildCityProductExcel(
      cityProductReport({
        rows: [
          reportRow({
            salesAmount: '9007199254740993.123456789',
            paidAmount: '0.1234567890123456',
            salesNetAmount: '1234567890123.45',
            refundAmount: '1e-40',
          }),
        ],
      }),
      context,
    )
    const workbook = await readWorkbook(result)
    const sku = workbook.getWorksheet('商品SKU')!
    expect(cell(sku, '商品销售额（元）').value).toBe('9007199254740993.12')
    expect(cell(sku, '已归属回款额（元）').value).toBe(0.12)
    expect(cell(sku, '商品销售额（元）').type).toBe(ExcelJS.ValueType.String)
    expect(JSON.stringify(cell(sku, '商品销售额（元）').note)).toContain('15 位')
    expect(cell(sku, '扣退款行金额（元）').type).toBe(ExcelJS.ValueType.Number)
    expect(result.precisionWarningCount).toBe(1)
    expect(statsValue(workbook.getWorksheet('统计口径')!, '超出安全精度单元格数')).toBe(1)
  })

  it('stores unsafe text as literal strings, never formulas or hyperlinks', async () => {
    const payloads = [
      '=SUM(A1)',
      '+cmd',
      '-cmd',
      '@SUM(A1)',
      ' \t=1+1',
      '\r\n@cmd',
      '\uFEFF=1',
      '=1,"x"\nnext',
    ]
    const report = cityProductReport({
      rows: payloads.map((productName) => reportRow({ productName })),
      definitions: ['\t=HYPERLINK("https://invalid.example")'],
    })
    const workbook = await readWorkbook(
      await buildCityProductExcel(report, { ...context, categoryName: '@危险分类' }),
    )
    const sku = workbook.getWorksheet('商品SKU')!
    payloads.forEach((payload, index) => {
      // XML readers normalize line endings; the entire payload remains a literal string.
      expect(cell(sku, '商品名称', index + 2).value).toBe(payload.replace(/\r\n?/g, '\n'))
      expect(cell(sku, '商品名称', index + 2).type).toBe(ExcelJS.ValueType.String)
    })
    expect(statsValue(workbook.getWorksheet('统计口径')!, '分类筛选名称')).toBe('@危险分类')
    for (const sheet of workbook.worksheets)
      sheet.eachRow((row) =>
        row.eachCell((value) => {
          expect(value.formula).toBeUndefined()
          expect(value.hyperlink).toBeUndefined()
        }),
      )
  })

  it('keeps proportional attribution separate and changes columns without filtering rows', async () => {
    const report = cityProductReport({
      allocationMode: 'PROPORTIONAL',
      rows: Array.from({ length: 1203 }, (_, i) => reportRow({ productName: `商品-${i}` })),
    })
    const selectedColumns = {
      categoryRows: ['regionName', 'paidAmount'],
      rows: ['productName'],
      orderTrace: ['sourceOrderNo', 'unallocatedPaidAmount'],
    }
    const workbook = await readWorkbook(
      await buildCityProductExcel(report, {
        ...context,
        query: { ...context.query, allocationMode: 'PROPORTIONAL' },
        selectedColumns,
      }),
    )
    expect(headers(workbook.getWorksheet('城市分类')!).slice(1)).toEqual([
      '城市名称',
      '已归属回款额（元）',
    ])
    expect(cell(workbook.getWorksheet('城市分类')!, '已归属回款额（元）').value).toBe(30.01)
    expect(workbook.getWorksheet('商品SKU')!.columnCount).toBe(1)
    expect(workbook.getWorksheet('商品SKU')!.rowCount).toBe(1204)
    expect(workbook.getWorksheet('商品SKU')!.getCell('A1204').value).toBe('商品-1202')
    const stats = workbook.getWorksheet('统计口径')!
    expect(statsValue(stats, '回款分摊口径')).toBe('按商品金额比例分摊')
    expect(statsValue(stats, '商品SKU实际导出字段')).toBe('商品名称')
    expect(statsValue(stats, '商品口径其中分摊回款（元）')).toBe(10.01)
    expect(statsValue(stats, '回款定义')).toContain('二者不可相加')
  })

  it('defaults all columns and rejects invalid or empty selections', async () => {
    expect(resolveCityProductColumns()).toEqual(cityProductColumns)
    for (const selectedColumns of [
      { rows: [] },
      { categoryRows: ['__proto__'] },
      { orderTrace: ['nonexistent'] },
    ])
      await expect(
        buildCityProductExcel(cityProductReport(), { ...context, selectedColumns }),
      ).rejects.toThrow(/字段/)
  })

  it('retains empty sheets when another sheet has data', async () => {
    const workbook = await readWorkbook(
      await buildCityProductExcel(cityProductReport({ categoryRows: [], rows: [] }), context),
    )
    expect(workbook.getWorksheet('城市分类')!.rowCount).toBe(1)
    expect(workbook.getWorksheet('商品SKU')!.rowCount).toBe(1)
    expect(workbook.getWorksheet('订单核对')!.rowCount).toBe(2)
  })

  it.each([
    { truncated: true },
    { exportBlocked: true },
    { sample: true },
    { summary: null },
    { rows: [], categoryRows: [], orderTrace: [] },
  ])('rejects unusable reports: %j', async (overrides) => {
    await expect(buildCityProductExcel(cityProductReport(overrides), context)).rejects.toThrow()
  })

  it('rejects invalid monetary values, mode mismatch and overlong text instead of truncating', async () => {
    await expect(
      buildCityProductExcel(
        cityProductReport({ rows: [reportRow({ salesAmount: '=1+1' })] }),
        context,
      ),
    ).rejects.toThrow('无效数值')
    await expect(
      buildCityProductExcel(cityProductReport({ allocationMode: 'PROPORTIONAL' }), context),
    ).rejects.toThrow('口径')
    await expect(
      buildCityProductExcel(
        cityProductReport({ rows: [reportRow({ productName: 'x'.repeat(32768) })] }),
        context,
      ),
    ).rejects.toThrow('未截断')
  })
})
