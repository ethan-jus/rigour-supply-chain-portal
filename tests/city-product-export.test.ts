import { beforeEach, describe, expect, it } from 'vitest'
import { seedBusinessDictionaryForTest } from '@/utils/business-dictionary'
import {
  reportMoneyText,
  reportQuantityText,
  reportUnitName,
  reportSourceName,
} from '@/views/supply-chain/bi/report-format'
import {
  cityProductChartRows,
  cityProductColumns,
  cityProductExportBlockedReason,
  cityProductTotals,
  reportCellText,
  reportDecimalText,
} from '@/views/supply-chain/bi/city-product-export'
import { cityProductReport, reportRow } from './fixtures/city-product-report'

beforeEach(() =>
  seedBusinessDictionaryForTest('COMMON', 'PRODUCT_UNIT', [
    { code: 'BOX', name: '箱' },
    { code: 'BOTTLE', name: '瓶' },
    { code: 'BUCKET', name: '桶' },
  ]),
)

describe('city product shared data helpers', () => {
  it('uses effective server dictionary names before verified preset fallbacks', () => {
    expect(reportUnitName('GRAIN')).toBe('颗')
    expect(reportSourceName('FEISHU', 'FEISHU')).toBe('飞书')
    seedBusinessDictionaryForTest('COMMON', 'PRODUCT_UNIT', [
      { code: 'GRAIN', name: '业务自定义颗单位' },
    ])
    expect(reportUnitName('GRAIN')).toBe('业务自定义颗单位')
    expect(reportUnitName('UNRECOGNIZED')).toBe('UNRECOGNIZED')
  })
  it('preserves decimals, zero and null without rounding or accepting invalid amounts', () => {
    expect(reportDecimalText('9007199254740993.123456789')).toBe('9007199254740993.123456789')
    expect(reportDecimalText('-10.07500')).toBe('-10.07500')
    expect(reportDecimalText('1.234e-7')).toBe('0.0000001234')
    expect(reportDecimalText(1e-8)).toBe('0.00000001')
    expect(reportDecimalText(0)).toBe('0')
    expect(reportDecimalText(null)).toBe('')
    for (const value of [NaN, Infinity, '=1+1', '', {}, '1e999999'])
      expect(() => reportDecimalText(value)).toThrow()
  })
  it('exposes business names and financial metrics without internal identifiers', () => {
    expect(cityProductColumns.categoryRows.slice(0, 8).map((column) => column.key)).toEqual([
      'regionName',
      'categoryName',
      'quantities',
      'salesAmount',
      'receivableAmount',
      'paidAmount',
      'allocatedPaidAmount',
      'attributionStatus',
    ])
    for (const columns of Object.values(cityProductColumns))
      expect(columns.map((column) => column.label).join('|')).not.toMatch(/ID|编码|订单ID/)
  })
  it('marks incomplete receipts separately while preserving original mixed units', () => {
    const row = reportRow({
      unitCode: null,
      quantity: null,
      paidAmount: null,
      quantities: [
        { unitCode: 'BOX', quantity: '2.500' },
        { unitCode: 'BOTTLE', quantity: '12.125' },
      ],
    })
    expect(reportCellText(row, { key: 'quantities', label: '' })).toBe('箱: 2.5；瓶: 12.125')
    expect(reportCellText(row, { key: 'attributionStatus', label: '' })).toBe('未完整')
    expect(
      reportCellText(reportRow({ paidAmount: 0, unallocatedOrderCount: 0 }), {
        key: 'attributionStatus',
        label: '',
      }),
    ).toBe('已归属')
  })
  it('rounds presentation half up without mutating source precision or quantities', () => {
    for (const [source, expected] of [
      ['44849.115000', '44849.12'],
      ['51349.450000', '51349.45'],
      ['1.005', '1.01'],
      ['-10.075', '-10.08'],
      ['-0.0049', '0.00'],
      ['9.999', '10.00'],
      ['0', '0.00'],
      ['1e-8', '0.00'],
      ['9007199254740993.125', '9007199254740993.13'],
    ])
      expect(reportMoneyText(source)).toBe(expected)
    expect(reportMoneyText(null)).toBe('')
    expect(reportQuantityText('677.000000')).toBe('677')
    expect(reportQuantityText('1594.750100')).toBe('1594.7501')
    expect(
      reportCellText(reportRow({ allocationStatus: 'PARTIAL' }), {
        key: 'allocationStatus',
        label: '',
      }),
    ).toBe('部分归属')
    expect(
      reportCellText(
        reportRow({ categoryId: '1', categoryName: '旧名称' }),
        { key: 'categoryName', label: '' },
        {
          categories: [{ id: '1', categoryName: 'ERP真实分类' }],
        },
      ),
    ).toBe('ERP真实分类')
  })
  it('blocks missing, empty and sample payloads, but not one empty sheet', () => {
    expect(cityProductExportBlockedReason(null)).toContain('尚未')
    expect(cityProductExportBlockedReason(cityProductReport({ rows: [] }))).toBe('')
    expect(
      cityProductExportBlockedReason(
        cityProductReport({ rows: [], categoryRows: [], orderTrace: [] }),
      ),
    ).toContain('没有可导出')
    expect(cityProductExportBlockedReason(cityProductReport({ summary: null }))).toContain(
      '汇总缺失',
    )
    expect(cityProductExportBlockedReason(cityProductReport({ sample: true }))).toContain('样例')
    expect(
      cityProductExportBlockedReason(cityProductReport({ rows: [reportRow({ sample: true })] })),
    ).toContain('样例')
  })
  it('sums amounts exactly within one grain without double-counting allocated receipts', () => {
    const report = cityProductReport({
      rows: [
        reportRow({ salesAmount: '0.1', paidAmount: '0.1', allocatedPaidAmount: '0.05' }),
        reportRow({ salesAmount: '0.2', paidAmount: '0.2', allocatedPaidAmount: '0.05' }),
        reportRow({ regionCode: 'SH', regionName: '上海', salesAmount: '10', paidAmount: null }),
      ],
      categoryRows: [reportRow({ salesAmount: 999999, paidAmount: 999999 })],
    })
    expect(cityProductChartRows(report)).toEqual([
      { key: 'WH', name: '武汉', salesAmount: '0.3', paidAmount: '0.3', incomplete: true },
      { key: 'SH', name: '上海', salesAmount: '10', paidAmount: null, incomplete: true },
    ])
  })
  it('uses category summary independently and never sums deduplicated counts', () => {
    const category = reportRow({
      unitCode: null,
      quantity: null,
      quantities: [
        { unitCode: 'BOX', quantity: '2.500' },
        { unitCode: 'BOTTLE', quantity: '12.125' },
      ],
      paidAmount: '88.000001',
      receivableAmount: '99.123456',
      allocatedPaidAmount: 0,
      unallocatedOrderCount: 0,
    })
    const report = cityProductReport({ categoryRows: [category] })
    report.summary!.categoryPaidAmount = '88.000001'
    report.summary!.unallocatedCategoryOrderCount = 0
    const totals = cityProductTotals(report, 'categoryRows')
    expect(totals.paidAmount).toBe('88.000001')
    expect(totals.incomplete).toBe(false)
    expect(totals.quantities).toEqual(category.quantities)
    expect(totals).not.toHaveProperty('customerCount')
    expect(totals).not.toHaveProperty('orderCount')
    expect(cityProductChartRows(report, 'categoryRows')[0].paidAmount).toBe('88.000001')
    expect(cityProductChartRows(report, 'rows')[0].paidAmount).toBe('30.0125')
    report.summary!.categoryPaidAmount = 0
    expect(cityProductTotals(report, 'categoryRows').paidAmount).toBe('0')
    report.summary!.categoryPaidAmount = null
    expect(cityProductTotals(report, 'categoryRows').paidAmount).toBeNull()
  })
})
