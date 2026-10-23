import { buildCostWorkbook, downloadCostWorkbook } from '../../cost/cost-export'

/** 服务端导出已固定快照且重新验证权限；这里只转换文件格式，不重新请求或汇总业务数据。 */
export function parseCostCsv(content: string): string[][] {
  const text = content.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = [],
    value = '',
    quoted = false,
    closed = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        value += '"'
        i++
      } else if (char === '"') {
        quoted = false
        closed = true
      } else value += char
    } else if (char === '"' && !value && !closed) quoted = true
    else if (char === ',' || char === '\r' || char === '\n') {
      row.push(value)
      value = ''
      closed = false
      if (char !== ',') {
        rows.push(row)
        row = []
        if (char === '\r' && text[i + 1] === '\n') i++
      }
    } else {
      if (closed || char === '"') throw new Error('导出内容格式异常，请重新导出')
      value += char
    }
  }
  if (quoted) throw new Error('导出内容不完整，请重新导出')
  if (row.length || value || closed) {
    row.push(value)
    rows.push(row)
  }
  return rows
}

const treatments: Record<string, string> = {
  DIRECT: '正常计入',
  LINKED: '已关联原费用，不重复计入',
  REVIEW: '待核对，暂不计入',
}
const required = [
  '来源服务',
  '源ID',
  '单据号',
  '事项',
  '费用类别',
  '城市',
  '费用日期',
  '金额（元）',
  '确认状态',
  '付款状态',
  '原始来源',
  '费用所属月',
  '成本处理',
  '计入成本金额（元）',
]
const columns = [
  '单据号',
  '事项',
  '费用类别',
  '城市',
  '费用日期',
  '费用所属月',
  '金额（元）',
  '计入成本金额（元）',
  '确认状态',
  '付款状态',
  '成本处理',
]

export async function buildCostDashboardWorkbook(content: string) {
  const parsed = parseCostCsv(content)
  const headerIndex = parsed.findIndex((row) => required.every((label) => row.includes(label)))
  if (headerIndex < 0) throw new Error('导出字段不完整，请重新导出')
  const headers = parsed[headerIndex]!
  const details = parsed.slice(headerIndex + 1)
  if (details.some((row) => row.length !== headers.length))
    throw new Error('导出明细不完整，请重新导出')
  const metadata = new Map<string, string>()
  for (const row of parsed.slice(0, headerIndex)) {
    for (let i = 0; i + 1 < row.length; i += 2) metadata.set(row[i]!, row[i + 1]!)
  }
  if (Number(metadata.get('匹配笔数')) !== details.length)
    throw new Error('导出笔数与明细不一致，请重新导出')
  const get = (row: string[], label: string) => row[headers.indexOf(label)] ?? ''
  const rows = details.map((row) =>
    columns.map((label) => {
      let value = get(row, label)
      // CSV 的前缀只用于防公式注入；XLSX 明确以字符串存储，可还原业务原文。
      if (/^'[\s]*[=+@-]|^'[\t\r]/.test(value)) value = value.slice(1)
      if (label === '成本处理') return treatments[value] ?? '待核对，暂不计入'
      return value
    }),
  )
  const workbook = await buildCostWorkbook(
    '支出明细',
    columns.map(
      (label) =>
        ({
          '金额（元）': '单据金额（元）',
          费用所属月: '费用所属月份',
          成本处理: '统计处理',
          城市: '费用归属',
        })[label] ?? label,
    ),
    rows,
  )
  return workbook
}

export async function exportCostDashboardWorkbook(blob: Blob) {
  const workbook = await buildCostDashboardWorkbook(await blob.text())
  await downloadCostWorkbook(workbook, '成本数据看板_支出明细')
}
