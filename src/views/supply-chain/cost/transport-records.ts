import type { CostRecord, CostSource } from '@/api/core/cost'
import type {
  PlatformTransport,
  ShipmentTransportSource,
  TransportDraft,
} from '@/api/core/transport-records'
import { currentSource } from './huolala-source'
import { randomId } from '@/utils/random-id'
import { businessDateTime } from '@/utils/business-date'
export const transportTypes = [
  { value: 'DELIVERY', label: '销售订单配送', orderType: 'SALES_ORDER', orderLabel: '销售单' },
  { value: 'TRANSFER', label: '仓间调拨', orderType: 'TRANSFER_ORDER', orderLabel: '调拨单' },
  { value: 'OTHER', label: '其他费用', orderType: 'OTHER_OUT', orderLabel: '其他订单' },
]
export const receivingMethods = [
  { value: 'DOOR_DELIVERY', label: '送货上门' },
  { value: 'SELF_PICKUP', label: '到点自提' },
]
export function transportReceivingMethod(
  manualCode: string | null | undefined,
  platform: PlatformTransport | null | undefined,
) {
  if (platform) return receivingMethods[0]!.label
  return receivingMethods.find((option) => option.value === manualCode)?.label || '-'
}
export function shipmentRemark(fields: ShipmentTransportSource['latest']['sourceFields'] | null) {
  const read = (data: unknown) =>
    data && typeof data === 'object' && 'remark' in data && typeof data.remark === 'string'
      ? data.remark
      : undefined
  if (typeof fields?.shipmentRemark === 'string') return fields.shipmentRemark
  return read(fields?.detail) ?? read(fields?.list) ?? ''
}
export function shipmentCarrierNames(shipments: ShipmentTransportSource[] = []) {
  const names = shipments.map(({ latest }) => latest.carrierName?.trim()).filter(Boolean)
  return [...new Set(names)].join('、')
}

export function shipmentUsesHuolala(source: ShipmentTransportSource, orderNo?: string | null) {
  const normalized = (value: string) => value.trim().toUpperCase()
  const numbers = new Set(source.latest.trackingNumbers.map(normalized).filter(Boolean))
  return !!orderNo && numbers.size === 1 && numbers.has(normalized(orderNo))
}

export function transportSourceLabel(
  platform?: PlatformTransport | null,
  shipments: ShipmentTransportSource[] = [],
) {
  if (platform) return shipments.length ? '货拉拉和订货宝同步' : '货拉拉同步'
  return shipments.length ? '订货宝同步' : '手动录入'
}

export function transportPeople(
  row: CostRecord,
  platform?: PlatformTransport | null,
  shipments: ShipmentTransportSource[] = [],
) {
  const order = platform ? currentSource(platform.source) : null
  const name = order?.facts?.sourceEmployeeName?.trim() || order?.raw['下单人(员工)']?.trim()
  const huolala = name
    ? [{ name, department: order?.facts?.mappedDepartmentName?.trim() || '' }]
    : []
  const sales = new Map<string, { name: string; department: string }>()
  if (!platform || shipments.length) {
    const ledger = row.data.ledger?.sources
    const sources = ledger?.length
      ? ledger.filter((s) => s.orderTypeCode === 'SALES_ORDER' || s.orderTypeCode === 'DELIVERY')
      : row.sources.filter((s) => s.sourceType === 'SALES_ORDER' || s.sourceType === 'DELIVERY')
    for (const source of sources) {
      const name = source.employeeName?.trim()
      if (!name) continue
      const department = source.departmentName?.trim() || ''
      sales.set(JSON.stringify([name, department]), { name, department })
    }
  }
  return { sales: [...sales.values()], huolala }
}
export const money = (n: unknown) =>
  n == null || n === ''
    ? '-'
    : Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const typeName = (type: string | null | undefined) =>
  transportTypes.find((t) => t.value === type)?.label || '-'
export const statusName = (status: string, business?: string | null) =>
  status === 'VOID' ? '已作废' : business === 'COMPLETE' ? '已完善' : '待完善'
export const amountOf = (row: CostRecord, platform?: PlatformTransport | null) => {
  if (platform) return row.data.amount ?? null
  if (row.data.ledger?.feeItems.length)
    return row.data.ledger.feeItems.reduce<number | null>(
      (sum, f) => (sum === null || f.feeAmount == null ? null : sum + f.feeAmount),
      0,
    )
  return row.data.amount
}
/** 车型使用最新平台资料；没有来源值时保留未知，不按物流公司推断。 */
export const vehicleOf = (platform?: PlatformTransport | null): string =>
  (platform ? currentSource(platform.source).raw['车型']?.trim() : '') || '-'
