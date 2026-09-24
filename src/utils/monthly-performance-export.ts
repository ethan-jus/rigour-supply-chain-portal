import type { MonthlyPerformanceReport, MonthlyPerformanceRow } from '@/api/core/order-register'

export function performanceMonths(from: string, to: string): string[] {
  if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) throw new Error('月份格式无效')
  const first = Number(from.slice(0, 4)) * 12 + Number(from.slice(5)) - 1
  const last = Number(to.slice(0, 4)) * 12 + Number(to.slice(5)) - 1
  if (first > last || last - first > 23 || Number(from.slice(5)) < 1 || Number(from.slice(5)) > 12 || Number(to.slice(5)) < 1 || Number(to.slice(5)) > 12) throw new Error('请选择不超过24个月的有效月份范围')
  return Array.from({ length: last - first + 1 }, (_, i) => `${Math.floor((first + i) / 12)}-${String((first + i) % 12 + 1).padStart(2, '0')}`)
}

type Amounts = [number, number, number]
interface PerformanceGroup { city: string; employee: string; months: Map<string, Amounts> }
const cents = (value: number) => {
  if (!Number.isFinite(value) || !Number.isSafeInteger(Math.round(value * 100))) throw new Error('业绩金额无效，无法导出')
  return Math.round(value * 100)
}
function groupRows(rows: MonthlyPerformanceRow[], sales: boolean) {
  const groups = new Map<string, PerformanceGroup>()
  for (const row of rows) {
    const key = JSON.stringify([row.regionCode ?? '', sales ? row.employeeCode ?? '' : ''])
    const group = groups.get(key) ?? { city: row.regionName || row.regionCode || '未归属城市', employee: row.employeeName || row.employeeCode || '未归属销售', months: new Map<string, Amounts>() }
    const value = group.months.get(row.month) ?? [0, 0, 0]
    const amounts = [row.transactionAmount, row.receivedAmount, row.unpaidAmount]
    amounts.forEach((amount, i) => { value[i] = value[i]! + cents(amount) })
    group.months.set(row.month, value)
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => a.city.localeCompare(b.city, 'zh-CN') || a.employee.localeCompare(b.employee, 'zh-CN'))
}

