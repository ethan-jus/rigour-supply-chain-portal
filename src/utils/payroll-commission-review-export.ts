import type { PayrollCommissionReview, PayrollRecord } from '@/api/core/payroll'
import { loadPayrollProductUnits, payrollUnitName } from './payroll-dictionaries'
import { payrollStatusLabel } from './payroll-workflow'

export async function buildCommissionReviewWorkbook(
  records: PayrollRecord[],
  reviews: PayrollCommissionReview[],
) {
  const excel = await import('exceljs')
  const { Workbook } = excel.default || excel
  const byId = new Map(reviews.map((r) => [r.payrollId, r]))
  if (
    records.length !== reviews.length ||
    byId.size !== reviews.length ||
    records.some((r) => {
      const item = byId.get(r.id)
      return (
        !item ||
        item.employeeCode !== r.employeeCode ||
        item.payrollRevision !== r.revision ||
        item.month !== r.month ||
        item.sourceFingerprint !== r.calculation.sourceFingerprint
      )
    })
  )
    throw new Error('提成试算与所选工资单不一致，请刷新后重新导出')
  await loadPayrollProductUnits()
  const book = new Workbook()
  const summary = book.addWorksheet('提成试算差异')
  summary.addRow([
    '月份',
    '员工编号',
    '姓名',
    '工资状态',
    '原提成（元）',
    '试算提成（元）',
    '差额（元）',
    '已匹配小计（非完整提成）',
    '核对状态',
    '核对原因',
  ])
  for (const record of records) {
    const r = byId.get(record.id)!
    summary.addRow([
      r.month,
      r.employeeCode,
      r.employeeName,
      payrollStatusLabel(record, ''),
      r.savedCommission ?? '-',
      r.previewCommission ?? '-',
      r.difference ?? '-',
      r.resolvedSubtotal,
      r.issues.length ? '仍需核定' : '只读试算，未保存工资',
      r.issues.join('；') || '原提成缺失时差额不按零计算；人工调整已包含在试算中',
    ])
  }
  const lines = book.addWorksheet('逐订单商品差异')
  lines.addRow([
    '月份',
    '员工编号',
    '姓名',
    '来源行',
    '计提身份',
    '订单号',
    '商品名称',
    '单位',
    '数量',
    '原金额',
    '试算金额',
    '采用规则',
    '试算依据',
  ])
  for (const r of reviews)
    for (const line of r.lines)
      lines.addRow([
        r.month,
        r.employeeCode,
        r.employeeName,
        line.sourceLineId,
        line.recipientRole,
        line.orderNo,
        line.productName,
        payrollUnitName(line.unitCode),
        line.quantity ?? '-',
        line.savedAmount ?? '-',
        line.previewAmount ?? '-',
        line.ruleName || '-',
        line.basis || '-',
      ])
  for (const sheet of book.worksheets) {
    sheet.columns.forEach((c, i) => {
      c.width = i === sheet.columnCount - 1 ? 80 : i === 1 || i === 3 ? 28 : 20
    })
    sheet.getRow(1).font = { bold: true }
    sheet.getRow(1).height = 36
    sheet.views = [{ state: 'frozen', xSplit: 3, ySplit: 1 }]
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: sheet.rowCount, column: sheet.columnCount },
    }
    sheet.eachRow((row, n) => {
      if (n > 1)
        row.eachCell((cell) => {
          if (typeof cell.value === 'number') cell.numFmt = '#,##0.00'
          cell.alignment = { vertical: 'middle', wrapText: true }
        })
    })
  }
  return book
}

export async function exportCommissionReviewWorkbook(
  records: PayrollRecord[],
  reviews: PayrollCommissionReview[],
) {
  await loadPayrollProductUnits(true)
  const book = await buildCommissionReviewWorkbook(records, reviews)
  const bytes = new Uint8Array(await book.xlsx.writeBuffer())
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  )
  const a = document.createElement('a')
  a.href = url
  a.download = `提成试算差异_${records[0]?.month || ''}_${Date.now()}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
