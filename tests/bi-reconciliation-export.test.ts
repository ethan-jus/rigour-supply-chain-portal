import ExcelJS from 'exceljs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  ReconciliationFact,
  ReconciliationPage,
  ReconciliationQuery,
  ReconciliationRow,
} from '@/api/core/bi-reconciliation-review'
import { getReconciliationReview } from '@/api/core/bi-reconciliation-review'
import {
  buildReconciliationExcel,
  readReconciliationExport,
} from '@/views/supply-chain/bi/reconciliation-export'

vi.mock('@/api/core/bi-reconciliation-review', () => ({ getReconciliationReview: vi.fn() }))
function fact(overrides: Partial<ReconciliationFact> = {}): ReconciliationFact {
  return {
    key: 'internal-fact',
    orderNo: '000001',
    kind: 'SKU',
    city: '武汉',
    sales: '销售甲',
    customer: '客户甲',
    product: '商品甲',
    specification: '500ml',
    unit: '箱',
    orderDate: null,
    amount: '100.125',
    paid: '0',
    unpaid: '100.125',
    quantity: '2.5',
    updatedAt: null,
    sourceRows: 'internal-source-rows',
    excludedRefund: false,
    uncertainties: [],
    unitEvidence: 'COLUMN_INFERRED',
    associationEvidence: 'EXACT_NAME_SPEC',
    sourceRecordId: 'internal-record',
    sourceProductId: 'internal-product',
    sourceProductCode: 'internal-code',
    ...overrides,
  }
}
function row(overrides: Partial<ReconciliationRow> = {}): ReconciliationRow {
  return {
    key: 'internal-row',
    orderNo: '000001',
    kind: 'SKU',
    city: '武汉',
    sales: '销售甲',
    status: 'UNVERIFIED',
    versionStatus: 'NOT_COMPARED',
    financialStatus: 'SNAPSHOT_MATCH',
    quantityStatus: 'UNVERIFIED',
    associationStatus: 'UNVERIFIED',
    source: fact(),
    business: fact({ unit: '桶', unitEvidence: 'SYSTEM', associationEvidence: 'SYSTEM' }),
    bi: fact({ unit: '桶', unitEvidence: 'SYSTEM', associationEvidence: 'SYSTEM' }),
    previous: null,
    issues: [],
    ...overrides,
  }
}
function review(overrides: Partial<ReconciliationPage> = {}): ReconciliationPage {
  return {
    id: 'internal-review',
    from: '2026-09-01T00:00:00+08:00',
    to: '2026-09-14T23:59:59+08:00',
    capturedAt: '2026-09-14T08:00:00Z',
    completedAt: '2026-09-14T08:01:00Z',
    sourceVersion: {
      batchId: 'internal-batch',
      fileName: '来源.xlsx',
      checksum: 'hash',
      sourceUrl: null,
      uploadedAt: '2026-09-14T08:00:00Z',
      importStatus: 'PREFLIGHTED',
      rowCount: 3,
    },
    previousVersion: null,
    onlineStatus: 'UNVERIFIED',
    status: 'UNVERIFIED',
    sourceDeclaredComplete: false,
    sourceExportedAt: null,
    notices: [],
    summary: {
      count: 2242,
      matched: 0,
      differences: 1915,
      unverified: 327,
      excluded: 15,
      sourceAmount: '730067.52',
      businessAmount: '730067.52',
      biAmount: '730067.52',
      sourcePaid: '407864.13',
      businessPaid: '407864.13',
      biPaid: '407864.13',
    },
    cities: [],
    sales: [],
    total: 1,
    page: 1,
    pageSize: 50,
    rows: [row()],
    ...overrides,
  }
}
const query: ReconciliationQuery = { kind: 'SKU', page: 1, pageSize: 50 }
async function workbook(data: ReconciliationPage, selection = query) {
  const output = await buildReconciliationExcel(data, selection)
  const result = new ExcelJS.Workbook()
  await result.xlsx.load(output.buffer)
  return result
}
function cell(sheet: ExcelJS.Worksheet, header: string, row = 2) {
  const column = (sheet.getRow(1).values as ExcelJS.CellValue[]).indexOf(header)
  expect(column, header).toBeGreaterThan(0)
  return sheet.getCell(row, column)
}
beforeEach(() => vi.clearAllMocks())

