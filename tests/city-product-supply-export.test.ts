import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildCityProductExcel } from '@/views/supply-chain/bi/city-product-excel'
import {
  supplyEvidenceBlockedReason,
  type SupplyEvidence,
} from '@/views/supply-chain/bi/city-product-investigation'
import { seedBusinessDictionaryForTest } from '@/utils/business-dictionary'
import { cityProductReport, reportRow } from './fixtures/city-product-report'

const query = {
  from: '2026-08-01T00:00:00+08:00',
  to: '2026-09-12T23:59:59+08:00',
  productId: 'p1',
  skuId: 's1',
  allocationMode: 'EXACT_ONLY' as const,
}
const status = { status: 'STALE' as const, lastSuccessAt: '2026-09-10T01:00:00Z' }
const evidence = (): SupplyEvidence => ({
  query,
  warehouseId: 'w1',
  warehouseName: '供货仓',
  loading: false,
  error: '',
  snapshot: {
    from: query.from,
    to: query.to,
    generatedAt: '2026-09-12T12:00:00Z',
    inventoryStatus: status,
    operationStatus: status,
    truncated: false,
    stocks: [
      {
        warehouseId: 'w1',
        warehouseName: '供货仓',
        warehouseRegionCode: null,
        productId: 'p1',
        productName: '金汤肥牛',
        skuId: 's1',
        specification: '12桶/箱',
        unitCode: 'BOX',
        availableQuantity: '12.5000',
        lockedQuantity: null,
        inTransitQuantity: '0',
        syncedAt: status.lastSuccessAt,
      },
    ],
    operations: [
      {
        productId: 'p1',
        skuId: 's1',
        unitCode: 'BOX',
        month: '2026-08',
        procurementQuantity: '20',
        shippedQuantity: null,
        syncedAt: status.lastSuccessAt,
      },
    ],
  },
})

describe('procurement approval supply evidence', () => {
  it('includes real snapshot values, readable units and freshness without converting null to zero', async () => {
    seedBusinessDictionaryForTest('COMMON', 'PRODUCT_UNIT', [{ code: 'BOX', name: '箱' }])
    const supply = evidence()
    const originalSnapshot = structuredClone(supply.snapshot)
    const output = await buildCityProductExcel(
      cityProductReport({ rows: [reportRow({ specification: '12桶/箱' })] }),
      { query, categoryName: '方便面', supply },
    )
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(output.buffer)
    const stocks = workbook.getWorksheet('供货仓库库存')!
    expect(stocks.getRow(2).values).toEqual([
      ,
      '供货仓',
      '金汤肥牛',
      '12桶/箱',
      '箱',
      12.5,
      ,
      0,
      '2026-09-10 09:00:00',
    ])
    expect(stocks.getCell('E2').numFmt).toBe('#,##0.0')
    expect(workbook.getWorksheet('全仓采购发货')!.getCell('F2').value).toBeNull()
    const notes = workbook.getWorksheet('统计口径')!.getSheetValues().flat()
    expect(notes).toContain('供货核查时间（北京时间）')
    expect(notes).toContain('2026-09-12 20:00:00')
    expect(notes).not.toContain('2026-09-12T12:00:00Z')
    expect(supply.snapshot).toEqual(originalSnapshot)
    expect(notes).toContain('快照已过期，订货前需重新核查')
    expect(notes).toContain(
      '所选仓库的当前快照，不是订单期间期末库存；采购与发货为全仓事实，不按销售城市归属。',
    )
    expect(stocks.getRow(1).values).not.toContain('SKU编号')
  })
  it.each([
    [
      'loading',
      (value: SupplyEvidence) => {
        value.loading = true
      },
    ],
    [
      'truncated',
      (value: SupplyEvidence) => {
        value.snapshot!.truncated = true
      },
    ],
    [
      'error',
      (value: SupplyEvidence) => {
        value.error = '没有仓库权限'
      },
    ],
    [
      'product',
      (value: SupplyEvidence) => {
        value.snapshot!.stocks[0].productId = 'other'
      },
    ],
    [
      'warehouse',
      (value: SupplyEvidence) => {
        value.snapshot!.stocks[0].warehouseId = 'other'
      },
    ],
    [
      'date',
      (value: SupplyEvidence) => {
        value.snapshot!.from = '2026-01-01T00:00:00Z'
      },
    ],
  ])('blocks %s evidence before creating the workbook', async (_, change) => {
    const supply = evidence()
    change(supply)
    expect(supplyEvidenceBlockedReason(supply, query)).not.toBe('')
    await expect(
      buildCityProductExcel(cityProductReport(), { query, categoryName: '方便面', supply }),
    ).rejects.toThrow()
  })
  it('resolves a SKU-only report parent from returned fact IDs rather than silently widening it', async () => {
    await expect(
      buildCityProductExcel(cityProductReport(), {
        query: { ...query, productId: undefined },
        categoryName: '方便面',
        supply: evidence(),
      }),
    ).resolves.toHaveProperty('buffer')
    await expect(
      buildCityProductExcel(
        cityProductReport({ rows: [reportRow(), reportRow({ productId: 'p2' })] }),
        { query: { ...query, productId: undefined }, categoryName: '方便面', supply: evidence() },
      ),
    ).rejects.toThrow('范围已变化')
  })
})
