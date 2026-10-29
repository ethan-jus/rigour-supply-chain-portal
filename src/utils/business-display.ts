import { businessDictionaryLabel } from './business-dictionary'
import { displayDateTime } from './business-date'
import { auditActorLabel } from './audit-actor'

/** 列表与只读详情的空值统一使用短横线；零值和 false 都是有效数据。 */
export function displayValue(value: unknown): string {
  return value == null || value === '—' || (typeof value === 'string' && !value.trim())
    ? '-'
    : String(value)
}

export function displayCell(_row: unknown, _column: unknown, value: unknown): string {
  return displayValue(value)
}

export function displayAmount(value: number | null | undefined): string {
  return value == null
    ? '-'
    : Number(value).toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
}
export function displayBusinessLabel(code: string, value: string | null | undefined): string {
  return value == null || !value.trim() ? '-' : businessDictionaryLabel('', code, value)
}

export function displayRecordDateTime(value: string | Date | null | undefined): string {
  return displayValue(displayDateTime(value))
}

export function displayRecordActor(value: string | null | undefined): string {
  if (!value?.trim()) return '-'
  const label = auditActorLabel(value)
  return label === '未记录' || label === '姓名未记录' ? '-' : label
}
