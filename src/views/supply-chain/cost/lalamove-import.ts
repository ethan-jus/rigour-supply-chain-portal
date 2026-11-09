import type { Workbook, Cell } from 'exceljs'
import { downloadCostWorkbook } from './cost-export'

export const lalamoveHeaders = [
  '货拉拉订单号',
  '用车时间',
  '订单状态',
  '实付金额(元)',
  '销售订单号',
  '收货人信息',
]
export interface LalamoveOrder {
  enterpriseId: string
  orderNo: string
  status: string
  useTime: string
  paidAmount: string
  raw: Record<string, string>
  salesOrderNos: string[]
  line: number
}
export interface LalamovePreview {
  rows: LalamoveOrder[]
  errors: { line: number; message: string }[]
}
const normalized = (s: string) =>
  s
    .replace(/[\s\r\n]/g, '')
    .replaceAll('（', '(')
    .replaceAll('）', ')')
    .replace(/^货拉拉订单号$/, '订单号')
function text(cell: Cell) {
  if (cell.type === 6 || cell.type === 1) throw new Error('不能包含公式或合并单元格')
  if (cell.value instanceof Date) return cell.value.toISOString().slice(0, 19).replace('T', ' ')
  return cell.text.trim()
}
function identifier(cell: Cell) {
  if (typeof cell.value === 'number' && !Number.isSafeInteger(cell.value))
    throw new Error('订单号已超出 Excel 数字精度，请从原平台取得文本单号后重新填写')
  const value = text(cell)
  if (/e[+-]?\d+$/i.test(value)) throw new Error('订单号不能使用科学计数法，请使用文本单号')
  return value
}
export async function buildLalamoveTemplate() {
  const excel = await import('exceljs')
  const { Workbook } = excel.default || excel
  const book = new Workbook()
  for (const name of ['导入数据', '填写示例']) {
    const sheet = book.addWorksheet(name)
    sheet.addRow(lalamoveHeaders)
    if (name === '填写示例')
      sheet.addRow([
        '3616894445226123730',
        '2026-11-06 10:00:00',
        '已完成',
        35,
        '',
        '星河门店；王先生；收货地址',
      ])
    sheet.columns.forEach((column, i) => {
      column.width = i === 5 ? 48 : 28
      column.numFmt = '@'
    })
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E557F' } }
    for (let column = 1; column <= 6; column++) {
      sheet.getCell(1, column).note = column <= 4 ? '必填' : '选填'
    }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
  }
  const notes = book.addWorksheet('填写说明')
  notes.addRows([
    ['字段', '填写要求'],
    ['货拉拉订单号', '必填，完整文本填写货拉拉订单号，不能使用科学计数法。'],
    ['用车时间', '必填，格式为 YYYY-MM-DD 或 YYYY-MM-DD HH:mm:ss。'],
    ['订单状态', '必填，填写货拉拉原单状态。仅已完成、司机完成、已支付订单可生成运输记录。'],
    ['实付金额(元)', '必填，填写原报表实付金额，最多两位小数；0元填写0。不要重复叠加额外费用。'],
    [
      '销售订单号',
      '选填，可填本系统销售单号或订货宝销售单号；多单用分号分隔。留空时，导入后人工选择已有销售单。',
    ],
    [
      '收货人信息',
      '选填，客户名称、联系人、电话或地址，用于核对候选销售单。正式收货信息以关联销售单和客户档案为准。',
    ],
    ['填写位置', '只填写第一张“导入数据”表。填写示例不参与导入；关联销售单后生成待确认运输记录。'],
  ])
  notes.getColumn(1).width = 32
  notes.getColumn(2).width = 110
  notes.eachRow((row) => {
    row.height = 40
    row.alignment = { wrapText: true, vertical: 'middle' }
  })
  return book
}
export async function lalamoveTemplate() {
  await downloadCostWorkbook(await buildLalamoveTemplate(), '货拉拉订单导入模板')
}
export async function parseLalamoveWorkbook(book: Workbook): Promise<LalamovePreview> {
  const sheet = book.worksheets[0]
  if (!sheet || sheet.rowCount > 10005 || sheet.columnCount > 100)
    throw new Error('报表为空或超过 10000 行、100 列限制')
  let headerRow = 0
  const columns = new Map<string, number>()
  for (let i = 1; i <= Math.min(sheet.rowCount, 10); i++) {
    const map = new Map<string, number>()
    let duplicate = false
    sheet.getRow(i).eachCell((c, n) => {
      const key = normalized(c.text)
      if (key && map.has(key)) duplicate = true
      if (key) map.set(key, n)
    })
    if (map.has('订单号') && map.has('订单状态')) {
      if (duplicate) throw new Error('报表表头存在重复列，请核对后重新上传')
      headerRow = i
      map.forEach((v, k) => columns.set(k, v))
      break
    }
  }
  if (!headerRow || !columns.has('实付金额(元)') || !columns.has('用车时间'))
    throw new Error(
      '缺少货拉拉订单号、订单状态、用车时间或实付金额(元)，请使用货拉拉原报表或下载模板',
    )
  const result: LalamovePreview = { rows: [], errors: [] },
    seen = new Set<string>()
  for (let i = headerRow + 1; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i),
      get = (key: string) => (columns.has(key) ? text(row.getCell(columns.get(key)!)) : '')
    if (
      ['订单查询结果', '说明：', '说明:', '合计'].some((x) =>
        row.getCell(1).text.trim().startsWith(x),
      )
    )
      continue
    if (!row.hasValues) continue
    try {
      if (!get('订单号')) throw new Error('缺少货拉拉订单号')
      const orderNo = identifier(row.getCell(columns.get('订单号')!)),
        enterpriseId = columns.has('企业ID') ? identifier(row.getCell(columns.get('企业ID')!)) : ''
      if (
        (enterpriseId && !/^[A-Za-z0-9_-]{1,80}$/.test(enterpriseId)) ||
        !/^[\w.-]{6,80}$/.test(orderNo)
      )
        throw new Error('企业ID或订单号无效')
      const paidAmount = get('实付金额(元)').replaceAll(',', ''),
        useTime = get('用车时间').replaceAll('/', '-').replace('T', ' ')
      if (!/^\d{1,12}(\.\d{1,2})?$/.test(paidAmount))
        throw new Error('实付金额须为非负数，整数最多12位、小数最多两位')
      if (!/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/.test(useTime))
        throw new Error('用车时间须为完整年月日，可包含时分秒')
      const day = useTime.slice(0, 10)
      if (new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) !== day)
        throw new Error('用车日期无效')
      if (!get('订单状态')) throw new Error('缺少订单状态')
      const key = orderNo
      if (seen.has(key)) throw new Error('同一报表订单号重复')
      const raw: Record<string, string> = {}
      columns.forEach((n, key) => (raw[key] = text(row.getCell(n))))
      result.rows.push({
        enterpriseId,
        orderNo,
        status: get('订单状态'),
        useTime,
        paidAmount,
        raw,
        salesOrderNos: get('销售订单号')
          .split(/[;；,，\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
        line: i,
      })
      seen.add(key)
    } catch (e) {
      result.errors.push({ line: i, message: (e as Error).message })
    }
  }
  if (!result.rows.length && !result.errors.length)
    throw new Error('没有可导入的订单，请在“导入数据”表填写后上传')
  return result
}
