import type { CostSource } from '@/api/core/cost'
import type { TransportDetail } from '@/api/core/transport-records'
import type { LogisticsLedger } from '@/types/cost-ledger'

export type Shares = Record<string, number | null>
type Source = Pick<CostSource, 'documentNo' | 'sourceType' | 'documentAmount'>
const cents = (value: number) => BigInt(Math.round(value * 100))
export const canWeightSales = (codes: string[], sources: Source[]) =>
  codes.length > 1 &&
  codes.every((code) =>
    sources.some(
      (s) =>
        s.documentNo === code &&
        s.sourceType === 'SALES_ORDER' &&
        s.documentAmount != null &&
        Number.isFinite(Number(s.documentAmount)) &&
        Number(s.documentAmount) >= 0.000001,
    ),
  )

/** 与服务端一致：按分做最大余数分摊，并列按单号排序，不使用浮点金额累加。 */
export function transportAllocations(
  total: number | null,
  codes: string[],
  sources: Source[],
  manual?: Shares | null,
) {
  const sorted = [...new Set(codes)].sort()
  if (manual && Object.keys(manual).length)
    return sorted.map((code) => ({ code, amount: manual[code] ?? null }))
  if (total == null || !Number.isFinite(total) || total < 0)
    return sorted.map((code) => ({ code, amount: null }))
  const weighted = canWeightSales(sorted, sources)
  const weights = sorted.map((code) =>
    weighted
      ? BigInt(
          Number(sources.find((s) => s.documentNo === code)!.documentAmount)
            .toFixed(6)
            .replace('.', ''),
        )
      : 1n,
  )
  const sum = weights.reduce((a, b) => a + b, 0n)
  if (!sum) return []
  const numerators = weights.map((w) => cents(total) * w)
  const values = numerators.map((n) => n / sum)
  const order = sorted
    .map((_, i) => i)
    .sort((a, b) => {
      const diff = (numerators[b]! % sum) - (numerators[a]! % sum)
      return diff > 0n ? 1 : diff < 0n ? -1 : a - b
    })
  const remaining = Number(cents(total) - values.reduce((a, b) => a + b, 0n))
  for (let i = 0; i < remaining; i++) values[order[i]!]! += 1n
  return sorted.map((code, i) => ({ code, amount: Number(values[i]) / 100 }))
}

export function allocationError(
  total: number | null,
  codes: string[],
  manual?: Shares | null,
): string {
  if (!manual || !Object.keys(manual).length) return ''
  if (total == null || !Number.isFinite(total)) return '请先填写运输费用，再核对分摊金额'
  if (Object.keys(manual).length !== codes.length || codes.some((code) => !(code in manual)))
    return '请为全部关联订单填写分摊金额'
  const values = codes.map((code) => manual[code])
  if (
    values.some(
      (value) =>
        value == null ||
        !Number.isFinite(value) ||
        value < 0 ||
        Math.abs(value * 100 - Math.round(value * 100)) > 0.000001,
    )
  )
    return '分摊金额须为非负金额，最多两位小数'
  return values.reduce<number>((sum, value) => sum + Math.round(value! * 100), 0) ===
    Math.round(total * 100)
    ? ''
    : '订单分摊合计必须等于运输费用'
}

export function complexTransportLedger(ledger: LogisticsLedger | null | undefined) {
  return (
    !!ledger &&
    (ledger.feeItems.length !== 1 ||
      ledger.feeItems.some(
        (f) =>
          f.bearerCode !== 'COMPANY' ||
          !(
            f.allocationMethodCode === 'EQUAL' ||
            (f.feeKey === 'freight' && ['AMOUNT', 'MANUAL'].includes(f.allocationMethodCode))
          ),
      ) ||
      ledger.sources.some((s) => s.linkRoleCode !== 'COST' || s.allocations.length > 1))
  )
}

export function savedTransportAllocations(detail: TransportDetail, sources: Source[]) {
  const { record, platform } = detail
  if (detail.orderAllocations && Object.keys(detail.orderAllocations).length)
    return Object.entries(detail.orderAllocations).map(([code, amount]) => ({ code, amount }))
  if (!record.data.ledger && platform?.draft) {
    const total = record.data.amount ?? null
    if (allocationError(total, platform.draft.orderCodes, platform.draft.orderAllocations))
      return platform.draft.orderCodes.map((code) => ({ code, amount: null }))
    return transportAllocations(
      total,
      platform.draft.orderCodes,
      sources,
      platform.draft.orderAllocations,
    )
  }
  return (
    record.data.ledger?.sources
      .filter((s) => s.orderCode && s.linkRoleCode === 'COST')
      .map((s) => ({
        code: s.orderCode!,
        amount:
          record.data.amount == null
            ? null
            : s.allocations.reduce((n, a) => n + Math.round((a.amount ?? 0) * 100), 0) / 100,
      })) || []
  )
}
