import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import type { PaymentRiskOrder } from '@/api/core/payment-risk'
import { buildPaymentRiskExcel } from '@/views/supply-chain/bi/payment-risk-export'

const order: PaymentRiskOrder = {
  orderId: '1',
  orderNo: '001234567890123456789',
  customerName: '=1+1',
  regionCode: 'CD',
  regionName: '成都',
  ownerStaffCode: 'A',
  ownerStaffName: '业务员A',
  orderDate: '2026-09-25',
  ageDays: 25,
  orderAmount: 312.01,
  paidAmount: 100.13,
  products: [
    {
      categoryId: '1',
      categoryName: '台呢',
      productId: '1',
      productName: '台呢A',
      riskLevel: 'HIGH',
      productAmount: 100,
    },
    {
      categoryId: '2',
      categoryName: '配件',
      productId: '2',
      productName: '配件B',
      riskLevel: 'LOW',
      productAmount: 212.01,
    },
  ],
}
const context = {
  orders: [order],
  range: ['2026-09', '2026-10'] as [string, string],
  scope: [
    ['城市', '成都'],
    ['风险等级', '高风险'],
  ] as [string, string][],
  asOf: '2026-10-20',
  updated: '2026/10/20 09:55:00',
  demo: false,
}

async function readWorkbook(bytes: Uint8Array) {
  const directory = await mkdtemp(join(tmpdir(), 'payment-risk-export-'))
  try {
    const path = join(directory, '明细.xlsx')
    await writeFile(path, bytes)
    const book = new ExcelJS.Workbook()
    await book.xlsx.readFile(path)
    return book
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

describe('风险回款订单明细 Excel', () => {
  it('生成可读取的真实 Excel，金额为数值、订单号及公式样式名称保持文本，部分回款不抵扣', async () => {
    const before = structuredClone(context)
    const result = await buildPaymentRiskExcel(context)
    const book = await readWorkbook(result.bytes)
    const sheet = book.getWorksheet('订单明细')!
    expect(sheet.rowCount).toBe(2)
    expect(sheet.getCell('A2').value).toBe(order.orderNo)
    expect(sheet.getCell('A2').type).toBe(ExcelJS.ValueType.String)
    expect(sheet.getCell('B2').value).toBe('=1+1')
    expect(sheet.getCell('B2').type).toBe(ExcelJS.ValueType.String)
    expect(sheet.getCell('E2').value).toBe('2026-09-25')
    expect(sheet.getCell('F2').value).toBe(25)
    expect(sheet.getCell('G2').value).toBe(312.01)
    expect(sheet.getCell('H2').value).toBe(100.13)
    expect(sheet.getCell('G2').numFmt).toBe('#,##0.00####')
    expect(sheet.getCell('I2').value).toBe('台呢')
    expect(sheet.getCell('J2').value).toBe('台呢A')
    expect(sheet.getCell('K2').value).toBe('高风险')
    const scope = book.getWorksheet('查询条件')!
    const rows: unknown[][] = []
    scope.eachRow((row) => rows.push([row.getCell(1).value, row.getCell(2).value]))
    expect(rows).toContainEqual(['城市', '成都'])
    expect(rows).toContainEqual(['订单应收合计（元）', 312.01])
    expect(rows).toContainEqual(['账龄截至（北京时间）', '2026-10-20'])
    expect(result.filename).toBe('回款风险订单明细-2026-09_2026-10.xlsx')
    expect(context).toEqual(before)
  })

  it('导出超过一页的全部订单，保留输入顺序和待确认信息，并标明演示数据', async () => {
    const orders = Array.from({ length: 25 }, (_, i) => ({
      ...order,
      orderId: String(i),
      orderNo: `DEMO-${i}`,
      products: [],
      customerName: null,
      regionName: null,
      ownerStaffName: null,
    }))
    const result = await buildPaymentRiskExcel({ ...context, orders, demo: true })
    const book = await readWorkbook(result.bytes)
    const sheet = book.getWorksheet('订单明细')!
    expect(sheet.rowCount).toBe(26)
    expect(sheet.getCell('A26').value).toBe('DEMO-24')
    expect(sheet.getCell('B2').value).toBe('客户待确认')
    expect(sheet.getCell('K2').value).toBe('待确认')
    expect(result.filename).toMatch(/^演示-/)
    expect(book.getWorksheet('查询条件')!.getCell('B2').value).toContain('演示数据')
  })

  it('无订单时不生成空报表', async () => {
    await expect(buildPaymentRiskExcel({ ...context, orders: [] })).rejects.toThrow(
      '没有可导出的订单',
    )
  })
})
