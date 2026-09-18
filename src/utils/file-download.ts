import { businessDate } from '@/utils/business-date'

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function csvFilename(prefix: string): string {
  return `${prefix}-${businessDate(new Date()).replaceAll('-', '')}.csv`
}