describe('reconciliation Excel export', () => {
  it('preserves original quantities, inferred units and real money with separate conclusions and no trace IDs', async () => {
    const data = review()
    const original = structuredClone(data)
    const output = await workbook(data)
    const sheet = output.getWorksheet('SKU比较组复核')!
    expect(cell(sheet, '来源订单').value).toBe('000001')
    expect(cell(sheet, '来源原始数量').value).toBe(2.5)
    expect(cell(sheet, '来源原始单位').value).toBe('箱')
    expect(cell(sheet, '业务系统原始数量').value).toBe(2.5)
    expect(cell(sheet, '业务系统原始单位').value).toBe('桶')
    expect(cell(sheet, '来源单位依据').value).toBe('由数量列名推断')
    expect(cell(sheet, '来源关联依据').value).toBe('名称规格匹配（关联待确认）')
    expect(cell(sheet, '金额核对').value).toBe('所选快照一致')
    expect(cell(sheet, '数量 / 单位核对').value).toBe('待核验')
    expect(cell(sheet, '业务归属 / 商品关联').value).toBe('待核验')
    expect(cell(sheet, '来源证据提醒').value).toContain('未进行数量换算')
    expect(cell(sheet, '来源商品组金额（元）').value).toBe(100.13)
    expect(cell(sheet, '来源商品组金额（元）').numFmt).toBe('#,##0.00')
    const text = output.worksheets.map((s) => JSON.stringify(s.getSheetValues())).join('\n')
    expect(text).toContain('2242')
    expect(text).toContain('1 个 SKU 比较组')
    expect(text).toContain('730067.52')
    expect(text).not.toMatch(/internal-|COLUMN_INFERRED|EXACT_NAME_SPEC|SNAPSHOT_MATCH|UNVERIFIED/)
    expect(sheet.getRow(1).values?.toString()).not.toMatch(/ID|标识|编码/)
    expect(data).toEqual(original)
  })
  it('retains order receivable, paid and unpaid while quantity is not applicable', async () => {
    const data = review({
      rows: [
        row({
          kind: 'ORDER',
          status: 'UNVERIFIED',
          quantityStatus: 'NOT_APPLICABLE',
          source: fact({ kind: 'ORDER' }),
        }),
      ],
    })
    const output = await workbook(data, { ...query, kind: 'ORDER' })
    const sheet = output.getWorksheet('订单复核')!
    expect(cell(sheet, '来源订单应收（元）').value).toBe(100.13)
    expect(cell(sheet, '来源累计回款（元）').value).toBe(0)
    expect(cell(sheet, '来源待回款（元）').value).toBe(100.13)
    expect(cell(sheet, '数量 / 单位核对').value).toBe('不适用（订单数量不汇总）')
    expect(cell(sheet, '综合结论').value).toBe('待核验')
    expect(cell(sheet, '金额核对').value).toBe('所选快照一致')
  })
  it('keeps confirmed money differences, refund evidence, missing values and unassessed history distinct', async () => {
    const data = review({
      total: 3,
      rows: [
        row({ financialStatus: 'DIFF', status: 'DIFF', source: fact({ amount: '-10.075' }) }),
        row({
          key: 'refund',
          status: 'EXCLUDED_REFUND',
          financialStatus: 'EXCLUDED_REFUND',
          source: fact({ amount: '12.345', excludedRefund: true }),
        }),
        row({
          key: 'old',
          status: 'SNAPSHOT_MATCH',
          financialStatus: null,
          quantityStatus: undefined,
          associationStatus: null,
          source: fact({
            amount: null,
            quantity: null,
            unitEvidence: null,
            associationEvidence: null,
          }),
        }),
      ],
    })
    const sheet = (await workbook(data)).getWorksheet('SKU比较组复核')!
    expect(cell(sheet, '金额核对').value).toBe('存在差异')
    expect(cell(sheet, '来源商品组金额（元）').value).toBe(-10.08)
    expect(cell(sheet, '金额核对', 3).value).toBe('退款排除')
    expect(cell(sheet, '来源商品组金额（元）', 3).value).toBe(12.35)
    expect(cell(sheet, '金额核对', 4).value).toBe('未单独评估')
    expect(cell(sheet, '数量 / 单位核对', 4).value).toBe('未单独评估')
    expect(cell(sheet, '业务归属 / 商品关联', 4).value).toBe('未单独评估')
    expect(cell(sheet, '来源商品组金额（元）', 4).value).toBe('未提供')
    expect(cell(sheet, '来源原始数量', 4).value).toBe('未提供')
  })
  it('preserves large decimals as annotated text and formula-like business text as literal cells', async () => {
    const sheet = (
      await workbook(
        review({
          rows: [
            row({
              source: fact({
                product: '=SUM(A1)',
                amount: '9007199254740993.125',
                quantity: '0.1234567890123456789',
              }),
            }),
          ],
        }),
      )
    ).getWorksheet('SKU比较组复核')!
    expect(cell(sheet, '来源商品组金额（元）').value).toBe('9007199254740993.13')
    expect(cell(sheet, '来源商品组金额（元）').note).toBeTruthy()
    expect(cell(sheet, '来源原始数量').value).toBe('0.1234567890123456789')
    expect(cell(sheet, '来源商品').value).toBe('=SUM(A1)')
    expect(cell(sheet, '来源商品').formula).toBeUndefined()
  })
  it('fetches all immutable filtered pages without merging comparison groups', async () => {
    const rows = Array.from({ length: 51 }, (_, index) => row({ key: `sku-${index}` }))
    const data = review({ rows: rows.slice(0, 50), total: 51 })
    vi.mocked(getReconciliationReview)
      .mockResolvedValueOnce(data)
      .mockResolvedValueOnce({ ...data, page: 2, rows: rows.slice(50) })
    const selection = { ...query, city: '武汉', orderNo: '000001', status: 'UNVERIFIED' }
    const output = await readReconciliationExport(data, selection)
    expect(output.rows).toEqual(rows)
    expect(getReconciliationReview).toHaveBeenLastCalledWith(data.id, { ...selection, page: 2 })
  })
  it.each(['short', 'duplicate', 'changed', 'wrong-kind', 'failed'])(
    'rejects incomplete or inconsistent export reads: %s',
    async (mode) => {
      const rows = Array.from({ length: 51 }, (_, index) => row({ key: `sku-${index}` }))
      const data = review({ rows: rows.slice(0, 50), total: 51 })
      vi.mocked(getReconciliationReview).mockResolvedValueOnce(data)
      if (mode === 'failed')
        vi.mocked(getReconciliationReview).mockRejectedValueOnce(new Error('network failed'))
      else
        vi.mocked(getReconciliationReview).mockResolvedValueOnce({
          ...data,
          page: 2,
          total: mode === 'changed' ? 52 : 51,
          rows:
            mode === 'short'
              ? []
              : mode === 'duplicate'
                ? [rows[0]]
                : mode === 'wrong-kind'
                  ? [row({ kind: 'ORDER' })]
                  : rows.slice(50),
        })
      await expect(readReconciliationExport(data, query)).rejects.toThrow()
    },
  )
  it('rejects partial data passed directly to the workbook builder', async () => {
    await expect(buildReconciliationExcel(review({ total: 100 }), query)).rejects.toThrow('未完整')
  })
})