function localTransportTime(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value} 00:00:00`
  if (/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return businessDateTime(value)
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?/.test(value))
    return `${value.slice(0, 16).replace('T', ' ')}${value.length >= 19 ? value.slice(16, 19) : ':00'}`
  return '-'
}
/** 按同一业务时间排序和展示；旧手工记录只登记日期时以当天零点呈现。 */
export function transportTimeOf(
  row: CostRecord,
  platform?: PlatformTransport | null,
  shipments: ShipmentTransportSource[] = [],
): string {
  const placed = platform ? currentSource(platform.source).raw['下单时间']?.trim() : ''
  if (placed) return localTransportTime(placed)
  const shipped = shipments
    .map((s) => s.latest.shipTime)
    .filter((v) => v && Number.isFinite(Date.parse(v)))
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0]
  if (shipped) return businessDateTime(shipped)
  if (platform) return '-'
  return (
    (row.data.ledger?.shippingTime ? localTransportTime(row.data.ledger.shippingTime) : '') ||
    (row.data.costDate ? `${row.data.costDate} 00:00:00` : '-')
  )
}
export const ordersOf = (row: CostRecord, platform?: PlatformTransport | null) =>
  platform?.draft?.orderCodes ??
  (row.data.ledger?.sources.length
    ? row.data.ledger.sources.map((s) => s.orderCode).filter((s): s is string => !!s)
    : undefined) ??
  row.sources.map((s) => s.documentNo)

export function shipmentOrderNumbers(shipments: ShipmentTransportSource[] = []): string[] {
  return [
    ...new Set(shipments.map((source) => source.salesOrderNo?.trim()).filter((no): no is string => !!no)),
  ]
}

export function displayedOrderNumbers(
  row: CostRecord,
  platform?: PlatformTransport | null,
  shipments?: ShipmentTransportSource[],
): string[] {
  return [...new Set([...ordersOf(row, platform), ...shipmentOrderNumbers(shipments)])].filter(
    (no) => no?.trim(),
  )
}

/** 历史记录可能只有原运输信息，详情仍展示已保存的收货方及地址。 */
export function frozenTransportReceivers(row: CostRecord) {
  const points = (row.data.ledger?.receivingPoints || []).filter(
    (p) => p.displayName?.trim() || p.manualName?.trim() || p.address?.trim(),
  )
  if (points.length)
    return points.map((p) => ({
      name: p.displayName || p.manualName,
      contactName: p.contactName,
      contactPhone: p.phone,
      address: p.address,
    }))
  const sources = row.sources.filter((s) => s.receiverName?.trim() || s.destinationAddress?.trim())
  if (sources.length)
    return sources.map((s) => ({
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
export interface TransportRoutePoint {
  name: string
  address: string
}
export interface TransportRoute {
  origin: TransportRoutePoint | null
  receivers: TransportRoutePoint[]
}
/** 平台路线按返回站序；手工路线按保存的收货点顺序，不按名称去重或重新排序。 */
export function routeOf(row: CostRecord, platform?: PlatformTransport | null): TransportRoute {
  const point = (name: string | null | undefined, address: string | null | undefined) => ({
    name: name?.trim() || address?.trim() || '-',
    address: address?.trim() || '',
  })
  if (platform) {
    const stops = currentSource(platform.source).facts?.stops || []
    return {
      origin: stops[0] ? point(stops[0].name, stops[0].address) : null,
      receivers: stops.slice(1).map((s) => point(s.name, s.address)),
    }
  }
  const sender = row.data.ledger?.sender
  const legacy = row.data.logistics
  const senderName =
    sender?.displayName?.trim() ||
    sender?.manualName?.trim() ||
    legacy?.senderName?.trim() ||
    row.sources.find((s) => s.senderName?.trim())?.senderName
  const senderAddress = sender?.address?.trim() || legacy?.originAddress?.trim()
  return {
    origin: senderName || senderAddress ? point(senderName, senderAddress) : null,
    receivers: frozenTransportReceivers(row).map((p) => point(p.name, p.address)),
  }
}
export function routeText(route: TransportRoute): string {
  const points = [route.origin, ...route.receivers]
  if (!points.some((p) => p && p.name !== '-')) return '-'
  return points
    .map((p) => {
      if (!p) return '-'
      return p.address && p.address !== p.name ? `${p.name}（${p.address}）` : p.name
    })
    .join(' → ')
}
/** 新旧单据分别从完整来源快照、台账归属及收货点恢复展示，不回读变化后的原单。 */
export function frozenTransportSources(row: CostRecord): CostSource[] {
  const ledger = row.data.ledger
  if (!ledger?.sources.length) return row.sources
  return ledger.sources
    .filter((s) => !!s.orderCode)
    .map((s) => {
      const existing = row.sources.find((r) => r.documentNo === s.orderCode)
      if (existing) return existing
      const points = ledger.receivingPoints.filter((p) =>
        s.allocations.some((a) => a.receivingPointCode === p.pointCode),
      )
      return {
        documentAmount: s.documentAmount,
        documentDate: s.documentDate,
        linkedAt: s.linkedAt,
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
      saved?.transportType ||
      ledger?.transportPurposeCode ||
      row?.data.typeCode ||
      row?.data.logistics?.legCode ||
      null,
    date:
      order?.useTime.slice(0, 10) ||
      row?.data.costDate ||
      businessDateTime(new Date()).slice(0, 10),
    shippingTime:
      ledger?.shippingTime ||
      (row?.data.costDate
        ? `${row.data.costDate}T00:00:00`
        : businessDateTime(new Date()).replace(' ', 'T')),
    deliveryModeCode:
      ledger?.deliveryModeCode || (ledger?.carrierCode === 'SELF' ? 'SELF' : 'THIRD_PARTY'),
    receivingMethodCode: ledger?.receivingMethodCode ?? null,
    receivingPoints: ledger?.receivingPoints.map((p) => ({ ...p })) || null,
    carrierCode: platform ? 'HLL' : (ledger?.carrierCode ?? null),
    trackingNo: order
      ? order.raw['运单号'] || ''
      : ledger?.trackingNo || row?.data.logistics?.trackingNo || '',
    platformOrderNo: order?.orderNo || ledger?.platformOrderNo || '',
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
    amount: row?.data.amount ?? null,
    paymentStatusCode: row?.data.paymentStatusCode || 'UNKNOWN',
    manualBillItems: platform ? [] : ledger?.manualBillItems?.map((item) => ({ ...item })) || [],
    ownerEmployeeCode: saved?.ownerEmployeeCode ?? row?.data.ownerEmployeeCode ?? null,
    remark: saved?.remark ?? row?.data.remark ?? '',
    reason: '',
    zeroReason: saved?.zeroReason ?? ledger?.feeItems[0]?.zeroCostReason ?? '',
    orderCodes: row ? ordersOf(row, platform) : [],
    orderAllocations:
      row?.data.amount != null &&
      ledger?.sources.length &&
      ledger.sources.every((s) => s.allocations.length > 0)
        ? Object.fromEntries(
            ledger.sources
              .filter((s) => s.orderCode)
              .map((s) => [
                s.orderCode!,
                row?.data.amount == null
                  ? null
                  : s.allocations.reduce((sum, a) => sum + Math.round((a.amount ?? 0) * 100), 0) /
                    100,
              ]),
          )
        : saved?.orderAllocations
          ? { ...saved.orderAllocations }
          : null,
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

/** 优惠按扣减处理，兼容历史负数金额；不重复扣减。 */
export function manualBillAmount(item: { name?: unknown; amount?: unknown }): number | null {
  if (item.amount == null || !Number.isFinite(Number(item.amount))) return null
  return /优惠|减免|抵扣|折扣/.test(String(item.name || ''))
    ? -Math.abs(Number(item.amount))
    : Number(item.amount)
}
export function manualBillTotal(items: { name?: string; amount: number | null }[]): number | null {
  const amounts = items.map(manualBillAmount)
  if (!amounts.length || amounts.some((amount) => amount == null)) return null
  return amounts.reduce<number>((cents, amount) => cents + Math.round(amount! * 100), 0) / 100
}

/** 总额编辑只调整一项基础运费，其他费用、优惠和原顺序保持不变。 */
export function adjustManualBillTotal(
  items: { name: string; amount: number | null }[],
  total: number | null,
): { name: string; amount: number | null }[] {
  if (!items.length) return []
  const next = items.map((item) => ({ ...item }))
  let index = next.findIndex((item) =>
    ['基础运费', '运费', '基础运输费'].includes(item.name.trim()),
  )
  if (index < 0) {
    next.unshift({ name: '基础运费', amount: 0 })
    index = 0
  }
  const others = next.filter((_, i) => i !== index)
  const otherTotal = others.length ? manualBillTotal(others) : 0
  if (otherTotal == null) throw new Error('请先填写其他费用项目的金额，再修改总额')
  const base = total == null ? null : (Math.round(total * 100) - Math.round(otherTotal * 100)) / 100
  if (base != null && base < 0) throw new Error('总额低于其他费用减去优惠后的金额，请先核对明细')
  next[index]!.amount = base
  return next
}
