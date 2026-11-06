/** 与物流协议中的稳定编码对应，采购费用独立归入采购成本。 */
export const transportTypes = [
  { value: 'TRANSFER', label: '仓间调拨' },
  { value: 'DELIVERY', label: '销售订单配送' },
  { value: 'OTHER', label: '其他费用' },
]
export const logisticsOrderTypes = [
  { value: 'TRANSFER_ORDER', label: '调拨单' },
  { value: 'SALES_ORDER', label: '销售单' },
  { value: 'OTHER_OUT', label: '其他订单' },
]
export function transportTypeLabel(code: string | null | undefined) {
  if (code === 'PURCHASE') return '采购运费（历史）'
  const canonical = code === 'NON_SALES' ? 'OTHER' : code
  return transportTypes.find((t) => t.value === canonical)?.label || '待核对'
}
export function logisticsOrderTypeLabel(code: string) {
  if (code === 'PURCHASE_ORDER') return '采购单（历史追溯）'
  if (code === 'NONE') return '无关联单据'
  if (code === 'REQUISITION_OUT') return '其他订单'
  return logisticsOrderTypes.find((t) => t.value === code)?.label || code
}
