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

const required = [
  '单据号',
  '事项',
  '费用类别',
  '城市',
  '费用日期',
  '金额（元）',
  '确认状态',
  '付款状态',
  '费用所属月',
]
const columns = [
  '单据号',
  '事项',
  '费用类别',
  '城市',
  '费用日期',
  '费用所属月',
  '金额（元）',
  '确认状态',
  '付款状态',
]

export async function buildCostDashboardWorkbook(content: string, context = '') {
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
          城市: '费用归属',
        })[label] ?? label,
    ),
    rows,
  )
  const notes = [
    ...(context ? [['导出范围', context]] : []),
    ...['本期', '可比期', '匹配笔数', '已确认金额']
      .filter((key) => metadata.has(key))
      .map((key) => [
        key,
        `${metadata.get(key)}${key === '已确认金额' ? ' 元' : key === '匹配笔数' ? ' 笔' : ''}`,
      ]),
    ['纳入范围', '仅已确认且实际计入汇总的费用，关联报销不重复计入。'],
    [
      '付款状态',
      '薪酬按月度薪酬发放登记，其他费用按原单登记；未付款金额不代表银行流水或工资待发净额。',
    ],
  ]
  const summary = workbook.addWorksheet('导出说明')
  summary.addRow(['项目', '内容'])
  summary.addRows(notes)
  summary.getColumn(1).width = 22
  summary.getColumn(2).width = 85
  summary.eachRow((row, index) => {
    row.height = index === 1 ? 30 : 52
    row.eachCell((cell) => {
      cell.font = { name: '微软雅黑', size: 11, bold: index === 1 }
      cell.alignment = { vertical: 'middle', wrapText: true }
    })
  })
  summary.views = [{ state: 'frozen', ySplit: 1 }]
  return workbook
}

export async function exportCostDashboardWorkbook(blob: Blob, context = '') {
  const workbook = await buildCostDashboardWorkbook(await blob.text(), context)
  await downloadCostWorkbook(workbook, '成本数据看板_支出明细')
}
