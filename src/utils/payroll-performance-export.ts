import type { Workbook, CellValue } from 'exceljs'
import type { PayrollPerformanceExport, PayrollRecord } from '@/api/core/payroll'

const moneyFormat = '#,##0.00;[Red]-#,##0.00;0.00'
const numeric = (value: number | null | undefined): CellValue => value == null ? '-' : value

/** The first worksheet matches the business performance report; source measures stay distinct. */
export function appendPayrollPerformance(workbook: Workbook, records: PayrollRecord[], data: PayrollPerformanceExport[]) {
  const byId = new Map(data.map(row => [row.payrollId, row]))
  if (byId.size !== data.length || data.length !== records.length || records.some(row =>
    !byId.has(row.id) || byId.get(row.id)!.payrollRevision !== row.revision ||
    byId.get(row.id)!.employeeCode !== row.employeeCode || byId.get(row.id)!.month !== row.month))
    throw new Error('业绩来源与所选工资单不一致，请刷新后重新导出')
  const months = [...new Set(records.map(row => row.month))]
  if (months.length !== 1) throw new Error('业绩汇总表每次只能导出一个月份')
  const orderedRecords = [...records].sort((left, right) =>
    (byId.get(left.id)!.cityName || '').localeCompare(byId.get(right.id)!.cityName || '', 'zh-CN') ||
    left.employeeName.localeCompare(right.employeeName, 'zh-CN') || left.employeeCode.localeCompare(right.employeeCode))
  const page = workbook.addWorksheet('项目业绩汇总')
  page.mergeCells('A1:W1')
  page.getCell('A1').value = `${months[0]!.replace('-', '')}供应链项目业绩汇总表`
  page.getRow(1).font = { name: '宋体', size: 15, bold: true }
  page.getRow(1).height = 29
  for (const [range, title] of [['A2:A3', '序号'], ['B2:B3', '城市'], ['C2:C3', '姓名'],
    ['D2:F2', '方便面'], ['G2:I2', '台球周边'], ['J2:O2', '台呢'],
    ['P2:R2', '回款'], ['S2:U2', '销售'], ['V2:V3', '总提成'], ['W2:W3', '备注']]) {
    page.mergeCells(range!)
    page.getCell(range!.split(':')[0]!).value = title!
  }
  const labels = ['销售额', '回款额', '提成', '销售额', '回款额', '提成',
    'A300/500B', 'A600/700/800', '澳洋斯诺克', '销售总额', '回款总额', '提成',
    '回款指标', '总回款额', '完成率', '销售指标', '总销售额', '完成率']
  labels.forEach((value, index) => { page.getCell(3, index + 4).value = value })
  page.getRow(2).height = 24
  page.getRow(3).height = 42
  const names = new Map<string, number>()
  records.forEach(row => names.set(row.employeeName, (names.get(row.employeeName) ?? 0) + 1))
  orderedRecords.forEach((record, index) => {
    const row = byId.get(record.id)!
    const category = (code: string) => row.categories.find(item => item.code === code)
    const fields = (code: string) => {
      const item = category(code)
      return [numeric(item?.salesAmount), numeric(item?.collectionAmount), numeric(item?.commission)]
    }
    const line = index + 4
    const issues = [...row.issues]
    if ((names.get(record.employeeName) ?? 0) > 1) issues.push(`员工编号 ${record.employeeCode}`)
    const values: CellValue[] = [index + 1, row.cityName || '-', row.employeeName,
      ...fields('NOODLES'), ...fields('ACCESSORIES'),
      ...['A300_A500', 'A600_A800', 'SNOOKER'].map(code => numeric(row.clothSales.find(item => item.code === code)?.salesAmount)),
      ...fields('CLOTH'), numeric(row.collectionTarget), row.collectionAmount,
      row.collectionTarget != null && row.collectionTarget > 0
        ? { formula: `Q${line}/P${line}`, result: row.collectionAmount / row.collectionTarget } : '-',
      numeric(row.salesTarget), row.salesAmount,
      row.salesTarget != null && row.salesTarget > 0
        ? { formula: `T${line}/S${line}`, result: row.salesAmount / row.salesTarget } : '-',
      numeric(row.commission), issues.join('；') || '-']
    page.addRow(values)
    page.getRow(line).height = Math.max(31, Math.min(75, Math.ceil(issues.join('；').length / 28) * 17))
  })
  page.columns.forEach((column, index) => { column.width = index === 0 ? 6 : index === 22 ? 54 : index === 2 ? 13 : 14 })
  page.eachRow((row, index) => {
    row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      if (index > 1) cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
      if (index > 1) cell.font = { name: '宋体', size: 11, bold: index <= 3 }
      if (index >= 4 && column >= 4 && column <= 22) {
        cell.numFmt = [18, 21].includes(column) ? '0.00%' : moneyFormat
        cell.alignment = { vertical: 'middle', horizontal: 'right' }
      }
      if (column === 23 && index >= 4) cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    })
  })
  for (const address of ['Q3', 'T3']) page.getCell(address).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8CBAD' } }
  page.views = [{ state: 'frozen', xSplit: 3, ySplit: 3, showGridLines: false }]
  page.autoFilter = { from: 'A3', to: `W${records.length + 3}` }
  page.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:3' }
  page.headerFooter.oddFooter = '金额单位：元                                      第 &P 页 / 共 &N 页'

  const source = workbook.addWorksheet('品类业绩明细')
  source.addRow(['月份', '员工编号', '城市', '姓名', '商品品类', '当月销售额（元）', '整单付清业绩（元）', '工资快照提成（元）'])
  orderedRecords.forEach(record => {
    const row = byId.get(record.id)!
    row.categories.forEach(item => source.addRow([row.month, row.employeeCode, row.cityName || '-', row.employeeName,
      item.name, item.salesAmount, item.collectionAmount, numeric(item.commission)]))
  })
  const detailEnd = source.rowCount
  source.addRow([])
  source.addRow(['口径', '销售按下单月，排除草稿及作废订单；销售金额按订单应付金额分摊整单优惠。'])
  source.addRow(['回款', '按当月首次整单付清业绩（含跨月订单），按商品行金额分摊至品类；未付清订单不计入。'])
  source.addRow(['提成', '沿用已保存工资单金额，不在导出时重算；缺失金额显示“-”，不能作为零提成。'])
  source.addRow(['来源', 'Order销售订单及首次整单付清事实、ERP商品分类、HR月度经营指标与工资快照。'])
  for (let r = source.rowCount - 3; r <= source.rowCount; r++) {
    source.mergeCells(`B${r}:H${r}`)
    source.getCell(r, 2).alignment = { vertical: 'middle', wrapText: true }
    source.getRow(r).height = 32
  }
  source.getRow(1).font = { bold: true }
  source.columns.forEach((column, index) => { column.width = index === 1 ? 28 : index >= 5 ? 23 : 16 })
  for (let r = 2; r <= detailEnd; r++) {
    for (let c = 6; c <= 8; c++) source.getCell(r, c).numFmt = moneyFormat
  }
  source.views = [{ state: 'frozen', ySplit: 1 }]
  source.autoFilter = `A1:H${detailEnd}`
}
