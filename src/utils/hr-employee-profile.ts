import { auditActorLabel } from './audit-actor'
import { displayDateTime } from './business-date'
export function identityDetails(raw: string | null | undefined, today = new Date()) {
  const id = raw?.trim().toUpperCase() ?? ''
  if (!id) return { birthDate: '', gender: '', age: '', error: '' }
  const invalid = { birthDate: '', gender: '', age: '', error: '请输入有效的18位身份证号' }
  if (!/^[1-9]\d{16}[\dX]$/.test(id)) return invalid
  const year = Number(id.slice(6, 10)),
    month = Number(id.slice(10, 12)),
    day = Number(id.slice(12, 14))
  const birth = new Date(year, month - 1, day)
  if (
    birth.getFullYear() !== year ||
    birth.getMonth() !== month - 1 ||
    birth.getDate() !== day ||
    birth > today
  )
    return invalid
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  if ('10X98765432'[weights.reduce((sum, w, i) => sum + Number(id[i]) * w, 0) % 11] !== id[17])
    return invalid
  const age =
    today.getFullYear() -
    year -
    (today.getMonth() < month - 1 || (today.getMonth() === month - 1 && today.getDate() < day)
      ? 1
      : 0)
  return {
    birthDate: `${id.slice(6, 10)}-${id.slice(10, 12)}-${id.slice(12, 14)}`,
    gender: Number(id[16]) % 2 ? '男' : '女',
    age: `${age} 岁`,
    error: '',
  }
}
export function dateOnly(value?: string | null) {
  if (!value) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function serviceLength(entry?: string | null, leave?: string | null, today = new Date()) {
  const start = dateOnly(entry),
    end = dateOnly(leave) || dateOnly(today.toISOString())
  if (!start || end < start) return '—'
  const a = new Date(`${start}T00:00:00`),
    b = new Date(`${end}T00:00:00`)
  let months = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth()
  if (b.getDate() < a.getDate()) months--
  return months < 1 ? '不足1个月' : `${Math.floor(months / 12)}年${months % 12}个月`
}
export function auditActor(name?: string | null, id?: string | null) {
  return name || auditActorLabel(id)
}
export const auditTime = displayDateTime
export const educationOptions = [
  '小学',
  '初中',
  '高中',
  '中专',
  '大专',
  '本科',
  '硕士',
  '博士',
  '其他',
]
export const householdOptions = ['农业户口', '非农业户口', '居民户口', '其他']
export const insuranceOptions = ['五险一金', '五险', '公积金', '未参保']
