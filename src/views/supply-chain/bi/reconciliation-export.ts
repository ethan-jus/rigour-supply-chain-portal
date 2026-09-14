import type { Cell, Worksheet } from 'exceljs'
import {
  getReconciliationReview,
  type ReconciliationFact,
  type ReconciliationPage,
  type ReconciliationQuery,
} from '@/api/core/bi-reconciliation-review'
import { businessDate, businessDateTime } from '@/utils/business-date'
import { reportMoneyText, reportQuantityText } from './report-format'
import {
  associationEvidenceName,
  factWarnings,
  originalUnit,
  reconciliationDimensions,
  reconciliationStatusName,
  reconciliationWarnings,
  unitEvidenceName,
} from './reconciliation-display'

export async function readReconciliationExport(
  snapshot: ReconciliationPage,
  query: ReconciliationQuery,
): Promise<ReconciliationPage> {
  const rows: ReconciliationPage['rows'] = []
  const keys = new Set<string>()
  const pageSize = 50
  for (let page = 1; page <= Math.max(1, Math.ceil(snapshot.total / pageSize)); page++) {
    const data = await getReconciliationReview(snapshot.id, { ...query, page, pageSize })
    if (
      data.id !== snapshot.id ||
      data.total !== snapshot.total ||
      data.page !== page ||
      data.pageSize !== pageSize ||
      data.rows.length !== Math.min(pageSize, Math.max(0, snapshot.total - rows.length))
    )
      throw new Error('导出范围或分页结果不一致，请重新查询；未导出不完整结果')
    for (const row of data.rows) {
      if (row.kind !== query.kind || keys.has(row.key))
        throw new Error('导出出现重复或粒度不符的记录，请重新查询')
      keys.add(row.key)
      rows.push(row)
    }
  }
  return { ...snapshot, rows }
}

function setText(cell: Cell, value: string) {
  if (value.length > 32767) throw new Error('内容超过 Excel 单元格上限，请缩小导出范围')
  cell.value = value
  cell.numFmt = '@'
}

function setNumber(cell: Cell, value: unknown, money: boolean) {
  if (value == null) {
    setText(cell, '未提供')
    return
  }
  const text = money ? reportMoneyText(value) : reportQuantityText(value)
  const numeric = Number(text)
  const significant = text.replace(/[-.]/g, '').replace(/^0+/, '').length
  const scale = text.split('.')[1]?.length || 0
  if (
    significant > 15 ||
    scale > 30 ||
    !Number.isFinite(numeric) ||
    (money ? reportMoneyText(numeric) : reportQuantityText(numeric)) !== text
  ) {
    setText(cell, text)
    cell.note = '超出 Excel 安全数值精度，按文本保留；不参与数值求和。'
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }
  } else {
    cell.value = numeric
    cell.numFmt = money ? '#,##0.00' : scale ? `#,##0.${'0'.repeat(scale)}` : '#,##0'
  }
}

function finishSheet(sheet: Worksheet) {
  sheet.getRow(1).height = 32
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2878BD' } }
    cell.alignment = { vertical: 'middle', wrapText: true }
  })
  sheet.eachRow((row, index) => {
    if (index > 1) row.alignment = { vertical: 'top', wrapText: true }
  })
  sheet.autoFilter = { from: 'A1', to: { row: sheet.rowCount, column: sheet.columnCount } }
}

