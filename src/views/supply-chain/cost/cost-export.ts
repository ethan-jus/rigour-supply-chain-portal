import { downloadBlob, csvFilename } from '@/utils/file-download'
/** CSV 文本不允许以公式开头；金额列由调用方明确传入数值。 */
export function exportCostRows(
  title: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
) {
  const cell = (value: string | number | null | undefined) => {
    let text = value == null ? '' : String(value)
    if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = "'" + text
    return `"${text.replaceAll('"', '""')}"`
  }
  const text = [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n')
  downloadBlob(new Blob(['\uFEFF', text], { type: 'text/csv;charset=utf-8' }), csvFilename(title))
}
