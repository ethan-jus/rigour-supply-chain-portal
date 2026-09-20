/** 商品等级价导入的行解析与匹配工具；只做纯计算，便于单测。 */

export interface ImportCustomerType {
  code: string
  name: string
}

export interface ParsedSheet {
  headers: string[]
  rows: string[][]
}

export interface ImportColumnMapping {
  productCodeColumn: number | null
  specificationColumn: number | null
  typeColumns: Record<string, number | null>
}

export interface ImportProductVariant {
  id: string
  specification: string | null
}

export interface ImportProduct {
  productCode: string
  sourceDocumentNo: string | null
  productName: string
  variants: ImportProductVariant[]
}

export interface MatchedImportItem {
  productVariantId: string
  customerTypeCode: string
  salePrice: number
}

export interface UnmatchedImportRow {
  rowNumber: number
  productCode: string
  reason: string
}

export interface ImportMatchResult {
  items: MatchedImportItem[]
  matchedRows: number
  unmatchedRows: UnmatchedImportRow[]
  priceCells: number
  invalidCells: number
}

/** 解析 CSV 文本为二维表；支持双引号包裹和转义引号。 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        cell += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') {
      cell += char
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}

/** 识别表头行（跳过标题说明行），返回表头与数据行。 */
export function extractSheetRows(matrix: string[][]): ParsedSheet {
  const cleaned = matrix.map((row) => row.map((cell) => (cell ?? '').toString().trim()))
  let headerIndex = 0
  for (let index = 0; index < Math.min(cleaned.length, 10); index += 1) {
    const row = cleaned[index]
    const nonEmptyCount = row.filter((cell) => cell).length
    const text = row.join('')
    if (nonEmptyCount >= 2 && (text.includes('商品') || text.includes('编码') || text.includes('编号'))) {
      headerIndex = index
      break
    }
  }
  const headers = cleaned[headerIndex] ?? []
  const rows = cleaned.slice(headerIndex + 1).filter((row) => row.some((cell) => cell))
  return { headers, rows }
}

/** 按常见表头自动匹配列：商品编码、规格、以及各客户类型名称列。 */
export function autoMapColumns(sheet: ParsedSheet, customerTypes: ImportCustomerType[]): ImportColumnMapping {
  const headers = sheet.headers
  const normalize = (value: string) => value.replace(/\s/g, '')
  const find = (predicate: (header: string) => boolean) => {
    const index = headers.findIndex(predicate)
    return index >= 0 ? index : null
  }
  const productCodeColumn =
    find((header) => {
      const text = normalize(header)
      return (text.includes('商品编号') || text.includes('商品编码') || text.includes('编号')) && !text.includes('条码')
    }) ?? find((header) => normalize(header).includes('商品'))
  const specificationColumn = find((header) => normalize(header).includes('规格'))
  const typeColumns: Record<string, number | null> = {}
  for (const type of customerTypes) {
    const target = normalize(type.name)
    if (!target) {
      typeColumns[type.code] = null
      continue
    }
    let index = headers.findIndex((header) => normalize(header) === target)
    if (index < 0) index = headers.findIndex((header) => normalize(header).includes(target))
    typeColumns[type.code] = index >= 0 ? index : null
  }
  return { productCodeColumn, specificationColumn, typeColumns }
}

/** 解析价格单元格；空值或非正数返回 null。 */
export function parseImportPrice(raw: string): number | null {
  const cleaned = raw.replace(/[¥￥,\s]/g, '')
  if (!cleaned) return null
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value <= 0) return null
  return value
}

/** 将表格行匹配到本地商品规格并生成可导入的价格明细。 */
export function matchImportRows(
  sheet: ParsedSheet,
  mapping: ImportColumnMapping,
  customerTypes: ImportCustomerType[],
  products: ImportProduct[],
): ImportMatchResult {
  const productIndex = new Map<string, ImportProduct>()
  for (const product of products) {
    const code = product.productCode?.trim()
    if (code) productIndex.set(code, product)
    const source = product.sourceDocumentNo?.trim()
    if (source) productIndex.set(source, product)
  }
  const items: MatchedImportItem[] = []
  const unmatchedRows: UnmatchedImportRow[] = []
  let matchedRows = 0
  let priceCells = 0
  let invalidCells = 0
  const cell = (row: string[], index: number | null) => (index == null ? '' : (row[index] ?? '').trim())
  sheet.rows.forEach((row, rowIndex) => {
    const code = cell(row, mapping.productCodeColumn)
    if (!code) return
    const product = productIndex.get(code)
    if (!product) {
      unmatchedRows.push({ rowNumber: rowIndex + 1, productCode: code, reason: '商品编码未匹配到本系统商品' })
      return
    }
    const specValue = cell(row, mapping.specificationColumn)
    const variant = resolveVariant(product, specValue)
    if (!variant) {
      unmatchedRows.push({
        rowNumber: rowIndex + 1,
        productCode: code,
        reason: specValue ? `规格「${specValue}」未匹配到该商品` : '该商品有多个规格，未指定规格列',
      })
      return
    }
    let rowCells = 0
    for (const type of customerTypes) {
      const column = mapping.typeColumns[type.code]
      if (column == null) continue
      const raw = cell(row, column)
      if (!raw) continue
      const price = parseImportPrice(raw)
      if (price == null) {
        invalidCells += 1
        continue
      }
      items.push({ productVariantId: variant.id, customerTypeCode: type.code, salePrice: price })
      priceCells += 1
      rowCells += 1
    }
    if (rowCells > 0) matchedRows += 1
  })
  return { items, matchedRows, unmatchedRows, priceCells, invalidCells }
}

function resolveVariant(product: ImportProduct, specValue: string): ImportProductVariant | null {
  const variants = product.variants ?? []
  if (specValue) {
    const target = specValue.trim().toUpperCase()
    return variants.find((variant) => (variant.specification ?? '').trim().toUpperCase() === target) ?? null
  }
  if (variants.length === 1) return variants[0]
  return null
}
