import type { Cell, Workbook, Worksheet } from 'exceljs'
import type {
  CityProductReportQuery,
  CityProductReportSummary,
  CityProductReportView,
} from '@/api/core/bi-city-product-report'
import {
  allocationModeLabels,
  cityProductColumns,
  cityProductExportBlockedReason,
  cityProductMetricDefinitions,
  cityProductQuantityNotice,
  cityProductTotals,
  reportCellText,
  reportDecimalText,
  reportOptionLabel,
  type ReportLabels,
  type CityProductColumn,
  type CityProductExportKind,
} from './city-product-export'
import {
  reportMoneyText,
  reportQuantityText,
  reportUnitName,
  reportSourceName,
} from './report-format'
import { businessTable, businessDate, type BusinessReportKind } from './business-report'
import { businessDateTime } from '@/utils/business-date'
import { supplyEvidenceBlockedReason, type SupplyEvidence } from './city-product-investigation'

const sheetNames: Record<CityProductExportKind, string> = {
  categoryRows: '城市分类',
  rows: '商品SKU',
  orderTrace: '订单核对',
}
const precisionNotice =
  '超出 Excel 15 位有效数字或安全数值范围，按文本保留，不参与 Excel 数值求和。金额仍按两位小数展示。'

export type CityProductSelectedColumns = Partial<Record<CityProductExportKind, readonly string[]>>

export function resolveCityProductColumns(selected: CityProductSelectedColumns = {}) {
  const result = {} as Record<CityProductExportKind, readonly CityProductColumn[]>
  for (const kind of Object.keys(sheetNames) as CityProductExportKind[]) {
    const allowed = cityProductColumns[kind]
    const keys = selected[kind]
    if (keys?.some((key) => !allowed.some((column) => column.key === key)))
      throw new Error(`${sheetNames[kind]}包含无效导出字段`)
    result[kind] = keys ? allowed.filter((column) => keys.includes(column.key)) : allowed
    if (!result[kind].length) throw new Error(`${sheetNames[kind]}至少选择一个导出字段`)
  }
  return result
}

function setText(cell: Cell, value: string) {
  if (value.length > 32767)
    throw new Error('报表文本超过 Excel 单元格长度上限，请缩小范围；未截断导出')
  // Explicit string cells never create formulas, hyperlinks or external references.
  cell.value = value === '' ? null : value
  cell.numFmt = '@'
}

function normalizedDecimal(value: string) {
  const [integer, fraction = ''] = value.replace(/^[+-]/, '').split('.')
  const whole = integer.replace(/^0+/, '') || '0'
  const tail = fraction.replace(/0+$/, '')
  return `${value.startsWith('-') && (whole !== '0' || tail) ? '-' : ''}${whole}${tail ? `.${tail}` : ''}`
}

function setDecimal(cell: Cell, text: string, money: boolean, warnings: string[]) {
  if (text === '') {
    cell.value = null
    return
  }
  text = money ? reportMoneyText(text) : reportQuantityText(text)
  const normalized = normalizedDecimal(text)
  const significant = normalized.replace(/[-.]/g, '').replace(/^0+/, '').length
  const scale = text.split('.')[1]?.length ?? 0
  const numeric = Number(text)
  if (
    significant > 15 ||
    scale > 30 ||
    !Number.isFinite(numeric) ||
    (numeric !== 0 && Math.abs(numeric) < 2.2250738585072014e-308) ||
    normalizedDecimal(reportDecimalText(numeric)) !== normalized
  ) {
    setText(cell, text)
    cell.note = precisionNotice
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }
    warnings.push(`${cell.worksheet.name}!${cell.address}`)
    return
  }
  cell.value = numeric
  const places = Math.max(money ? 2 : 0, scale)
  cell.numFmt = places ? `#,##0.${'0'.repeat(places)}` : '#,##0'
}

