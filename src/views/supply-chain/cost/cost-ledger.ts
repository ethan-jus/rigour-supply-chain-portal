import type { CostCommand, CostRecord } from '@/api/core/cost'
import { randomId } from '@/utils/random-id'
import { suggestedPurchaseAmount } from './cost-amount'

import type {
  LedgerParty,
  LedgerFee,
  WarehouseLedgerFee,
  WarehouseLedger,
} from '@/types/cost-ledger'
export type {
  LedgerParty,
  LedgerFee,
  LedgerAllocation,
  LedgerSource,
  LogisticsLedger,
  WarehouseLedgerFee,
  WarehouseLedger,
} from '@/types/cost-ledger'

export const partyName = (p: LedgerParty) =>
  p.displayName || p.manualName || p.partyCode || '待选择'
export function receiverNames(row: CostRecord): string[] {
  const points = row.data.ledger?.receivingPoints
  if (points?.length) return points.map(partyName)
  const stops = row.data.logistics?.deliveryStops?.map((p) => p.customerName).filter(Boolean)
  if (stops?.length) return [...new Set(stops)]
  const sources = row.sources?.map((p) => p.receiverName).filter(Boolean)
  if (sources?.length) return [...new Set(sources)]
  return [row.data.logistics?.receiverName || row.warehouseName || '—']
}
export function splitMoney(amount: number, weights: number[]): number[] {
  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    !weights.length ||
    weights.some((w) => !Number.isFinite(w) || w <= 0)
  )
    throw new Error('请填写有效金额和正数分摊基数')
  const cents = BigInt(amount.toFixed(2).replace('.', ''))
  const scaled = weights.map((w) => BigInt(w.toFixed(6).replace('.', '')))
  const sum = scaled.reduce((a, b) => a + b, 0n)
  const allocated = scaled.map((w) => (cents * w) / sum)
  const order = scaled
    .map((w, i) => ({ i, remainder: (cents * w) % sum }))
    .sort((a, b) => (a.remainder === b.remainder ? a.i - b.i : a.remainder > b.remainder ? -1 : 1))
  const left = Number(cents - allocated.reduce((a, b) => a + b, 0n))
  for (let i = 0; i < left; i++) allocated[order[i]!.i] = allocated[order[i]!.i]! + 1n
  return allocated.map((v) => Number(v) / 100)
}
export const moneyCents = (value: number) => BigInt(Number(value).toFixed(2).replace('.', ''))
export function totalFees(fees: { feeAmount: number | null }[]): number | null {
  return fees.some((f) => f.feeAmount == null)
    ? null
    : Number(fees.reduce((n, f) => n + moneyCents(f.feeAmount!), 0n)) / 100
}
export const newParty = (cityCode = ''): LedgerParty => ({
  pointCode: randomId(),
  partyTypeCode: 'WAREHOUSE',
  partyCode: null,
  manualName: null,
  contactName: '',
  phone: '',
  address: '',
  cityCode,
})
export const newLogisticsFee = (): LedgerFee => ({
  feeKey: randomId(),
  feeTypeCode: 'FREIGHT',
  feeAmount: null,
  bearerCode: 'COMPANY',
  ourAmount: null,
  allocationMethodCode: 'MANUAL',
  zeroCostReason: '',
  remark: '',
})
export const newWarehouseFee = (date: string): WarehouseLedgerFee => ({
  feeKey: randomId(),
  feeTypeCode: 'RENT',
  quantity: null,
  unitCode: null,
  unitPrice: null,
  feeAmount: null,
  allocationMethodCode: 'SINGLE_DATE',
  attributionDate: date,
  serviceFrom: null,
  serviceTo: null,
  monthAllocations: [],
  remark: '',
})

export function previewWarehouseFee(fee: WarehouseLedgerFee) {
  if (fee.quantity != null && fee.unitPrice != null)
    fee.feeAmount = suggestedPurchaseAmount(fee.quantity, fee.unitPrice)
  if (fee.allocationMethodCode === 'SINGLE_DATE') {
    fee.monthAllocations = fee.attributionDate
      ? [{ month: fee.attributionDate.slice(0, 7), amount: fee.feeAmount }]
      : []
    return
  }
  if (!fee.serviceFrom || !fee.serviceTo || fee.serviceTo < fee.serviceFrom) {
    fee.monthAllocations = []
    return
  }
  if (fee.allocationMethodCode === 'MANUAL') return
  const months: string[] = [],
    weights: number[] = []
  const from = Date.parse(`${fee.serviceFrom}T00:00:00Z`),
    to = Date.parse(`${fee.serviceTo}T00:00:00Z`)
  let month = new Date(`${fee.serviceFrom.slice(0, 7)}-01T00:00:00Z`)
  while (month.getTime() <= to && months.length <= 120) {
    const begin = month.getTime()
    const next = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1))
    months.push(month.toISOString().slice(0, 7))
    weights.push(
      fee.allocationMethodCode === 'MONTH_EQUAL'
        ? 1
        : (Math.min(next.getTime() - 86400000, to) - Math.max(begin, from)) / 86400000 + 1,
    )
    month = next
  }
  if (months.length > 120) throw new Error('一次费用服务期间最多120个月')
  const amounts = fee.feeAmount == null ? null : splitMoney(fee.feeAmount, weights)
  fee.monthAllocations = months.map((month, i) => ({ month, amount: amounts?.[i] ?? null }))
}
export function warehouseMonths(plan: WarehouseLedger) {
  const rows = new Map<string, number | null>()
  for (const fee of plan.feeItems)
    for (const item of fee.monthAllocations) {
      const old = rows.get(item.month)
      rows.set(
        item.month,
        old === null || item.amount == null
          ? null
          : Number(moneyCents(old ?? 0) + moneyCents(item.amount)) / 100,
      )
    }
  return [...rows]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => ({ month, amount }))
}
export function createLedgerCommand(logistics: boolean): CostCommand {
  const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })
  return {
    requestId: randomId(),
    revision: null,
    title: '',
    typeCode: null,
    cityCode: '',
    cityName: '',
    departmentId: null,
    ownerEmployeeCode: null,
    costDate: date,
    amount: null,
    paymentStatusCode: 'UNPAID',
    logistics: null,
    rental: null,
    remark: '',
    reason: '',
    ledger: logistics
      ? {
          schemaVersion: 2,
          transportPurposeCode: 'DELIVERY',
          deliveryModeCode: 'THIRD_PARTY',
          carrierCode: null,
          costMonth: date.slice(0, 7),
          trackingNo: '',
          transportMethodCode: null,
          sender: newParty(),
          receivingPoints: [newParty()],
          feeItems: [newLogisticsFee()],
          sources: [],
          nonSalesPurposeCode: '',
          noTrackingReason: '',
          noSourceReason: '',
        }
      : null,
    warehouseLedger: logistics
      ? null
      : {
          schemaVersion: 2,
          warehouseCode: null,
          serviceProviderCode: null,
          paymentDate: null,
          depositAmount: null,
          contractNo: '',
          feeItems: [newWarehouseFee(date)],
        },
  }
}
