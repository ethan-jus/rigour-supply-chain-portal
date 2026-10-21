import { describe, expect, it } from 'vitest'
import { buildCostWorkbook } from '@/views/supply-chain/cost/cost-export'
import { Workbook } from 'exceljs'
describe('cost Excel export', () => {
  it('round trips leading-zero documents, literal formula text, zero and missing amounts', async () => {
    const workbook = await buildCostWorkbook(
      '运费',
      ['原始单号', '金额', '来源'],
      [
        ['0000123', 0, '订货宝'],
        ['=1+1', null, '手工补录'],
        ['0000124', 12.34, '本系统'],
      ],
    )
    const restored = new Workbook()
    await restored.xlsx.load(await workbook.xlsx.writeBuffer())
    const sheet = restored.worksheets[0]!
    expect(sheet.getCell('A2').value).toBe('0000123')
    expect(sheet.getCell('B2').value).toBe(0)
    expect(sheet.getCell('A3').value).toBe('=1+1')
    expect(sheet.getCell('B3').value).toBeNull()
    expect(sheet.getCell('B4').value).toBe(12.34)
    expect(sheet.rowCount).toBe(4)
  })
})
