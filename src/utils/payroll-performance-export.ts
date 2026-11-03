import type { Workbook, CellValue, Worksheet } from 'exceljs'
import type { PayrollPerformanceExport, PayrollRecord } from '@/api/core/payroll'
import { payrollUnitName } from './payroll-dictionaries'

const moneyFormat = '#,##0.00;[Red]-#,##0.00;0.00'
const numeric = (value: number | null | undefined): CellValue => (value == null ? '-' : value)
const quantity = (item: PayrollPerformanceExport['clothSales'][number] | undefined): CellValue => {
  if (!item || !Array.isArray(item.quantities))
    throw new Error('业绩服务尚未提供按单位销量，请更新HR服务后重新导出')
  return item.quantities.length
    ? item.quantities.map((q) => {
      const name = payrollUnitName(q.unitCode)
      return `${q.quantity} ${name === '单位待维护' ? `${name}（${q.unitCode}）` : name}`
    }).join(' / ')
    : 0
}
const ratio = (
  sheet: Worksheet,
  line: number,
  actual: number,
  target: number,
  a: number | null | undefined,
  t: number | null | undefined,
): CellValue =>
  a != null && t != null && t > 0
    ? {
        formula: `${sheet.getColumn(actual).letter}${line}/${sheet.getColumn(target).letter}${line}`,
        result: a / t,
      }
    : '-'

function tableStyle(sheet: Worksheet, lastColumn: number, headers: number) {
  sheet.eachRow((row, index) => {
    row.height = index === 1 ? 29 : 32
    for (let c = 1; c <= lastColumn; c++) {
      const cell = row.getCell(c)
      cell.font = { name: '宋体', size: index === 1 ? 15 : 11, bold: index <= headers }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      if (index > 1)
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        }
      if (index > headers && typeof cell.value === 'number') {
        cell.numFmt = moneyFormat
        cell.alignment.horizontal = 'right'
      }
    }
  })
  sheet.views = [{ state: 'frozen', xSplit: 3, ySplit: headers, showGridLines: false }]
  sheet.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 0,
    fitToHeight: 0,
    printTitlesRow: `1:${headers}`,
  }
}