function createSheet(
  workbook: Workbook,
  name: string,
  columns: readonly CityProductColumn[],
  quantityNotice = '',
) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: quantityNotice ? 2 : 1 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })
  sheet.columns = columns.map((column) => ({
    header: column.label,
    key: column.key,
    width: column.key === 'quantities' ? 48 : column.decimal ? 24 : 26,
  }))
  if (quantityNotice) {
    sheet.insertRow(1, [])
    if (columns.length > 1) sheet.mergeCells(1, 1, 1, columns.length)
    const cell = sheet.getCell(1, 1)
    setText(cell, quantityNotice)
    cell.font = { color: { argb: 'FF735118' }, size: 11 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }
    cell.alignment = { vertical: 'middle', wrapText: true }
    const width = sheet.columns.reduce((sum, column) => sum + (column.width || 26), 0)
    sheet.getRow(1).height = Math.max(48, Math.ceil((quantityNotice.length * 2) / width) * 18)
  }
  const headerRow = quantityNotice ? 2 : 1
  sheet.getRow(headerRow).height = 36
  sheet.getRow(headerRow).eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2878BD' } }
    cell.alignment = { vertical: 'middle', wrapText: true }
  })
  columns.forEach((column, index) => {
    if (column.key === 'quantity' || column.key === 'quantities')
      addQuantityNotice(sheet.getCell(headerRow, index + 1), quantityNotice)
  })
  sheet.pageSetup.printTitlesRow = `1:${headerRow}`
  return sheet
}

function addQuantityNotice(cell: Cell, notice: string) {
  if (notice)
    cell.note = [typeof cell.note === 'string' ? cell.note : '', notice].filter(Boolean).join('\n')
}

function finishSheet(sheet: Worksheet, headerRow = 1) {
  if (sheet.rowCount > 1048576)
    throw new Error('报表超过 Excel 行数上限，请缩小日期或筛选范围；未截断导出')
  sheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: sheet.rowCount, column: sheet.columnCount },
  }
}

const summaryColumns: {
  key: Exclude<keyof CityProductReportSummary, 'quantities' | 'sample'>
  label: string
}[] = [
  { key: 'orderCount', label: '范围订单数（单独去重）' },
  { key: 'customerCount', label: '范围客户数（单独去重）' },
  { key: 'unallocatedOrderCount', label: '商品口径待核对订单数' },
  { key: 'categoryPaidAmount', label: '分类口径已归属回款额（元）' },
  { key: 'unallocatedCategoryOrderCount', label: '分类口径待核对订单数' },
  { key: 'salesAmount', label: '商品口径商品销售额（元）' },
  { key: 'salesNetAmount', label: '商品口径扣退款行金额（元）' },
  { key: 'refundAmount', label: '商品口径退款额（元）' },
  { key: 'orderPayableAmount', label: '所选订单整单应收（元）' },
  { key: 'orderPaidAmount', label: '所选订单整单累计已收（元）' },
  { key: 'orderUnpaidAmount', label: '所选订单整单待回款（元）' },
  { key: 'receivableAmount', label: '商品口径已归属应收额（元）' },
  { key: 'paidAmount', label: '商品口径已归属回款额（元）' },
  { key: 'allocatedPaidAmount', label: '商品口径其中分摊回款（元）' },
  { key: 'excludedPaidAmount', label: '商品口径范围外已归属回款（元）' },
  { key: 'unallocatedPaidAmount', label: '商品口径未归属回款（元）' },
]

