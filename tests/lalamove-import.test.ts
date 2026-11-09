import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Workbook } from 'exceljs'
import { lalamoveTemplate, parseLalamoveWorkbook } from '@/views/supply-chain/cost/lalamove-import'
const download = vi.hoisted(() => vi.fn())
vi.mock('@/views/supply-chain/cost/cost-export', () => ({ downloadCostWorkbook: download }))
const originalHeaders = [
  '企业ID',
  '订单号',
  '订单状态',
  '用车时间',
  '完成时间',
  '车型',
  '发货城市',
  '起始路线',
  '终点城市',
  '收货人信息',
  '订单金额(元)',
  '实付金额(元)',
  '额外费用',
  '下单人(员工)',
  '上级部门',
  '部门',
  '销售订单号',
]
const bill = [
  '67596986',
  '3616894445226123730',
  '已完成',
  '2026-11-06 10:00:00',
  '',
  '小面包车',
  '武汉',
  '武汉仓',
  '武汉',
  '星河门店',
  47.47,
  40.5,
  6.54,
  '下单人员',
  '',
  '外部部门',
  'SO001;SO002',
]
async function roundTrip(book: Workbook) {
  const restored = new Workbook()
  await restored.xlsx.load(await book.xlsx.writeBuffer())
  return restored
}
function workbook(values: unknown[][] = [bill]) {
  const book = new Workbook(),
    sheet = book.addWorksheet('货拉拉订单')
  sheet.addRow(originalHeaders)
  values.forEach((row) => sheet.addRow(row))
  return book
}
beforeEach(() => download.mockClear())
describe('货拉拉下载模板和报表导入', () => {
  it('下载空白填报表、独立示例与说明，真实xlsx往返后长单号仍是完整文本', async () => {
    await lalamoveTemplate()
    expect(download).toHaveBeenCalledOnce()
    expect(download.mock.calls[0]![1]).toBe('货拉拉订单导入模板')
    const book = await roundTrip(download.mock.calls[0]![0])
    expect(book.worksheets.map((s) => s.name)).toEqual(['导入数据', '填写示例', '填写说明'])
    const data = book.worksheets[0]!,
      example = book.worksheets[1]!
    expect(data.rowCount).toBe(1)
    expect(data.columnCount).toBe(6)
    expect(data.getRow(1).values).toEqual([
      undefined,
      '货拉拉订单号',
      '用车时间',
      '订单状态',
      '实付金额(元)',
      '销售订单号',
      '收货人信息',
    ])
    expect(example.getCell('A2').value).toBe('3616894445226123730')
    expect(data.getColumn(1).numFmt).toBe('@')
    await expect(parseLalamoveWorkbook(book)).rejects.toThrow('没有可导入')
    data.addRow(example.getRow(2).values)
    const preview = await parseLalamoveWorkbook(await roundTrip(book))
    expect(preview.errors).toEqual([])
    expect(preview.rows).toHaveLength(1)
    expect(preview.rows[0]).toMatchObject({
      orderNo: '3616894445226123730',
      enterpriseId: '',
      paidAmount: '35',
      salesOrderNos: [],
    })
  })
  it('读取原始报表说明和汇总行；以实付金额为准不叠加额外费用', async () => {
    const book = workbook([]),
      sheet = book.worksheets[0]!
    sheet.addRow(['说明：订单金额含额外费用'])
    sheet.mergeCells('A2:Q2')
    sheet.addRow(['订单查询结果：订单总数1'])
    sheet.mergeCells('A3:Q3')
    sheet.addRow(bill)
    const result = await parseLalamoveWorkbook(await roundTrip(book))
    expect(result.errors).toEqual([])
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({
      paidAmount: '40.5',
      salesOrderNos: ['SO001', 'SO002'],
      line: 4,
    })
    expect(result.rows[0]!.raw['额外费用']).toBe('6.54')
    expect(result.rows[0]!.raw['部门']).toBe('外部部门')
  })
  it.each([3616894445226123700, '3.61689444522612E+18', '361689E18'])(
    '拒绝已经损失精度或科学计数法单号 %s',
    async (order) => {
      const row = [...bill]
      row[1] = order
      const result = await parseLalamoveWorkbook(await roundTrip(workbook([row])))
      expect(result.rows).toHaveLength(0)
      expect(result.errors[0]!.message).toMatch(/精度|科学计数法/)
    },
  )
  it('可选销售单号缺失时不从其他列取值，零元账单保留为0', async () => {
    const book = workbook([]),
      sheet = book.worksheets[0]!
    sheet.getCell('Q1').value = '附加信息'
    const row = [...bill]
    row[11] = 0
    row[16] = '不是销售单'
    sheet.addRow(row)
    sheet.getCell(2, 100).value = '不能错读的内容'
    const result = await parseLalamoveWorkbook(await roundTrip(book))
    expect(result.rows[0]).toMatchObject({ paidAmount: '0', salesOrderNos: [] })
  })
  it('重复单号、缺失必填、公式、非法日期均返回准确行号，不静默忽略', async () => {
    const empty = [...bill]
    empty[1] = ''
    const badDate = [...bill]
    badDate[1] = 'HL000003'
    badDate[3] = '2026-02-31'
    const formula = [...bill]
    formula[1] = 'HL000004'
    const book = workbook([bill, bill, empty, badDate, formula])
    book.worksheets[0]!.getCell('L6').value = { formula: '1+2', result: 3 }
    const result = await parseLalamoveWorkbook(await roundTrip(book))
    expect(result.rows).toHaveLength(1)
    expect(result.errors.map((r) => r.line)).toEqual([3, 4, 5, 6])
    expect(result.errors.map((r) => r.message).join('|')).toMatch(/重复.*缺少.*日期无效.*公式/)
  })
  it('空白必填表头和重复表头阻止导入', async () => {
    const book = workbook()
    book.worksheets[0]!.getCell('L1').value = ''
    await expect(parseLalamoveWorkbook(book)).rejects.toThrow('缺少')
    book.worksheets[0]!.getCell('L1').value = '实付金额(元)'
    book.worksheets[0]!.getCell('M1').value = '实付金额（元）'
    await expect(parseLalamoveWorkbook(book)).rejects.toThrow('重复列')
  })
})
