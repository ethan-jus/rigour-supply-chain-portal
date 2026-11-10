import type { CostRecord, CostSource } from '@/api/core/cost'
import type { PlatformTransport, TransportDraft } from '@/api/core/transport-records'
import { currentSource } from './huolala-source'
import { randomId } from '@/utils/random-id'
export const transportTypes = [
  { value: 'DELIVERY', label: '销售订单配送', orderType: 'SALES_ORDER', orderLabel: '销售单' },
  { value: 'TRANSFER', label: '仓间调拨', orderType: 'TRANSFER_ORDER', orderLabel: '调拨单' },
  { value: 'OTHER', label: '其他费用', orderType: 'OTHER_OUT', orderLabel: '其他订单' },
]
export const money = (n: unknown) =>
  n == null || n === ''
    ? '-'
    : Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const typeName = (type: string | null | undefined) =>
  transportTypes.find((t) => t.value === type)?.label || '-'
export const statusName = (status: string) =>
  ({ DRAFT: '待确认', CONFIRMED: '已确认', VOID: '已作废' })[status] || '-'
export const amountOf = (row: CostRecord, platform?: PlatformTransport | null) => {
  if (platform) return currentSource(platform.source).facts?.billAmount ?? null
  if (row.data.ledger?.feeItems.length)
    return row.data.ledger.feeItems.reduce<number | null>(
      (sum, f) => (sum === null || f.feeAmount == null ? null : sum + f.feeAmount),
      0,
    )
  return row.data.amount
}
export const ordersOf = (row: CostRecord, platform?: PlatformTransport | null) =>
  platform?.draft?.orderCodes ??
  row.data.ledger?.sources.map((s) => s.orderCode).filter((s): s is string => !!s) ??
  row.sources.map((s) => s.documentNo)
