import { describe, expect, it } from 'vitest'
import {
  autoMapColumns,
  extractSheetRows,
  matchImportRows,
  parseCsv,
  parseImportPrice,
  type ImportProduct,
} from '../src/views/supply-chain/erp/product-price-import'

const CUSTOMER_TYPES = [
  { code: 'CT_AGENT', name: '代理商' },
  { code: 'CT_WHOLESALE', name: '批发客户' },
  { code: 'CT_RETAIL', name: '零售客户' },
]

const PRODUCTS: ImportProduct[] = [
  {
    productCode: 'PRD001',
    sourceDocumentNo: '100012',
    productName: '葱油鸡枞菌菇拌面',
    variants: [{ id: '11', specification: null }],
  },
  {
    productCode: 'PRD002',
    sourceDocumentNo: '100007',
    productName: '澳洲台呢底布',
    variants: [
      { id: '21', specification: 'A300' },
      { id: '22', specification: 'A500' },
    ],
  },
]

describe('商品等级价导入工具', () => {
  it('解析带引号和逗号的 CSV', () => {
    const rows = parseCsv('a,b\n"x,1","y""2"\n')
    expect(rows).toEqual([
      ['a', 'b'],
      ['x,1', 'y"2'],
    ])
  })

  it('跳过标题说明行并识别表头', () => {
    const sheet = extractSheetRows([
      ['商品等级价导出模板', '', ''],
      ['商品编号', '规格', '代理商'],
      ['100012', '', '8.5'],
    ])
    expect(sheet.headers).toEqual(['商品编号', '规格', '代理商'])
    expect(sheet.rows).toEqual([['100012', '', '8.5']])
  })

  it('按表头自动匹配商品编码、规格和客户类型列', () => {
    const sheet = extractSheetRows([
      ['商品编号', '商品名称', '多规格', '订货价', '代理商', '批发客户', '零售客户'],
      ['100012', '拌面', '', '15', '13.5', '12', '15'],
    ])
    const mapping = autoMapColumns(sheet, CUSTOMER_TYPES)
    expect(mapping.productCodeColumn).toBe(0)
    expect(mapping.specificationColumn).toBe(2)
    expect(mapping.typeColumns.CT_AGENT).toBe(4)
    expect(mapping.typeColumns.CT_WHOLESALE).toBe(5)
    expect(mapping.typeColumns.CT_RETAIL).toBe(6)
  })

  it('单规格商品按商品编码匹配并生成价格明细', () => {
    const sheet = extractSheetRows([
      ['商品编号', '规格', '代理商', '批发客户'],
      ['100012', '', '13.5', ''],
      ['100012', '', '', '12'],
    ])
    const mapping = autoMapColumns(sheet, CUSTOMER_TYPES)
    const result = matchImportRows(sheet, mapping, CUSTOMER_TYPES, PRODUCTS)
    expect(result.matchedRows).toBe(2)
    expect(result.items).toEqual([
      { productVariantId: '11', customerTypeCode: 'CT_AGENT', salePrice: 13.5 },
      { productVariantId: '11', customerTypeCode: 'CT_WHOLESALE', salePrice: 12 },
    ])
    expect(result.unmatchedRows).toHaveLength(0)
  })

  it('多规格商品按规格名称匹配规格', () => {
    const sheet = extractSheetRows([
      ['商品编号', '规格', '代理商'],
      ['100007', 'a300', '300'],
      ['100007', 'B900', '350'],
    ])
    const mapping = autoMapColumns(sheet, CUSTOMER_TYPES)
    const result = matchImportRows(sheet, mapping, CUSTOMER_TYPES, PRODUCTS)
    expect(result.items).toEqual([{ productVariantId: '21', customerTypeCode: 'CT_AGENT', salePrice: 300 }])
    expect(result.unmatchedRows).toHaveLength(1)
    expect(result.unmatchedRows[0].reason).toContain('B900')
  })

  it('汇总未匹配商品与无效价格', () => {
    const sheet = extractSheetRows([
      ['商品编号', '规格', '代理商'],
      ['999999', '', '10'],
      ['100012', '', '0'],
      ['100012', '', 'abc'],
    ])
    const mapping = autoMapColumns(sheet, CUSTOMER_TYPES)
    const result = matchImportRows(sheet, mapping, CUSTOMER_TYPES, PRODUCTS)
    expect(result.items).toHaveLength(0)
    expect(result.invalidCells).toBe(2)
    expect(result.unmatchedRows).toHaveLength(1)
    expect(result.unmatchedRows[0].productCode).toBe('999999')
  })

  it('价格解析兼容货币符号与千分位', () => {
    expect(parseImportPrice(' ¥1,280.50 ')).toBe(1280.5)
    expect(parseImportPrice('')).toBeNull()
    expect(parseImportPrice('-5')).toBeNull()
  })
})