export async function buildCityProductExcel(
  report: CityProductReportView,
  context: {
    query: CityProductReportQuery
    categoryName: string
    selectedColumns?: CityProductSelectedColumns
    labels?: ReportLabels
    businessKind?: BusinessReportKind
    businessColumns?: readonly string[]
    supply?: SupplyEvidence
  },
): Promise<{ filename: string; buffer: ArrayBuffer; precisionWarningCount: number }> {
  const blocked = cityProductExportBlockedReason(report)
  if (blocked) throw new Error(blocked)
  if (report.allocationMode !== (context.query.allocationMode ?? 'EXACT_ONLY'))
    throw new Error('返回的回款口径与查询不一致，请重新查询')
  const selectedColumns = resolveCityProductColumns(context.selectedColumns)
  if (context.supply) {
    const query = { ...context.query }
    if (!query.productId && query.skuId) {
      const ids = [
        ...new Set(
          report.rows
            .filter((row) => row.skuId === String(query.skuId))
            .map((row) => row.productId)
            .filter(Boolean),
        ),
      ]
      if (ids.length === 1) query.productId = ids[0]!
    }
    const reason = supplyEvidenceBlockedReason(context.supply, query)
    if (reason) throw new Error(reason)
  }
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = '瑞盖供应链'
  const warnings: string[] = []
  const quantityNotice = cityProductQuantityNotice(report)
  if (context.businessKind) {
    const table = businessTable(
      report,
      context.businessKind,
      context.labels,
      Boolean(
        context.query.productCategoryId ||
        context.query.brandId ||
        context.query.productId ||
        context.query.skuId,
      ),
    )
    const columns = context.businessColumns
      ? table.columns.filter((column) => context.businessColumns!.includes(column.key))
      : table.columns
    if (!columns.length) throw new Error('业务汇总至少选择一个导出字段')
    if (context.businessColumns?.some((key) => !table.columns.some((column) => column.key === key)))
      throw new Error('业务汇总导出字段已变化，请重新选择')
    const sheet = workbook.addWorksheet(table.title, {
      views: [
        {
          state: 'frozen',
          ySplit: 5,
          xSplit: Math.min(context.businessKind === 'monthly' ? 6 : 1, columns.length - 1),
        },
      ],
      pageSetup: {
        orientation: 'landscape',
        paperSize: 9,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        printTitlesRow: '1:5',
      },
    })
    sheet.columns = columns.map((column) => ({
      width: ['product', 'specification', 'quantities'].includes(column.key)
        ? 32
        : column.type
          ? 19
          : 24,
    }))
    const heading = (row: number, value: string) => {
      if (columns.length > 1) sheet.mergeCells(row, 1, row, columns.length)
      setText(sheet.getCell(row, 1), value)
      sheet.getRow(row).height = row === 1 ? 32 : 30
      sheet.getCell(row, 1).alignment = { vertical: 'middle', wrapText: true }
    }
    heading(
      1,
      `${context.categoryName === '全部分类' ? '' : `${context.categoryName} · `}${table.title}`,
    )
    sheet.getCell(1, 1).font = { size: 18, bold: true, color: { argb: 'FF164A72' } }
    heading(
      2,
      `${businessDate(report.from)} 至 ${businessDate(report.to)}（北京时间） | ${allocationModeLabels[report.allocationMode]} | 金额：元`,
    )
    heading(
      3,
      [
        context.query.regionCode
          ? reportOptionLabel(context.labels?.region, context.query.regionCode)
          : '全部城市',
        context.query.ownerStaffCode
          ? reportOptionLabel(context.labels?.owner, context.query.ownerStaffCode)
          : '全部销售',
        context.query.sourceSystemCode
          ? reportSourceName(
              context.query.sourceSystemCode,
              reportOptionLabel(context.labels?.source, context.query.sourceSystemCode, ''),
            )
          : '全部来源',
        context.query.customerTypeCode
          ? reportOptionLabel(context.labels?.customerType, context.query.customerTypeCode)
          : '全部客户类型',
        context.query.brandId
          ? reportOptionLabel(context.labels?.brand, context.query.brandId)
          : '全部品牌',
        context.query.productId
          ? reportOptionLabel(context.labels?.product, context.query.productId)
          : '全部商品',
        context.query.skuId
          ? reportOptionLabel(context.labels?.sku, context.query.skuId)
          : '全部规格',
      ].join(' · ') + (quantityNotice ? `\n${quantityNotice}` : ''),
    )
    sheet.getRow(3).height = quantityNotice
      ? Math.max(
          76,
          Math.ceil(
            (quantityNotice.length * 2) /
              columns.reduce((sum, _, index) => sum + (sheet.getColumn(index + 1).width || 26), 0),
          ) *
            18 +
            44,
        )
      : 44
    for (let index = 0; index < columns.length;) {
      const column = columns[index]!
      if (column.group) {
        let end = index
        while (end + 1 < columns.length && columns[end + 1]!.group === column.group) end++
        if (end > index) sheet.mergeCells(4, index + 1, 4, end + 1)
        setText(sheet.getCell(4, index + 1), column.group)
        for (let child = index; child <= end; child++)
          setText(sheet.getCell(5, child + 1), columns[child]!.label)
        index = end + 1
      } else {
        sheet.mergeCells(4, index + 1, 5, index + 1)
        setText(sheet.getCell(4, index + 1), column.label)
        index++
      }
    }
    for (const header of [4, 5]) {
      sheet.getRow(header).height = 32
      for (let index = 1; index <= columns.length; index++) {
        const cell = sheet.getCell(header, index)
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2878BD' } }
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      }
    }
    columns.forEach((column, index) => {
      if (column.type === 'quantity' || column.key === 'quantities')
        addQuantityNotice(sheet.getCell(5, index + 1), quantityNotice)
    })
    for (const source of table.rows) {
      const row = sheet.addRow([])
      row.height = 32
      columns.forEach((column, index) => {
        const cell = row.getCell(index + 1)
        const value = source.values[column.key]
        if (column.type === 'percent' && typeof value === 'number') {
          cell.value = value
          cell.numFmt = '0.00%'
        } else if (column.type && value != null && /^-?\d+(\.\d+)?$/.test(String(value)))
          setDecimal(cell, String(value), column.type === 'money', warnings)
        else setText(cell, value == null ? '未提供' : String(value))
        if (column.type === 'quantity' || column.key === 'quantities')
          addQuantityNotice(cell, quantityNotice)
        cell.alignment = {
          vertical: 'middle',
          wrapText: true,
          horizontal: column.type ? 'right' : 'left',
        }
        if (source.kind !== 'detail') {
          cell.font = { bold: true, color: { argb: 'FF163C57' } }
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: source.kind === 'total' ? 'FFD9EAF5' : 'FFEEF4F8' },
          }
          cell.border = { top: { style: 'thin', color: { argb: 'FFBACBD8' } } }
        }
      })
    }
    sheet.addRow([])
    for (const note of table.notes) {
      const row = sheet.addRow([])
      if (columns.length > 1) sheet.mergeCells(row.number, 1, row.number, columns.length)
      setText(row.getCell(1), note)
      row.height = 32
      row.getCell(1).alignment = { wrapText: true, vertical: 'middle' }
      row.getCell(1).font = { size: 10, color: { argb: 'FF596976' } }
    }
    sheet.headerFooter.oddFooter = '&L瑞盖供应链&R第 &P 页 / 共 &N 页'
  }
  for (const kind of Object.keys(sheetNames) as CityProductExportKind[]) {
    if (report[kind].length + (quantityNotice ? 2 : 1) > 1048576)
      throw new Error('报表超过 Excel 行数上限，请缩小日期或筛选范围；未截断导出')
    const columns = selectedColumns[kind]
    const sheet = createSheet(workbook, sheetNames[kind], columns, quantityNotice)
    for (const source of report[kind]) {
      const row = sheet.addRow([])
      for (const [index, column] of columns.entries()) {
        const cell = row.getCell(index + 1)
        const text = reportCellText(source, column, context.labels)
        if (column.decimal) setDecimal(cell, text, column.label.includes('（元）'), warnings)
        else setText(cell, text)
        if (column.key === 'quantity' || column.key === 'quantities')
          addQuantityNotice(cell, quantityNotice)
        cell.alignment = { vertical: 'top', wrapText: true }
      }
    }
    finishSheet(sheet, quantityNotice ? 2 : 1)
  }

  const stats = createSheet(workbook, '统计口径', [
    { key: 'label', label: '项目' },
    { key: 'value', label: '值' },
    { key: 'field', label: '说明' },
  ])
  stats.getColumn(1).width = 38
  stats.getColumn(2).width = 90
  stats.getColumn(3).width = 46
  function metadata(label: string, value: unknown, field = '', decimal = false) {
    const row = stats.addRow([])
    setText(row.getCell(1), label)
    if (decimal)
      setDecimal(row.getCell(2), reportDecimalText(value), label.includes('（元）'), warnings)
    else setText(row.getCell(2), value == null ? '' : String(value))
    setText(row.getCell(3), field)
    row.alignment = { vertical: 'top', wrapText: true }
    row.height = Math.max(30, Math.ceil(String(value ?? '').length / 42) * 16)
  }
  const query = context.query
  metadata('报表', '城市商品报表；三张明细表均为完整接口返回，不随当前页或标签筛选')
  metadata('开始时间（北京时间）', businessDateTime(report.from))
  metadata('结束时间（北京时间）', businessDateTime(report.to))
  metadata('生成时间（北京时间）', report.generatedAt ? businessDateTime(report.generatedAt) : '')
  metadata(
    '数据最近同步时间（北京时间）',
    report.dataUpdatedAt ? businessDateTime(report.dataUpdatedAt) : '',
    '不代表所有来源均完整',
  )
  for (const [key, name, options] of [
    ['regionCode', '城市筛选', context.labels?.region],
    ['ownerStaffCode', '销售员工筛选', context.labels?.owner],
    ['customerTypeCode', '客户类型筛选', context.labels?.customerType],
    ['sourceSystemCode', '来源系统筛选', context.labels?.source],
    ['brandId', '品牌筛选', context.labels?.brand],
    ['productId', '商品筛选', context.labels?.product],
    ['skuId', 'SKU规格筛选', context.labels?.sku],
  ] as const)
    metadata(
      name,
      !query[key]
        ? '全部'
        : key === 'sourceSystemCode'
          ? reportSourceName(query[key], reportOptionLabel(options, query[key], ''))
          : reportOptionLabel(options, query[key]),
    )
  metadata('分类筛选名称', context.categoryName)
  metadata('回款分摊口径', allocationModeLabels[report.allocationMode])
  metadata('完整导出检查', '未截断；已通过完整导出检查')
  for (const kind of Object.keys(sheetNames) as CityProductExportKind[]) {
    metadata(`${sheetNames[kind]}明细行数`, report[kind].length, '', true)
    metadata(
      `${sheetNames[kind]}实际导出字段`,
      selectedColumns[kind].map((column) => column.label).join('；'),
    )
  }
  metadata(
    '分类回款完整性',
    cityProductTotals(report, 'categoryRows').incomplete ? '归属未完整' : '按接口归属结果',
  )
  metadata(
    '商品回款完整性',
    cityProductTotals(report, 'rows').incomplete ? '归属未完整' : '按接口归属结果',
  )
  metadata(
    '回款定义',
    '已归属回款额包含其中分摊回款，二者不可相加；是所选订单累计已归属回款额，不是期间现金回款或总回款。',
  )
  metadata(
    '未归属说明',
    '存在归属未完整订单或回款金额为空时，归属未完整；空金额不是零。分类和商品各按自身口径判断，不互相替代。',
  )
  metadata(
    '观察粒度',
    '城市分类按城市+分类汇总金额；商品SKU按商品和原始单位统计。两张表不能相加，不同单位数量不能相加。',
  )
  metadata(
    '去重与汇总',
    '行内订单数、客户数各自去重，不可跨行相加。商品与分类回款按各自归属口径独立汇总。',
  )
  metadata(
    '订单核对',
    '整单应收、商品行金额、订单调整差额与已收分别保留；选中行金额不能替换整单分摊分母。不根据导出数据另行分摊或抵扣。',
  )
  metadata(
    '精度与文本安全',
    '金额按元四舍五入保留两位，普通金额为可计算数值。超过 Excel 15 位有效数字或安全范围的值为黄色文本并加批注，不参与数值求和。汇总先按原始精度计算再舍入，可能与逐行金额之和存在分位尾差。',
  )
  for (const definition of cityProductMetricDefinitions) metadata('指标说明', definition)
  for (const column of summaryColumns) metadata(column.label, report.summary![column.key], '', true)
  for (const quantity of report.summary!.quantities)
    metadata(
      '商品口径订货数量（未扣退货）',
      quantity.quantity,
      `单位：${reportUnitName(quantity.unitCode)}`,
      true,
    )
  if (context.supply?.snapshot) {
    const evidence = context.supply
    const snapshot = evidence.snapshot!
    metadata('供货仓库', evidence.warehouseName)
    metadata(
      '库存口径',
      '所选仓库的当前快照，不是订单期间期末库存；采购与发货为全仓事实，不按销售城市归属。',
    )
    metadata(
      '供货核查时间（北京时间）',
      snapshot.generatedAt ? businessDateTime(snapshot.generatedAt) : '',
    )
    const statusLabels = {
      FRESH: '最近24小时已同步',
      STALE: '快照已过期，订货前需重新核查',
      FAILED: '最近同步失败，旧快照仅供核对',
      RUNNING: '正在同步，快照可能未完整',
      UNAVAILABLE: '尚无成功同步记录',
    }
    metadata('库存同步状态', statusLabels[snapshot.inventoryStatus.status])
    metadata('库存最近成功同步', snapshot.inventoryStatus.lastSuccessAt)
    metadata('采购发货同步状态', statusLabels[snapshot.operationStatus.status])
    metadata('采购发货最近成功同步', snapshot.operationStatus.lastSuccessAt)
    metadata('库存缺失记录', '没有库存记录不表示零库存；单位未统一时不计算可售天数或补货建议。')
    const stockSheet = createSheet(workbook, '供货仓库库存', [
      { key: 'warehouse', label: '供货仓库' },
      { key: 'product', label: '商品' },
      { key: 'specification', label: '规格' },
      { key: 'unit', label: '原始单位' },
      { key: 'available', label: '可用数量', decimal: true },
      { key: 'locked', label: '锁定数量', decimal: true },
      { key: 'transit', label: '在途数量', decimal: true },
      { key: 'synced', label: '快照时间' },
    ])
    for (const source of snapshot.stocks) {
      const row = stockSheet.addRow([])
      const texts = [
        source.warehouseName || evidence.warehouseName,
        source.productName || '商品名称待核对',
        source.specification || '未填写规格',
        reportUnitName(source.unitCode),
      ]
      texts.forEach((value, index) => setText(row.getCell(index + 1), value))
      ;[source.availableQuantity, source.lockedQuantity, source.inTransitQuantity].forEach(
        (value, index) =>
          setDecimal(row.getCell(index + 5), reportDecimalText(value), false, warnings),
      )
      setText(row.getCell(8), source.syncedAt ? businessDateTime(source.syncedAt) : '未提供')
    }
    finishSheet(stockSheet)
    const operationSheet = createSheet(workbook, '全仓采购发货', [
      { key: 'month', label: '月份' },
      { key: 'product', label: '商品' },
      { key: 'specification', label: '规格' },
      { key: 'unit', label: '原始单位' },
      { key: 'procurement', label: '采购订购量', decimal: true },
      { key: 'shipped', label: '已发货量', decimal: true },
      { key: 'synced', label: '快照时间' },
    ])
    for (const source of snapshot.operations) {
      const row = operationSheet.addRow([])
      const label =
        report.rows.find(
          (item) => item.productId === source.productId && item.skuId === source.skuId,
        ) ||
        snapshot.stocks.find(
          (item) => item.productId === source.productId && item.skuId === source.skuId,
        )
      ;[
        source.month,
        label?.productName || '商品名称待核对',
        label?.specification || '未填写规格',
        reportUnitName(source.unitCode),
      ].forEach((value, index) => setText(row.getCell(index + 1), value))
      ;[source.procurementQuantity, source.shippedQuantity].forEach((value, index) =>
        setDecimal(row.getCell(index + 5), reportDecimalText(value), false, warnings),
      )
      setText(row.getCell(7), source.syncedAt ? businessDateTime(source.syncedAt) : '未提供')
    }
    finishSheet(operationSheet)
  }
  const precisionWarningCount = warnings.length
  metadata(
    '超出安全精度单元格数',
    precisionWarningCount,
    '请逐项核对；文本金额不参与 Excel 数值求和',
    true,
  )
  for (const address of warnings) metadata('精度警示', precisionNotice, address)
  finishSheet(stats)
  const bytes = await workbook.xlsx.writeBuffer()
  const filename =
    `${context.businessKind ? (context.businessKind === 'monthly' ? '城市单品月报' : '城市经营汇总') : '城市商品报表'}-${context.categoryName}-${businessDate(report.from)}-${businessDate(report.to)}.xlsx`.replace(
      /[\\/:*?"<>|\u0000-\u001f]/g,
      '_',
    )
  return { filename, buffer: new Uint8Array(bytes).buffer, precisionWarningCount }
}