/** 浏览器导出两张表；汇总数据来自后端权限过滤后的整单聚合，不受列表分页影响。 */
export async function buildMonthlyPerformanceWorkbook(report: MonthlyPerformanceReport) {
  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()
  workbook.creator = '订单中心'
  workbook.created = new Date(report.generatedAt)
  workbook.calcProperties.fullCalcOnLoad = true
  const months = performanceMonths(report.monthFrom, report.monthTo)
  const colors = ['2563EB', '047857', 'B45309']
  const metricFills = ['EFF6FF', 'ECFDF5', 'FFF7ED']
  for (const sales of [false, true]) {
    const sheet = workbook.addWorksheet(sales ? '销售月业绩' : '城市月业绩')
    const fixed = sales ? 3 : 2
    const lastColumn = fixed + months.length * 3
    sheet.views = [{ state: 'frozen', xSplit: fixed, ySplit: 5, showGridLines: false }]
    sheet.properties.defaultRowHeight = 28
    sheet.getColumn(1).width = 9
    sheet.getColumn(2).width = 20
    if (sales) sheet.getColumn(3).width = 20
    for (let col = fixed + 1; col <= lastColumn; col++) sheet.getColumn(col).width = 19
    for (let row = 1; row <= 3; row++) sheet.mergeCells(row, 1, row, lastColumn)
    sheet.getCell(1, 1).value = `${sales ? '销售' : '城市'}月业绩汇总（${report.monthFrom}—${report.monthTo}）`
    sheet.getCell(1, 1).font = { name: '微软雅黑', size: 16, bold: true, color: { argb: 'FFFFFF' } }
    sheet.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A5F' } }
    sheet.getCell(1, 1).alignment = { vertical: 'middle', indent: 1 }
    sheet.getRow(1).height = 44
    sheet.getCell(2, 1).value = '单位：元｜交易额按下单月份；本期到账按实际到账月份（含以前月份订单的到账）；未回款额为月末累计欠款，当前月截至导出时。'
    sheet.getCell(3, 1).value = `导出时间：${new Date(report.generatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}（北京时间）。范围：全部可见订单，排除已删除、已取消和零金额订单。`
    for (const row of [2, 3]) {
      sheet.getRow(row).height = months.length < 3 ? 60 : 30
      sheet.getCell(row, 1).font = { name: '微软雅黑', size: 10, color: { argb: '64748B' } }
      sheet.getCell(row, 1).alignment = { vertical: 'middle', wrapText: true }
    }
    const labels = sales ? ['序号', '城市', '销售'] : ['序号', '城市']
    labels.forEach((label, i) => { sheet.mergeCells(4, i + 1, 5, i + 1); sheet.getCell(4, i + 1).value = label })
    months.forEach((month, i) => {
      const start = fixed + 1 + i * 3
      sheet.mergeCells(4, start, 4, start + 2)
      sheet.getCell(4, start).value = `${month.slice(0, 4)}年${Number(month.slice(5))}月`
      ;['交易额', '本期到账', '月末未回款额'].forEach((label, j) => { sheet.getCell(5, start + j).value = label })
    })
    for (const row of [4, 5]) for (let col = 1; col <= lastColumn; col++) {
      const cell = sheet.getCell(row, col)
      cell.font = { name: '微软雅黑', size: 11, bold: true, color: { argb: 'FFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: col <= fixed ? '334155' : row === 4 ? (Math.floor((col - fixed - 1) / 3) % 2 ? '475569' : '1E3A5F') : colors[(col - fixed - 1) % 3]! } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    }
    sheet.getRow(4).height = 32
    sheet.getRow(5).height = 30
    const groups = groupRows(report.rows, sales)
    groups.forEach((group, index) => {
      const values: (string | number)[] = [index + 1, group.city]
      if (sales) values.push(group.employee)
      months.forEach(month => values.push(...(group.months.get(month) ?? [0, 0, 0]).map(value => value / 100)))
      const row = sheet.addRow(values)
      row.eachCell((cell, col) => {
        cell.font = { name: '微软雅黑', size: 11, color: { argb: col > fixed ? (cell.value === 0 ? '94A3B8' : colors[(col - fixed - 1) % 3]!) : '334155' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 ? (col > fixed ? metricFills[(col - fixed - 1) % 3]! : 'F1F5F9') : 'FFFFFF' } }
        cell.alignment = { vertical: 'middle', horizontal: col > fixed ? 'right' : col === 1 ? 'center' : 'left', indent: col === 1 ? 0 : 1 }
        cell.border = { bottom: { style: 'hair', color: { argb: 'E2E8F0' } } }
        if (col > fixed) cell.numFmt = '#,##0.00;[Red](#,##0.00);"—"'
      })
    })
    const totalRow = 6 + groups.length
    sheet.mergeCells(totalRow, 1, totalRow, fixed)
    sheet.getCell(totalRow, 1).value = groups.length ? '合计' : '合计（该范围无数据）'
    for (let col = fixed + 1; col <= lastColumn; col++) {
      const cell = sheet.getCell(totalRow, col)
      const sum = groups.reduce((total, group) => total + (group.months.get(months[Math.floor((col - fixed - 1) / 3)]!)?.[(col - fixed - 1) % 3] ?? 0), 0) / 100
      cell.value = groups.length ? { formula: `SUM(${sheet.getCell(6, col).address}:${sheet.getCell(totalRow - 1, col).address})`, result: sum } : 0
      cell.numFmt = '#,##0.00;[Red](#,##0.00);"—"'
    }
    sheet.getRow(totalRow).eachCell((cell, col) => {
      cell.font = { name: '微软雅黑', bold: true, size: 11, color: { argb: 'FFFFFF' } }
      cell.alignment = { vertical: 'middle', horizontal: col > fixed ? 'right' : 'left', indent: 1 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A5F' } }
    })
    sheet.getRow(totalRow).height = 34
    for (let row = 4; row <= totalRow; row++) {
      for (let col = fixed; col <= lastColumn; col += 3) {
        const cell = sheet.getCell(row, col)
        cell.border = { ...cell.border, right: { style: 'thin', color: { argb: 'CBD5E1' } } }
      }
    }
    sheet.headerFooter.oddFooter = '&L订单中心 · 月业绩&C第 &P 页 / 共 &N 页&R单位：元'
    sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: Math.max(5, totalRow - 1), column: lastColumn } }
    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 0, fitToHeight: 0, paperSize: 9, printTitlesRow: '1:5', printTitlesColumn: sales ? 'A:C' : 'A:B' }
  }
  return workbook
}

export async function monthlyPerformanceBlob(report: MonthlyPerformanceReport) {
  const workbook = await buildMonthlyPerformanceWorkbook(report)
  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
