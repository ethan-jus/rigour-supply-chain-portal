import { describe, expect, it } from 'vitest'
import {
  productMatrix,
  supplyComparability,
  supplyOperationsForUnit,
  productMonthlyTrend,
  investigationMoney,
} from '@/views/supply-chain/bi/city-product-investigation'
import { erpCategoryTree, erpCategoryDescendants } from '@/views/supply-chain/bi/erp-category-tree'
import { cityProductReport, reportRow } from './fixtures/city-product-report'
import type { CityProductSupplyView } from '@/api/core/bi-city-product-report'

describe('source-backed product investigation', () => {
  it('paginates every SKU, keeps same-name identities separate and never mixes quantity units', () => {
    const rows = Array.from({ length: 25 }, (_, index) =>
      reportRow({
        skuId: String(index),
        productName: '同名商品',
        unitCode: index < 22 ? 'BOX' : 'BUCKET',
      }),
    )
    const report = cityProductReport({ rows })
    expect(productMatrix(report).total).toBe(25)
    expect(productMatrix(report, { offset: 20 }).products).toHaveLength(5)
    expect(productMatrix(report, { unitCode: 'BUCKET' }).products).toHaveLength(3)
    const point = productMatrix(
      cityProductReport({ rows: [reportRow({ salesAmount: null, quantity: null }), reportRow()] }),
    ).points[0]
    expect(point.salesAmount).toBeNull()
    expect(point.quantity).toBeNull()
  })
  it('keeps absent months as gaps and attributes only the requested raw unit', () => {
    const report = cityProductReport({
      from: '2026-07-31T16:00:00Z',
      to: '2026-10-01T15:59:59Z',
      monthlyRows: [
        { month: '2026-08', metrics: reportRow({ quantity: '12', paidAmount: null }) },
        { month: '2026-10', metrics: reportRow({ quantity: '7', unitCode: 'BUCKET' }) },
      ],
    })
    const trend = productMonthlyTrend(report, 'BOX')
    expect(trend.map((row) => row.month)).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(trend.map((row) => row.quantity)).toEqual(['12', null, null])
    expect(trend[0].paidAmount).toBeNull()
    expect(trend[0].incomplete).toBe(true)
    expect(trend[1].salesAmount).toBeNull()
  })
  it('formats large display amounts in wan without changing small amount rounding or missing values', () => {
    expect(investigationMoney('226320.94')).toBe('¥22.63万')
    expect(investigationMoney('1.005')).toBe('¥1.01')
    expect(investigationMoney(null)).toBe('未提供')
  })
  it('keeps unknown receipts null, preserves money and never makes missing cities zero cells', () => {
    const matrix = productMatrix(
      cityProductReport({ rows: [reportRow({ salesAmount: '12345.678901', paidAmount: null })] }),
    )
    expect(matrix.points).toHaveLength(1)
    expect(matrix.points[0].salesAmount).toBe('12345.678901')
    expect(matrix.points[0].paidAmount).toBeNull()
    expect(matrix.points[0].incomplete).toBe(true)
  })
  it('matches real SKU and units, never product names or min-order packaging', () => {
    const stock = {
      productId: '100',
      skuId: '1000',
      unitCode: 'BUCKET',
    } as CityProductSupplyView['stocks'][number]
    const sales = [
      reportRow({
        productId: '100',
        skuId: '1000',
        unitCode: 'BOX',
        specification: '12桶/箱',
        quantity: '12',
      }),
    ]
    expect(supplyComparability(stock, sales)).toBe('UNIT_MISMATCH')
    expect(supplyComparability({ ...stock, unitCode: 'BOX' }, sales)).toBe('SAME_UNIT')
    expect(supplyComparability({ ...stock, skuId: '999' }, sales)).toBe('NO_SALES')
    expect(supplyComparability({ ...stock, skuId: null }, sales)).toBe('MISSING_MAPPING')
    const data = {
      operations: [
        { skuId: '1000', unitCode: 'BOX' },
        { skuId: '1000', unitCode: 'BUCKET' },
        { skuId: '999', unitCode: 'BOX' },
      ],
    } as CityProductSupplyView
    expect(supplyOperationsForUnit(data, '1000', 'BOX')).toEqual([data.operations[0]])
    expect(supplyOperationsForUnit(data, '', 'BOX')).toEqual([])
  })
})

describe('ERP full category hierarchy', () => {
  const rows = [
    { id: '1', categoryName: '父类甲', parentId: null },
    { id: '2', categoryName: '未成交子类', parentId: '1' },
    { id: '3', categoryName: '第三层', parentId: '2' },
    { id: '4', categoryName: '独立类', parentId: null },
  ]
  it('keeps parent and zero-transaction children, recursively includes all descendants', () => {
    const tree = erpCategoryTree(rows)
    expect(tree[0].children[0].children[0].label).toBe('第三层')
    expect(erpCategoryDescendants(rows, '1')).toEqual(['1', '2', '3'])
    expect(erpCategoryDescendants(rows, '2')).toEqual(['2', '3'])
    expect(
      erpCategoryDescendants(
        rows.map((row) => (row.id === '2' ? { ...row, parentId: '4' } : row)),
        '1',
      ),
    ).toEqual(['1'])
    expect(erpCategoryDescendants(rows, '999')).toEqual([])
  })
  it('rejects truncated, duplicate or cyclic ERP trees rather than inventing categories', () => {
    expect(() => erpCategoryTree(rows.slice(1))).toThrow('父节点缺失')
    expect(() => erpCategoryTree([...rows, rows[0]])).toThrow('重复')
    expect(() =>
      erpCategoryTree(rows.map((row) => (row.id === '1' ? { ...row, parentId: '3' } : row))),
    ).toThrow('循环')
  })
})
