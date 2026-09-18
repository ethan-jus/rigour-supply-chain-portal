import { businessInstant } from '@/utils/business-date'

/** 空字符串、空白、null 统一为 undefined，避免把空条件发给后端。 */
export function empty(value: string | null | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized || undefined
}

function isoInstant(value: string | Date): string {
  return businessInstant(value).toISOString()
}

/**
 * 下单时间范围：Asia/Shanghai 左闭右开，结束日包含全天。
 * 即 [from 00:00, 次日 00:00)，不把 23:59:59 截断当作完整一天。
 */
export function orderRegisterDateParams(
  range: [string, string] | null | undefined,
): { orderDateFrom?: string; orderDateTo?: string } {
  return dateRangeParams(range, 'orderDateFrom', 'orderDateTo') as {
    orderDateFrom?: string
    orderDateTo?: string
  }
}

/**
 * 业务日期范围 → 左闭右开 Instant 参数；结束日包含全天（to 取次日 00:00）。
 */
export function dateRangeParams(
  range: [string, string] | null | undefined,
  fromKey: string,
  toKey: string,
): Record<string, string> {
  if (!range || !range[0] || !range[1]) return {}
  const from = businessInstant(range[0])
  const to = businessInstant(range[1])
  if (to.getTime() < from.getTime()) throw new RangeError('下单时间结束日不能早于开始日')
  const exclusiveEnd = new Date(to)
  exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1)
  return {
    [fromKey]: isoInstant(from),
    [toKey]: isoInstant(exclusiveEnd),
  }
}

export function orderRegisterCommonParams(params: Record<string, unknown>) {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    result[key] = value
  }
  return result
}

export function hasUnpaidValue(value: string): boolean | undefined {
  if (value === 'true') return true
  if (value === 'false') return false
  return undefined
}
