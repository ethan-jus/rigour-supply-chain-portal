import type { PaymentRiskOrder } from '@/api/core/payment-risk'
import { attributedProduct, orderAmount, riskLevels } from './payment-risk-model'

interface PaymentRiskExportContext {
  orders: PaymentRiskOrder[]
  range: [string, string]
  scope: [string, string][]
  asOf: string
  updated: string
  demo: boolean
}

/** 接收看板已筛选、去重并排序的全部订单，沿用页面整单统计口径。 */
export async function buildPaymentRiskExcel(context: PaymentRiskExportContext) {
  if (!context.orders.length) throw new Error('当前查询没有可导出的订单')
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('订单明细', { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = [
    { header: '订单号', width: 28 },
    { header: '客户', width: 32 },
    { header: '城市', width: 18 },
    { header: '业务员', width: 18 },
    { header: '订单日期', width: 16 },
    { header: '账龄（天）', width: 14 },
    { header: '订单应收（统计金额，元）', width: 28 },
    { header: '已回款（不抵扣，元）', width: 24 },
    { header: '归属产品分类', width: 22 },
    { header: '归属产品', width: 32 },
    { header: '整单风险', width: 16 },
  ]
  for (const order of context.orders) {
    const product = attributedProduct(order)
    sheet.addRow([
      order.orderNo,
      order.customerName || '客户待确认',
      order.regionName || '城市待确认',
      order.ownerStaffName || '业务员待确认',
      order.orderDate,
      order.ageDays,
      order.orderAmount,
      order.paidAmount,
      product.categoryName || '分类待确认',
      product.productName || product.categoryName || '产品待确认',
      riskLevels.find((level) => level.key === product.riskLevel)?.name || '待确认',
    ])
  }
  sheet.getColumn(1).numFmt = '@'
  sheet.getColumn(6).numFmt = '0'
  for (const index of [7, 8]) sheet.getColumn(index).numFmt = '#,##0.00####'
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF285681' } }
  sheet.getRow(1).height = 30
  sheet.autoFilter = { from: 'A1', to: `K${sheet.rowCount}` }

  const scope = workbook.addWorksheet('查询条件')
  scope.columns = [
    { header: '项目', width: 26 },
    { header: '内容', width: 100 },
  ]
  scope.addRows([
    ['数据类型', context.demo ? '演示数据，不作为实际经营数据' : 'BI查询数据'],
    ['订单月份', context.range.join(' 至 ')],
    ...context.scope,
    ['账龄截至（北京时间）', context.asOf],
    ['订单记录最近同步（北京时间）', context.updated],
    ['导出订单数', context.orders.length],
    ['订单应收合计（元）', orderAmount(context.orders)],
    ['导出范围', '当前查询及下钻的全部订单，不受明细分页限制；仅包含当前账号有权查看的数据。'],
    [
      '统计口径',
      '每单一行；未结清订单按整单应收金额统计，不扣部分回款。归属最高风险产品，同风险取商品金额最大者。金额单位为元。',
    ],
    ['数据时间', '查询时间不代表来源已完整同步。'],
  ])
  scope.getColumn(2).alignment = { wrapText: true, vertical: 'top' }
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer())
  const filename = `${context.demo ? '演示-' : ''}回款风险订单明细-${context.range.join('_')}.xlsx`
  return { bytes, filename }
}
