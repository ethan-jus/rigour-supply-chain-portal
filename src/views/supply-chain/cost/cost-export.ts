import { downloadBlob, csvFilename } from '@/utils/file-download'
import type { CellValue, Workbook } from 'exceljs'

type ExportValue = string | number | null | undefined
const moneyHeaders = new Set([
  '金额',
  '单据金额（元）',
  '金额（元）',
  '计入成本金额（元）',
  '押金',
  '单价',
  '进货单价',
])
const numericHeaders = new Set([...moneyHeaders, '数量', '面积（㎡）'])

function valueForCell(header: string, value: ExportValue): CellValue {
  if (value == null || value === '') return null
  if (numericHeaders.has(header)) {
    const raw = String(value).replaceAll(',', '')
    if (/^-?\d+(\.\d+)?$/.test(raw) && Number.isFinite(Number(raw))) return Number(raw)
    return String(value)
  }
  const text = String(value)
  // 业务日期按原日历值写入，时间已由展示层转换为北京时间，不能再按本机时区偏移。
  if (
    /日期|时间|费用.*月/.test(header) &&
    /^\d{4}-\d{2}(?:-\d{2}(?: \d{2}:\d{2}:\d{2})?)?$/.test(text)
  ) {
    const date = new Date(
      text.length === 7
        ? `${text}-01T00:00:00Z`
        : text.length === 10
          ? `${text}T00:00:00Z`
          : `${text.replace(' ', 'T')}Z`,
    )
    if (!Number.isNaN(date.getTime())) return date
  }
  return text
}

function columnWidth(header: string) {
  if (/单号|单据号|编号/.test(header)) return 34
  if (/时间/.test(header)) return 24
  if (/日期/.test(header)) return 16
  if (/月/.test(header)) return 14
  if (/金额|单价|押金/.test(header)) return 22
  if (/事项|名称|备注|说明|用途|地址|原因|期间|租期|单据来源/.test(header)) return 38
  return /数量|单位|状态|城市/.test(header) ? 16 : 24
}

/** 以 XLSX 字符串单元格保存单号和来源文本，保留前导零且不会执行公式。 */
export async function buildCostWorkbook(title: string, headers: string[], rows: ExportValue[][]) {
  if (!headers.length || rows.some((row) => row.length !== headers.length))
    throw new Error('导出字段与数据不一致，请重新导出')
  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()
  workbook.creator = '供应链数字化平台'
  const sheet = workbook.addWorksheet(title.slice(0, 31))
  sheet.addRow(headers)
  for (const row of rows)
    sheet.addRow(row.map((value, index) => valueForCell(headers[index]!, value)))
  sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 1, showGridLines: false }]
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, sheet.rowCount), column: headers.length },
  }
  sheet.columns.forEach((column, index) => {
    const header = headers[index]!
    column.width = columnWidth(header)
    column.numFmt = /时间/.test(header)
      ? 'yyyy-mm-dd hh:mm:ss'
      : /日期/.test(header)
        ? 'yyyy-mm-dd'
        : /费用.*月/.test(header)
          ? 'yyyy-mm'
          : moneyHeaders.has(header)
            ? /单价/.test(header)
              ? '#,##0.00####'
              : '#,##0.00'
            : numericHeaders.has(header)
              ? '#,##0.####'
              : '@'
  })
  sheet.eachRow((row, index) => {
    row.font = {
      name: '微软雅黑',
      size: 11,
      ...(index === 1
        ? { bold: true, color: { argb: 'FFFFFFFF' } }
        : { color: { argb: 'FF25364B' } }),
    }
    const lines =
      rows[index - 2]?.reduce<number>(
        (max, value, column) =>
          Math.max(
            max,
            String(value ?? '')
              .split('\n')
              .reduce(
                (count, line) =>
                  count +
                  Math.max(
                    1,
                    Math.ceil(
                      [...line].reduce(
                        (length, char) => length + (char.charCodeAt(0) > 255 ? 2 : 1),
                        0,
                      ) /
                        (columnWidth(headers[column]!) - 2),
                    ),
                  ),
                0,
              ),
          ),
        1,
      ) ?? 1
    row.height = index === 1 ? 32 : Math.min(409, Math.max(32, lines * 17 + 8))
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      cell.alignment = {
        vertical: 'middle',
        horizontal:
          index === 1 ? 'center' : numericHeaders.has(headers[column - 1]!) ? 'right' : 'left',
        wrapText: true,
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD8E1EC' } },
        bottom: { style: 'thin', color: { argb: 'FFD8E1EC' } },
        left: { style: 'thin', color: { argb: 'FFD8E1EC' } },
        right: { style: 'thin', color: { argb: 'FFD8E1EC' } },
      }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: index === 1 ? 'FF305786' : index % 2 === 0 ? 'FFF1F5FA' : 'FFFFFFFF' },
      }
    })
  })
  sheet.pageSetup = {
    orientation: 'landscape',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: '1:1',
  }
  return workbook
}

export async function downloadCostWorkbook(workbook: Workbook, title: string) {
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer())
  downloadBlob(
    new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    csvFilename(title).replace(/\.csv$/, '.xlsx'),
  )
}

export async function exportCostRows(
  title: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
) {
  const workbook = await buildCostWorkbook(title, headers, rows)
  await downloadCostWorkbook(workbook, title)
}