/** 历史记录可能只有原运输信息，详情仍展示已保存的收货方及地址。 */
export function frozenTransportReceivers(row: CostRecord) {
  const points = row.data.ledger?.receivingPoints || []
  if (points.length)
    return points.map((p) => ({
      name: p.displayName || p.manualName,
      contactName: p.contactName,
      contactPhone: p.phone,
      address: p.address,
    }))
  if (row.sources.length)
    return row.sources.map((s) => ({
      name: s.receiverName,
      contactName: s.contactName,
      contactPhone: s.contactPhone,
      address: s.destinationAddress,
    }))
  const legacy = row.data.logistics
  if (legacy?.deliveryStops?.length)
    return legacy.deliveryStops.map((s) => ({
      name: s.customerName,
      address: s.address,
      contactName: null,
      contactPhone: null,
    }))
  return legacy?.receiverName || legacy?.destinationAddress
    ? [
        {
          name: legacy.receiverName,
          address: legacy.destinationAddress,
          contactName: null,
          contactPhone: null,
        },
      ]
    : []
}
export function receiversOf(row: CostRecord, platform?: PlatformTransport | null): string[] {
  if (platform) {
    const stops =
      currentSource(platform.source)
        .facts?.stops.slice(1)
        .map((s) => s.name || s.address || '-')
        .filter(Boolean) || []
    return stops.length ? stops : ['-']
  }
  const names = frozenTransportReceivers(row)
    .map((p) => p.name || p.address || '-')
    .filter(Boolean)
  return names.length ? [...new Set(names)] : ['-']
}
/** 新旧单据分别从完整来源快照、台账归属及收货点恢复展示，不回读变化后的原单。 */
export function frozenTransportSources(row: CostRecord): CostSource[] {
  const ledger = row.data.ledger
  if (!ledger) return row.sources
  return ledger.sources
    .filter((s) => !!s.orderCode)
    .map((s) => {
      const existing = row.sources.find((r) => r.documentNo === s.orderCode)
      if (existing) return existing
      const points = ledger.receivingPoints.filter((p) =>
        s.allocations.some((a) => a.receivingPointCode === p.pointCode),
      )
      return {
        id: s.orderCode!,
        documentNo: s.orderCode!,
        sourceType: s.orderTypeCode,
        employeeCode: s.employeeCode,
        employeeName: s.employeeName,
        departmentId: s.departmentId,
        departmentName: s.departmentName,
        cityCode: points[0]?.cityCode || row.data.cityCode || '',
        warehouseId: null,
        targetWarehouseId: null,
        senderCode: ledger.sender.partyCode || '',
        senderName: ledger.sender.displayName || ledger.sender.manualName || '',
        receiverCode: points[0]?.partyCode || '',
        receiverName: points
          .map((p) => p.displayName || p.manualName || '')
          .filter(Boolean)
          .join('、'),
        contactName: points
          .map((p) => p.contactName)
          .filter(Boolean)
          .join('、'),
        contactPhone: points
          .map((p) => p.phone)
          .filter(Boolean)
          .join('、'),
        destinationAddress: points
          .map((p) => p.address)
          .filter(Boolean)
          .join('；'),
        statusCode: '',
      }
    })
}
export function transportDraft(
  row?: CostRecord,
  platform?: PlatformTransport | null,
): TransportDraft {
  const ledger = row?.data.ledger
  const order = platform ? currentSource(platform.source) : null
  const saved = platform?.draft
  return {
    requestId: row?.data.requestId || randomId(),
    revision: row?.revision ?? null,
    transportType:
      saved?.transportType ??
      ledger?.transportPurposeCode ??
      row?.data.typeCode ??
      row?.data.logistics?.legCode ??
      null,
    date:
      order?.useTime.slice(0, 10) || row?.data.costDate || new Date().toLocaleDateString('sv-SE'),
    carrierCode: platform ? 'HLL' : (ledger?.carrierCode ?? null),
    trackingNo: order?.orderNo || ledger?.trackingNo || row?.data.logistics?.trackingNo || '',
    platformOrderNo: order?.orderNo || (ledger?.carrierCode === 'HLL' ? ledger.trackingNo : ''),
    warehouseCode:
      saved?.warehouseCode ??
      (ledger?.sender.partyTypeCode === 'WAREHOUSE' ? ledger.sender.partyCode : null),
    senderName:
      saved?.senderName ??
      ledger?.sender.displayName ??
      ledger?.sender.manualName ??
      row?.data.logistics?.senderName ??
      '',
    senderContact: saved?.senderContact ?? ledger?.sender.contactName ?? '',
    senderPhone: saved?.senderPhone ?? ledger?.sender.phone ?? '',
    senderAddress:
      saved?.senderAddress ?? ledger?.sender.address ?? row?.data.logistics?.originAddress ?? '',
    cityCode: saved?.cityCode ?? row?.data.cityCode ?? '',
    amount: platform
      ? Number.isFinite(Number(order?.facts?.billAmount)) && order?.facts?.billAmount != null
        ? Number(order.facts.billAmount)
        : null
      : (row?.data.amount ?? null),
    ownerEmployeeCode: saved?.ownerEmployeeCode ?? row?.data.ownerEmployeeCode ?? null,
    remark: saved?.remark ?? row?.data.remark ?? '',
    reason: '',
    zeroReason: saved?.zeroReason ?? ledger?.feeItems[0]?.zeroCostReason ?? '',
    orderCodes: row ? ordersOf(row, platform) : [],
  }
}
/** 展示预览也按分分摊，尾差固定给排序后的首批单据；最终以服务端结果为准。 */
export function allocationPreview(amount: number | null, codes: string[]) {
  const sorted = [...new Set(codes)].sort()
  if (!sorted.length || amount == null) return []
  const cents = Math.round(amount * 100)
  return sorted.map((code, i) => ({
    code,
    amount: (Math.floor(cents / sorted.length) + (i < cents % sorted.length ? 1 : 0)) / 100,
  }))
}