/** 目标、实际、数量、金额分别展示，导出不重算工资。 */
export function appendPayrollPerformance(
  workbook: Workbook,
  records: PayrollRecord[],
  data: PayrollPerformanceExport[],
) {
  const byId = new Map(data.map((row) => [row.payrollId, row]))
  if (
    byId.size !== data.length ||
    data.length !== records.length ||
    records.some(
      (row) =>
        !byId.has(row.id) ||
        byId.get(row.id)!.payrollRevision !== row.revision ||
        byId.get(row.id)!.employeeCode !== row.employeeCode ||
        byId.get(row.id)!.month !== row.month,
    )
  )
    throw new Error('业绩来源与所选工资单不一致，请刷新后重新导出')
  const months = [...new Set(records.map((row) => row.month))]
  if (months.length !== 1) throw new Error('业绩汇总表每次只能导出一个月份')
  const ordered = [...data].sort(
    (a, b) =>
      (a.cityName || '').localeCompare(b.cityName || '', 'zh-CN') ||
      a.employeeName.localeCompare(b.employeeName, 'zh-CN') ||
      a.employeeCode.localeCompare(b.employeeCode),
  )
  const names = new Map<string, number>()
  records.forEach((row) => names.set(row.employeeName, (names.get(row.employeeName) ?? 0) + 1))
  const page = workbook.addWorksheet('项目业绩汇总')
  page.mergeCells('A1:AD1')
  page.getCell('A1').value = `${months[0]!.replace('-', '')}供应链项目业绩汇总表`
  for (const [from, to, label] of [
    [1, 1, '序号'],
    [2, 2, '城市'],
    [3, 3, '姓名'],
    [4, 5, '出勤'],
    [6, 7, '打卡'],
    [8, 9, '有效拜访数'],
    [10, 10, '绩效扣款'],
    [11, 13, '方便面'],
    [14, 16, '台球周边'],
    [17, 22, '台呢'],
    [23, 25, '回款'],
    [26, 28, '销售'],
    [29, 29, '总提成'],
    [30, 30, '备注'],
  ] as const) {
    page.mergeCells(2, from, from === to ? 3 : 2, to)
    page.getCell(2, from).value = label
  }
  const labels = [
    '应出勤',
    '实出勤',
    '应打卡',
    '实打卡',
    '应有效',
    '实有效',
    '',
    '销售额',
    '回款额',
    '提成',
    '销售额',
    '回款额',
    '提成',
    'A300/500B\n销量（按单位）',
    'A600/700/800\n销量（按单位）',
    '澳洋斯诺克\n销量（按单位）',
    '销售总额',
    '回款总额',
    '提成',
    '回款指标',
    '总回款额',
    '完成率',
    '销售指标',
    '总销售额',
    '完成率',
  ]
  labels.forEach((label, i) => {
    if (label) page.getCell(3, i + 4).value = label
  })
  ordered.forEach((row, index) => {
    const line = index + 4,
      summary = row.summary
    const fields = (code: string) => {
      const c = row.categories.find((c) => c.code === code)
      return [numeric(c?.salesAmount), numeric(c?.collectionAmount), numeric(c?.commission)]
    }
    const notes = [...row.issues]
    if (row.collectionTargetBasis) notes.push(row.collectionTargetBasis)
    if (row.entryDate) notes.push(`入职 ${row.entryDate}`)
    if (row.leaveDate) notes.push(`离职 ${row.leaveDate}`)
    if ((names.get(row.employeeName) ?? 0) > 1) notes.push(`员工编号 ${row.employeeCode}`)
    page.addRow([
      index + 1,
      row.cityName || '-',
      row.employeeName,
      numeric(summary?.expectedDays),
      numeric(summary?.actualDays),
      numeric(summary?.expectedCheckins),
      numeric(summary?.actualCheckins),
      numeric(summary?.expectedVisits),
      numeric(summary?.actualVisits),
      numeric(summary?.processDeduction),
      ...fields('NOODLES'),
      ...fields('ACCESSORIES'),
      ...['A300_A500', 'A600_A800', 'SNOOKER'].map((code) =>
        quantity(row.clothSales.find((c) => c.code === code)),
      ),
      ...fields('CLOTH'),
      numeric(row.collectionTarget),
      row.collectionAmount,
      ratio(page, line, 24, 23, row.collectionAmount, row.collectionTarget),
      numeric(row.salesTarget),
      row.salesAmount,
      ratio(page, line, 27, 26, row.salesAmount, row.salesTarget),
      numeric(row.commission),
      notes.join('；') || '-',
    ])
  })
  tableStyle(page, 30, 3)
  page.getRow(3).height = 48
  page.columns.forEach((c, i) => {
    c.width = i === 0 ? 6 : i === 29 ? 58 : i === 2 ? 13 : i >= 16 && i <= 18 ? 20 : 14
  })
  for (let r = 4; r <= ordered.length + 3; r++) {
    page.getCell(r, 1).numFmt = '0'
    for (const c of [25, 28]) page.getCell(r, c).numFmt = '0.00%'
    for (let c = 4; c <= 9; c++) page.getCell(r, c).numFmt = Number.isInteger(page.getCell(r, c).value) ? '0' : '0.0#'
    for (let c = 17; c <= 19; c++) page.getCell(r, c).numFmt = '0'
    page.getCell(r, 30).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    page.getRow(r).height = 48
    if (['CITY_MANAGER', 'TRAINEE_CITY_MANAGER'].includes(ordered[r - 4]!.role || ''))
      page.getRow(r).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9F1EF' } }
  }
  for (const c of [24, 27])
    page.getCell(3, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8CBAD' } }
  page.autoFilter = `A3:AD${ordered.length + 3}`
  page.headerFooter.oddFooter =
    '金额单位：元；台呢型号列为销量，按订单单位分别汇总。 第 &P 页 / 共 &N 页'
  appendCitySummary(workbook, ordered, months[0]!)
  const source = workbook.addWorksheet('品类业绩明细')
  source.addRow([
    '月份',
    '员工编号',
    '城市',
    '姓名',
    '商品品类',
    '当月销售额（元）',
    '整单付清业绩（元）',
    '工资快照提成（元）',
  ])
  ordered.forEach((row) =>
    row.categories.forEach((c) =>
      source.addRow([
        row.month,
        row.employeeCode,
        row.cityName || '-',
        row.employeeName,
        c.name,
        c.salesAmount,
        c.collectionAmount,
        numeric(c.commission),
      ]),
    ),
  )
  const end = source.rowCount
  source.addRow([])
  for (const [label, text] of [
    ['销售', '销售按下单月，按订单应付金额分摊整单优惠；型号列按订单数量和单位分别汇总。'],
    ['回款', '按当月首次整单付清业绩（含跨月订单），未付清订单不计入。'],
    ['提成', '主表沿用已保存工资；历史补算先导出提成试算差异，不在导出时保存工资。'],
    ['过程', '应/实打卡和拜访来自保存的日明细；扣款采用保存的过程绩效扣款。'],
    [
      '指标',
      '回款目标按工资采用的绩效规则及月度核定值，首个自然月免考核。销售目标独立，未配置时显示“-”。',
    ],
  ]) {
    const r = source.addRow([label, text]).number
    source.mergeCells(`B${r}:H${r}`)
    source.getRow(r).height = 36
    source.getCell(r, 2).alignment = { wrapText: true, vertical: 'middle' }
  }
  source.getRow(1).font = { bold: true }
  source.columns.forEach((c, i) => {
    c.width = i === 1 ? 28 : i >= 5 ? 23 : 16
  })
  for (let r = 2; r <= end; r++)
    for (let c = 6; c <= 8; c++) source.getCell(r, c).numFmt = moneyFormat
  source.views = [{ state: 'frozen', ySplit: 1 }]
  source.autoFilter = `A1:H${end}`
  const evidence = workbook.addWorksheet('业绩指标依据')
  evidence.addRow([
    '月份',
    '城市',
    '员工编号',
    '姓名',
    '业务指标',
    '实际值',
    '目标值',
    '权重（%）',
    '核定/规则依据',
  ])
  for (const row of ordered)
    for (const m of row.metrics || [])
      if (!['CONTACTED_STORE_COUNT', 'ORDERED_STORE_COUNT'].includes(m.code))
        evidence.addRow([
          row.month,
          row.cityName || '-',
          row.employeeCode,
          row.employeeName,
          m.name,
          numeric(m.actual),
          numeric(m.target),
          numeric(m.weight),
          m.evidence || '-',
        ])
  evidence.columns.forEach((c, i) => {
    c.width = i === 8 ? 65 : i === 2 ? 28 : 20
  })
  evidence.getRow(1).font = { bold: true }
  evidence.views = [{ state: 'frozen', ySplit: 1 }]
  evidence.autoFilter = `A1:I${evidence.rowCount}`
}

function appendCitySummary(workbook: Workbook, data: PayrollPerformanceExport[], month: string) {
  const sheet = workbook.addWorksheet('城市业绩汇总')
  sheet.mergeCells('A1:J1')
  sheet.getCell('A1').value = `${month}城市业绩汇总（本次导出人员）`
  sheet.addRow([
    '序号',
    '城市',
    '人数',
    '方便面销售额',
    '台球周边销售额',
    '台呢销售额',
    '销售总额',
    '整单付清业绩',
    '提成合计',
    '核对状态',
  ])
  const groups = new Map<string, PayrollPerformanceExport[]>()
  for (const row of data) {
    const key =
      row.cityCode || (row.cityName ? `name:${row.cityName}` : `unknown:${row.employeeCode}`)
    groups.set(key, [...(groups.get(key) || []), row])
  }
  let i = 0
  for (const rows of groups.values()) {
    const total = (read: (r: PayrollPerformanceExport) => number | null | undefined): CellValue =>
      rows.some((r) => read(r) == null)
        ? '-'
        : Math.round(rows.reduce((sum, r) => sum + read(r)!, 0) * 100) / 100
    sheet.addRow([
      ++i,
      rows[0]!.cityName || '-',
      rows.length,
      ...['NOODLES', 'ACCESSORIES', 'CLOTH'].map((code) =>
        total((r) => r.categories.find((c) => c.code === code)?.salesAmount),
      ),
      total((r) => r.salesAmount),
      total((r) => r.collectionAmount),
      total((r) => r.commission),
      rows.some((r) => r.commission == null)
        ? '提成未全部核定，不能将部分金额当作总提成'
        : '已保存工资快照；仅限本次导出人员',
    ])
  }
  tableStyle(sheet, 10, 2)
  for (let r = 3; r <= sheet.rowCount; r++) for (const c of [1, 3]) sheet.getCell(r, c).numFmt = '0'
  sheet.columns.forEach((c, i) => {
    c.width = i === 9 ? 60 : i < 3 ? 14 : 21
  })
  sheet.autoFilter = `A2:J${sheet.rowCount}`
}
