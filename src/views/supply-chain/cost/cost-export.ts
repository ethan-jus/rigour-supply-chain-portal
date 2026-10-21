import { downloadBlob, csvFilename } from '@/utils/file-download'

/** 以 XLSX 字符串单元格保存单号和来源文本，保留前导零且不会执行公式。 */
export async function buildCostWorkbook(
  title: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
) {
  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()
  const sheet = workbook.addWorksheet(title.slice(0, 31))
  sheet.addRow(headers)
  for (const row of rows) sheet.addRow(row.map((value) => value ?? null))
  sheet.getRow(1).font = { bold: true }
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } }
  sheet.columns.forEach((column) => {
    column.width = 23
  })
  return workbook
}

export async function exportCostRows(
  title: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
) {
  const workbook = await buildCostWorkbook(title, headers, rows)
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer())
  downloadBlob(
    new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    csvFilename(title).replace(/\.csv$/, '.xlsx'),
  )
}