export async function buildReconciliationExcel(
  review: ReconciliationPage,
  query: ReconciliationQuery,
): Promise<{ filename: string; buffer: ArrayBuffer }> {
  if (review.rows.length !== review.total || review.rows.some((row) => row.kind !== query.kind))
    throw new Error('导出记录未完整或粒度不一致')
  if (review.total >= 1048576) throw new Error('超过 Excel 行数上限，请缩小导出范围')
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = '瑞盖供应链'
  const scope = workbook.addWorksheet('复核口径与订单金额')
  scope.columns = [
    { header: '项目', width: 32 },
    { header: '内容', width: 88 },
  ]
  const metadata = (label: string, value: string) => {
    const row = scope.addRow([])
    setText(row.getCell(1), label)
    setText(row.getCell(2), value)
  }
  metadata('来源版本', review.sourceVersion.fileName)
  metadata(
    '来源期间（北京时间）',
    `${businessDateTime(review.from)} 至 ${businessDateTime(review.to)}`,
  )
  metadata('复核完成（北京时间）', businessDateTime(review.completedAt))
  metadata('复核范围订单数', String(review.summary.count))
  metadata(
    '当前筛选导出数量',
    `${review.total} ${query.kind === 'ORDER' ? '笔订单' : '个 SKU 比较组'}`,
  )
  metadata('城市筛选', query.city || '全部')
  metadata('销售筛选', query.sales || '全部')
  metadata('来源订单筛选', query.orderNo || '全部')
  metadata('综合结论筛选', query.status ? reconciliationStatusName(query.status) : '全部')
  metadata('搜索条件', query.keyword || '无')
  metadata(
    '单位口径',
    '保留原始数量及单位；字典名称仅用于显示，不代表数量换算。列名推断不是明确交易单位。',
  )
  metadata(
    '关联口径',
    '名称规格匹配仅用于比较分组，不代表稳定商品绑定；比较组数不是原始明细行数，不能据此认定漏单或少行。',
  )
  metadata(
    '结论口径',
    '金额、数量 / 单位、业务归属及商品关联分别按复核结论展示；历史缺项未单独评估。订单数量不跨单位汇总；数量不确定时仍保留实际金额。',
  )
  metadata(
    '金额口径',
    '下列金额是复核范围订单汇总，不是当前筛选 SKU 的金额之和；退款排除行仍保留原始金额供追溯。',
  )
  metadata(
    '精度口径',
    '金额以元显示两位小数，原始数量不换算。超出 Excel 安全精度时以黄色文本及批注保留，不参与求和。',
  )
  for (const [field, label] of [
    ['sourceAmount', '来源订单应收（元）'],
    ['businessAmount', '业务订单应收（元）'],
    ['biAmount', 'BI 订单应收（元）'],
    ['sourcePaid', '来源订单累计回款（元）'],
    ['businessPaid', '业务订单累计回款（元）'],
    ['biPaid', 'BI 订单累计回款（元）'],
  ] as const) {
    const row = scope.addRow([])
    setText(row.getCell(1), label)
    setNumber(row.getCell(2), review.summary[field], true)
  }
  for (const notice of review.notices) metadata('来源提示', notice)
  finishSheet(scope)

  const facts = [
    ['source', '来源'],
    ['business', '业务系统'],
    ['bi', 'BI 快照'],
    ['previous', '历史来源'],
  ] as const
  const fields: {
    key: keyof ReconciliationFact
    label: string
    format?: 'money' | 'quantity' | 'unitEvidence' | 'associationEvidence'
  }[] = [
    { key: 'customer', label: '客户' },
    { key: 'product', label: '商品' },
    { key: 'specification', label: '规格' },
    {
      key: 'amount',
      label: query.kind === 'ORDER' ? '订单应收（元）' : '商品组金额（元）',
      format: 'money',
    },
    ...(query.kind === 'ORDER'
      ? [
          { key: 'paid' as const, label: '累计回款（元）', format: 'money' as const },
          { key: 'unpaid' as const, label: '待回款（元）', format: 'money' as const },
        ]
      : []),
    { key: 'quantity', label: '原始数量', format: 'quantity' },
    { key: 'rawUnit', label: '原始单位' },
    { key: 'unit', label: '核对单位' },
    { key: 'unitEvidence', label: '单位依据', format: 'unitEvidence' },
    { key: 'associationEvidence', label: '关联依据', format: 'associationEvidence' },
  ]
  const sheet = workbook.addWorksheet(query.kind === 'ORDER' ? '订单复核' : 'SKU比较组复核', {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }],
  })
  sheet.columns = [
    '来源订单',
    '城市',
    '责任销售',
    '综合结论',
    ...reconciliationDimensions.map(({ label }) => label),
    '复核提醒',
    ...facts.flatMap(([, label]) => [
      ...fields.map((field) => `${label}${field.label}`),
      `${label}证据提醒`,
    ]),
  ].map((header) => ({ header, width: header.includes('提醒') ? 60 : 26 }))
  for (const source of review.rows) {
    const row = sheet.addRow([])
    const values = [
      source.orderNo || '未关联来源订单',
      source.city || '未提供',
      source.sales || '未提供',
      reconciliationStatusName(source.status),
      ...reconciliationDimensions.map(({ key }) => reconciliationStatusName(source[key])),
      reconciliationWarnings(source).join('\n'),
    ]
    let column = 1
    for (const value of values) setText(row.getCell(column++), value)
    for (const [key] of facts) {
      const fact = source[key]
      for (const field of fields) {
        const cell = row.getCell(column++)
        const value = fact?.[field.key]
        if (field.format === 'money' || field.format === 'quantity')
          setNumber(cell, value, field.format === 'money')
        else if (field.format === 'unitEvidence')
          setText(cell, fact ? unitEvidenceName(fact.unitEvidence) : '未提供')
        else if (field.format === 'associationEvidence')
          setText(cell, fact ? associationEvidenceName(fact.associationEvidence) : '未提供')
        else if (field.key === 'rawUnit') setText(cell, originalUnit(fact))
        else setText(cell, value == null ? '未提供' : String(value))
      }
      setText(row.getCell(column++), factWarnings(fact).join('\n'))
    }
  }
  finishSheet(sheet)
  const bytes = await workbook.xlsx.writeBuffer()
  return {
    filename: `飞书复核-${query.kind === 'ORDER' ? '订单' : 'SKU比较组'}-${businessDate(review.from)}-${businessDate(review.to)}.xlsx`,
    buffer: new Uint8Array(bytes).buffer,
  }
}
