import { describe, expect, it } from 'vitest'
import { Workbook } from 'exceljs'
import { buildDivisionWorkbook, selectDivisionExportRows } from '@/utils/admin-division-export'
import type { AdminDivisionCatalog } from '@/api/core/admin-divisions'
const catalog: AdminDivisionCatalog = {
  version: 'test-version',
  sourceName: '测试来源',
  sourceRef: '测试参考',
  nodes: [
    { code: '110000', name: '北京市', level: 'PROVINCE', parentCode: null, regionCode: 'NORTH' },
    { code: '110101', name: '东城区', level: 'COUNTY', parentCode: '110000', regionCode: null },
    { code: '330000', name: '浙江省', level: 'PROVINCE', parentCode: null, regionCode: 'EAST' },
    { code: '330100', name: '杭州市', level: 'PREFECTURE', parentCode: '330000', regionCode: null },
    ...Array.from({ length: 65 }, (_, i) => ({
      code: String(330101 + i),
      name: `县${i}`,
      level: 'COUNTY' as const,
      parentCode: '330100',
      regionCode: null,
    })),
  ],
}
const scope = { provinceCode: '', region: '', keyword: '', level: 'PROVINCE' as const }
describe('行政区划 Excel 导出', () => {
  it('按等级、地区和关键词选取完整范围，不受列表 50 条分页限制', () => {
    expect(selectDivisionExportRows(catalog, { ...scope, provinceCode: '330000' })).toHaveLength(1)
    expect(
      selectDivisionExportRows(catalog, { ...scope, level: 'PREFECTURE', region: 'NORTH' }),
    ).toHaveLength(0)
    expect(
      selectDivisionExportRows(catalog, { ...scope, level: 'COUNTY', provinceCode: '330000' }),
    ).toHaveLength(65)
    expect(
      selectDivisionExportRows(catalog, { ...scope, level: 'COUNTY', keyword: '330101' }),
    ).toHaveLength(1)
  })
  it('Excel 可重新读取，编码为文本，直辖县不补造中间层级，并记录来源', async () => {
    const workbook = await buildDivisionWorkbook(catalog, { ...scope, level: 'COUNTY' }, '全国')
    const loaded = new Workbook()
    await loaded.xlsx.load(await workbook.xlsx.writeBuffer())
    const sheet = loaded.getWorksheet('行政区划')!
    expect(sheet.rowCount).toBe(67)
    expect(sheet.getCell('B2').value).toBe('110101')
    expect(sheet.getCell('B2').numFmt).toBe('@')
    expect(sheet.getCell('E2').value).toBe('110000')
    expect(sheet.getCell('G2').value).toBe('北京市 / 东城区')
    expect(loaded.getWorksheet('导出说明')!.getCell('B6').value).toBe('test-version')
  })
})
