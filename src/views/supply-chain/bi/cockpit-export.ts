import type { DetailRow } from './cockpit-model'

interface DetailExportContext {
  title: string
  rows: DetailRow[]
  columns: string[]
  selectedColumns?: string[]
  sample?: boolean
  note?: string
  scope: [string, string][]
}

/** This export preserves displayed precision; procurement reports use the raw report contract. */
export async function buildCockpitDetailExcel(context: DetailExportContext) {
  if (!context.rows.length) throw new Error('当前范围没有可导出的明细')
  const available = ['名称', '数据类型', ...context.columns]
  const requested = context.selectedColumns ?? available
  if (!requested.length) throw new Error('请至少选择一个导出字段')
  if (requested.some((key) => !available.includes(key))) throw new Error('导出字段无效，请重新选择')
  const columns = available.filter((key) => requested.includes(key))
  if (context.rows.some((row) => row.sample ?? context.sample) && !columns.includes('数据类型'))
    throw new Error('含样例的明细必须保留数据类型字段')
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('看板明细', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  sheet.columns = columns.map((header) => ({
    header,
    width: Math.max(18, Math.min(36, header.length * 2 + 4)),
  }))
  for (const item of context.rows) {
    const row = sheet.addRow(
      columns.map((key) =>
        key === '名称'
          ? item.name
          : key === '数据类型'
            ? (item.sample ?? context.sample)
              ? '样例'
              : 'BI数据'
            : (item.cells[key] ?? ''),
      ),
    )
    columns.forEach((key, index) => {
      if (key === '名称' || key === '数据类型') return
      const text = item.cells[key] ?? ''
      const currency = /^¥(-?\d[\d,]*\.\d{2})$/.exec(text)
      const percent = /^(-?\d+(?:\.\d+)?)%$/.exec(text)
      const count = /(?:数量|订单数|客户数|名次|人数)$/.test(key) && /^\d+$/.test(text)
      const numeric = currency?.[1].replaceAll(',', '') ?? percent?.[1] ?? (count ? text : '')
      if (!numeric || numeric.replace(/[^0-9]/g, '').replace(/^0+/, '').length > 15) return
      const cell = row.getCell(index + 1)
      cell.value = Number(numeric) / (percent ? 100 : 1)
      cell.numFmt = currency ? '"¥"#,##0.00' : percent ? '0.0%' : '#,##0'
    })
  }
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF285681' } }
  sheet.getRow(1).height = 30
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: sheet.rowCount, column: sheet.columnCount },
  }
  const definitions = workbook.addWorksheet('统计口径')
  definitions.columns = [
    { header: '项目', width: 24 },
    { header: '内容', width: 100 },
  ]
  definitions.addRows([
    ['报表', context.title],
    ...context.scope,
    ['导出范围', '当前明细筛选的全部结果，不受分页限制。'],
    ['导出字段', columns.join('、')],
    ['精度', '按看板明细展示精度导出；报批核对原始金额请使用城市商品报表。'],
    ['口径', context.note ?? ''],
    ['样例', '标记为样例的金额不作为实际经营数据或付款依据。'],
  ])
  definitions.getColumn(2).alignment = { wrapText: true, vertical: 'top' }
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer())
  const filename = `${context.title}.xlsx`.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
  return { bytes, filename }
}
