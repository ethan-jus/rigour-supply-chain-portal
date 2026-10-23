import type { Anchor, Workbook } from 'exceljs'
import type { PayrollRecord } from '@/api/core/payroll'
import { payrollPaymentAttachmentContent, payrollPaymentAttachmentLink } from '@/api/core/payroll-payment-attachments'
import { businessDateTime } from '@/utils/business-date'

function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(new Error('凭证文件读取失败'))
    reader.readAsArrayBuffer(blob)
  })
}
function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('凭证图片读取失败'))
    reader.readAsDataURL(blob)
  })
}
function imageSize(bytes: Uint8Array, type: string) {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (type === 'image/png' && bytes.length >= 24 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) {
    return { width: data.getUint32(16), height: data.getUint32(20) }
  }
  if (type === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2
    while (offset + 4 <= bytes.length && bytes[offset] === 255) {
      const marker = bytes[offset + 1]!
      const length = data.getUint16(offset + 2)
      if (length < 2 || offset + 2 + length > bytes.length) break
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && length >= 7)
        return { width: data.getUint16(offset + 7), height: data.getUint16(offset + 5) }
      offset += length + 2
    }
  }
  throw new Error('凭证图片内容无效，请重新核对上传文件')
}

/** 图片嵌入报表，PDF 使用私有 COS 七天签名链接；签发时仍校验当前工资权限。 */
export async function appendPayrollPaymentEvidence(workbook: Workbook, records: PayrollRecord[]) {
  const entries = records.flatMap(record => (record.payments || []).map(payment => ({ record, payment })))
  if (!entries.length) return
  const images = entries.flatMap(({ payment }) => (payment.attachments || []).filter(file => file.contentType.startsWith('image/')))
  if (images.some(file => file.size > 10 * 1024 * 1024) || images.reduce((sum, file) => sum + file.size, 0) > 100 * 1024 * 1024)
    throw new Error('凭证图片较多，请缩小员工或部门筛选范围后导出')
  const page = workbook.addWorksheet('发放凭证')
  const overviewRows = new Map(records.map((record, index) => [record.id, index + 2]))
  const linked = new Set<string>()
  page.columns = [
    { header: '工资月份', width: 14 }, { header: '员工编号', width: 24 }, { header: '员工姓名', width: 16 },
    { header: '发放日期', width: 16 }, { header: '登记金额（元）', width: 20 },
    { header: '凭证文件', width: 34 }, { header: '图片预览', width: 64 },
    { header: '链接有效期至（北京时间）', width: 28 },
  ]
  page.views = [{ state: 'frozen', ySplit: 1 }]
  page.getRow(1).height = 30
  page.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  page.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF245A86' } }
  for (const { record, payment } of entries) {
    const files = payment.attachments?.length ? payment.attachments : [null]
    const firstRow = page.rowCount + 1
    for (const [fileIndex, file] of files.entries()) {
      const row = page.addRow([record.month, record.employeeCode, record.employeeName,
        payment.paidDate, fileIndex === 0 ? payment.amount : null, file?.fileName || '-',
        file?.contentType.startsWith('image/') ? '' : '-', '-'])
      row.alignment = { vertical: 'middle', wrapText: true }
      row.getCell(5).numFmt = '#,##0.00;[Red]-#,##0.00'
      row.height = 32
      if (file && !linked.has(record.id)) {
        const overview = workbook.getWorksheet('薪酬概览')?.getCell(overviewRows.get(record.id)!, 18)
        if (overview) {
          // ExcelJS 会把普通 hyperlink 同时写为 External relationship 和含 # 的 location，
          // WPS 因此当作外部文件打开。工作簿内跳转使用标准 HYPERLINK 公式。
          overview.value = { formula: `HYPERLINK("#'发放凭证'!F${row.number}","见发放凭证页")`,
            result: '见发放凭证页' }
          overview.font = { color: { argb: 'FF245A86' }, underline: true }
        }
        linked.add(record.id)
      }
      if (file?.contentType === 'application/pdf') {
        try {
          const link = await payrollPaymentAttachmentLink(record.id, payment.id, file.id)
          if (new URL(link.url).protocol !== 'https:' || !Number.isFinite(Date.parse(link.expiresAt))
            || Date.parse(link.expiresAt) <= Date.now()) throw new Error('凭证链接无效')
          row.getCell(6).value = { text: file.fileName, hyperlink: link.url, tooltip: '打开 PDF 凭证' }
          row.getCell(6).font = { color: { argb: 'FF245A86' }, underline: true }
          row.getCell(8).value = businessDateTime(link.expiresAt)
        } catch {
          throw new Error(`${record.employeeName}的凭证“${file.fileName}”链接生成失败，导出未完成，请重试`)
        }
        continue
      }
      if (!file?.contentType.startsWith('image/')) continue
      try {
        const blob = await payrollPaymentAttachmentContent(record.id, payment.id, file.id)
        const bytes = await bytesOf(blob)
        const size = imageSize(bytes, file.contentType)
        if (!size.width || !size.height || bytes.length > 10 * 1024 * 1024) throw new Error('图片尺寸或大小无效')
        const scale = Math.min(440 / size.width, 280 / size.height, 1)
        const width = Math.max(1, size.width * scale), height = Math.max(1, size.height * scale)
        const id = workbook.addImage({ base64: await dataUrl(new Blob([bytes], { type: file.contentType })),
          extension: file.contentType === 'image/png' ? 'png' : 'jpeg' })
        row.height = Math.max(32, Math.ceil((height + 12) * 0.75))
        // ExcelJS 4 的单锚点序列化含不适用的 editAs 属性；双锚点保持标准 DrawingML，
        // 用 EMU 偏移固定等比图片大小，避免不同 Excel 读取器忽略图片。
        const anchor = (x: number, y: number) => ({ col: 6, row: row.number - 1,
          nativeCol: 6, nativeRow: row.number - 1,
          nativeColOff: Math.round(x * 9525), nativeRowOff: Math.round(y * 9525),
        }) as Anchor
        page.addImage(id, { tl: anchor(6, 6), br: anchor(width + 6, height + 6), editAs: 'oneCell' })
      } catch {
        throw new Error(`${record.employeeName}的凭证“${file.fileName}”读取失败，导出未完成，请重试`)
      }
    }
    // 一笔发放可附多份凭证，基本信息和金额仅展示一次；每个文件仍各占一行。
    // 分组区域含合并单元格，不启用会拆散附件组的逐行自动筛选。
    if (files.length > 1) {
      for (let column = 1; column <= 5; column++)
        page.mergeCells(firstRow, column, page.rowCount, column)
    }
  }
}
