import type { AdminArea, AdminDivisionCatalog } from '@/api/core/admin-divisions'
import { buildAdminAreaTree, GEO_REGIONS, type AdminAreaNode } from '@/utils/admin-divisions'
export const ADMIN_LEVELS = { PROVINCE: '省级', PREFECTURE: '地级', COUNTY: '县级' }
export interface DivisionExportSelection {
  level: AdminArea['level']
  provinceCode: string
  region: string
  keyword: string
}
export function selectDivisionExportRows(
  catalog: AdminDivisionCatalog,
  selection: DivisionExportSelection,
) {
  const rows: AdminAreaNode[] = []
  function visit(nodes: AdminAreaNode[], provinceCode = '') {
    for (const node of nodes) {
      const province = node.level === 'PROVINCE' ? node.code : provinceCode
      if (
        node.level === selection.level &&
        (!selection.provinceCode || province === selection.provinceCode) &&
        (!selection.region || node.region === selection.region) &&
        (!selection.keyword.trim() ||
          node.path.includes(selection.keyword.trim()) ||
          node.code.includes(selection.keyword.trim()))
      )
        rows.push(node)
      visit(node.children, province)
    }
  }
  visit(buildAdminAreaTree(catalog.nodes))
  return rows
}
export async function buildDivisionWorkbook(
  catalog: AdminDivisionCatalog,
  selection: DivisionExportSelection,
  scope: string,
) {
  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()
  const sheet = workbook.addWorksheet('行政区划')
  sheet.columns = [
    { header: '地区名称', key: 'name', width: 26 },
    { header: '行政编码', key: 'code', width: 16, style: { numFmt: '@' } },
    { header: '行政等级', key: 'levelName', width: 12 },
    { header: '所属大区', key: 'regionName', width: 12 },
    { header: '上级编码', key: 'parentCode', width: 16, style: { numFmt: '@' } },
    { header: '上级地区', key: 'parentName', width: 26 },
    { header: '行政路径', key: 'path', width: 65 },
  ]
  const rows = selectDivisionExportRows(catalog, selection)
  rows.forEach((node) =>
    sheet.addRow({
      ...node,
      levelName: ADMIN_LEVELS[node.level],
      regionName: GEO_REGIONS[node.region] || '—',
    }),
  )
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = { from: 'A1', to: `G${rows.length + 1}` }
  sheet.getRow(1).font = { bold: true, color: { argb: 'FF1F2329' } }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F3F6' } }
  sheet.eachRow((row) => {
    row.height = 22
  })
  const source = workbook.addWorksheet('导出说明')
  source.columns = [
    { header: '项目', width: 18 },
    { header: '内容', width: 85 },
  ]
  source.addRows([
    ['导出范围', scope],
    ['行政等级', ADMIN_LEVELS[selection.level]],
    ['查询关键词', selection.keyword || '无'],
    ['数据条数', rows.length],
    ['目录版本', catalog.version],
    ['数据来源', catalog.sourceName],
    ['来源参考', catalog.sourceRef],
    ['层级说明', '保留官方层级，直辖市及省直辖县不补造中间层级。未提供下级资料的地区不补造数据。'],
  ])
  return workbook
}
