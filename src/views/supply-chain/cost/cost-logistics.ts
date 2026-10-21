import type { CostCommand, CostSource } from '@/api/core/cost'

/** 固定运输环节的业务角色；名称始终来自单据快照或业务手填，不按名称推测仓库类型。 */
export const logisticsLegs = [
  {
    code: 'PURCHASE',
    title: '供应商 → 中心仓',
    sender: '供应商（厂家）',
    receiver: '中心仓',
    document: '采购单',
  },
  {
    code: 'TRANSFER',
    title: '中心仓 → 城市仓',
    sender: '中心仓',
    receiver: '城市仓',
    document: '调拨单',
  },
  {
    code: 'DELIVERY',
    title: '城市仓 → 客户',
    sender: '城市仓',
    receiver: '客户',
    document: '销售订单',
  },
] as const
export function logisticsRoles(leg?: string) {
  return (
    logisticsLegs.find((r) => r.code === leg) ?? {
      code: '',
      title: '运输环节待核对',
      sender: '发货方',
      receiver: '收货方',
      document: '来源单据',
    }
  )
}
export function logisticsRoute(logistics: CostCommand['logistics'], sources: CostSource[] = []) {
  const roles = logisticsRoles(logistics?.legCode)
  const names = (side: 'senderName' | 'receiverName') => {
    if (sources.length)
      return [
        ...new Set([
          ...sources.map((s) =>
            side === 'senderName' && logistics?.legCode === 'DELIVERY' && !s.warehouseId
              ? s.senderName?.trim() || logistics.senderName?.trim() || '城市仓待补录'
              : s[side]?.trim() || '待核对',
          ),
          ...(logistics?.externalDocuments || [])
            .filter((d) => !d.linkedId)
            .map((d) => d[side]?.trim() || '待核对'),
        ]),
      ].join('、')
    return logistics?.[side]?.trim() || '待补录'
  }
  return { ...roles, senderName: names('senderName'), receiverName: names('receiverName') }
}
