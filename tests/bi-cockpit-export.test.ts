import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildCockpitDetailExcel } from '@/views/supply-chain/bi/cockpit-export'

describe('看板明细Excel', () => {
  it('保留筛选后全部行、数值格式、文本身份和样例标记', async () => {
    const rows = Array.from({ length: 27 }, (_, index) => ({
      key: String(index),
      name: index === 0 ? '=1+1' : `人员${index}`,
      sample: index === 0,
      cells: { 销售额: '¥1,234.56', 回款率: '125.0%', 客户数: '0', 编码: '00123', 成本: '待接入' },
    }))
    const result = await buildCockpitDetailExcel({
      title: '全国业绩',
      rows,
      columns: Object.keys(rows[0].cells),
      scope: [['城市', '全部城市']],
    })
    expect([...result.bytes.slice(0, 2)]).toEqual([80, 75])
    const book = new ExcelJS.Workbook()
    await book.xlsx.load(result.bytes as unknown as Parameters<typeof book.xlsx.load>[0])
    const sheet = book.getWorksheet('看板明细')!
    expect(sheet.rowCount).toBe(28)
    expect(sheet.getCell('A2').value).toBe('=1+1')
    expect(sheet.getCell('A2').formula).toBeUndefined()
    expect(sheet.getCell('B2').value).toBe('样例')
    expect(sheet.getCell('C2').value).toBe(1234.56)
    expect(sheet.getCell('D2').value).toBe(1.25)
    expect(sheet.getCell('E2').value).toBe(0)
    expect(sheet.getCell('F2').value).toBe('00123')
    expect(sheet.getCell('G2').value).toBe('待接入')
    expect(sheet.autoFilter).toBe('A1:G28')
    expect(book.getWorksheet('统计口径')!.getCell('B3').value).toBe('全部城市')
  })
  it('无数据时不下载空报表', async () => {
    await expect(
      buildCockpitDetailExcel({ title: '空', rows: [], columns: [], scope: [] }),
    ).rejects.toThrow('没有可导出')
  })
  it('只导出选定表头，拒绝无效字段并保护样例标记', async () => {
    const context = {
      title: '筛选导出',
      rows: [{ key: '1', name: '某城市', cells: { 销售额: '¥100.00', 客户数: '3' } }],
      columns: ['销售额', '客户数'],
      scope: [] as [string, string][],
    }
    const result = await buildCockpitDetailExcel({
      ...context,
      selectedColumns: ['名称', '销售额'],
    })
    const book = new ExcelJS.Workbook()
    await book.xlsx.load(result.bytes as unknown as Parameters<typeof book.xlsx.load>[0])
    const sheet = book.getWorksheet('看板明细')!
    expect(sheet.columnCount).toBe(2)
    expect(sheet.getCell('B1').value).toBe('销售额')
    expect(sheet.getCell('B2').value).toBe(100)
    await expect(buildCockpitDetailExcel({ ...context, selectedColumns: [] })).rejects.toThrow(
      '至少选择',
    )
    await expect(
      buildCockpitDetailExcel({ ...context, selectedColumns: ['不存在'] }),
    ).rejects.toThrow('无效')
    await expect(
      buildCockpitDetailExcel({ ...context, sample: true, selectedColumns: ['名称'] }),
    ).rejects.toThrow('必须保留')
  })
})
