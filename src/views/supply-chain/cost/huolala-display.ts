import { displayRecordDateTime } from '@/utils/business-display'

/** 企业接口无时区文本为北京时间；自有同步与归档时间仍按各自时区转换。 */
export function platformDateTime(value?: string | null): string {
  if (!value?.trim()) return '-'
  return displayRecordDateTime(
    /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(value)
      ? `${value.replace(' ', 'T')}+08:00`
      : value,
  )
}

/** progress_str 保留平台顺序和节点名称，不能由本系统成本状态生成物流轨迹。 */
export function platformProgress(value?: string | null): { name: string; time: string }[] {
  if (!value?.trim()) return []
  return value
    .split(/[,，]/)
    .filter((s) => s.trim())
    .map((step) => {
      const separator = step.lastIndexOf('|')
      return separator < 0
        ? { name: step.trim(), time: '' }
        : {
            name: step.slice(0, separator).trim(),
            time: step.slice(separator + 1).trim(),
          }
    })
}
