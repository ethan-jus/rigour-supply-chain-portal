import { logisticsRoute } from './cost-logistics'
import { costSourceLabel, externalDocuments, externalSourceName } from './cost-source'
import type { CostRecord } from '@/api/core/cost'
import { costLabel, costMoney } from './cost-dictionaries'
const names: Record<string, string> = {
  CREATE: '新增',
  ATTACHMENT_ADDED: '添加附件',
  UPDATE: '修改',
  BEFORE_UPDATE: '修改前',
  CONFIRMED: '确认',
  CONFIRM: '确认',
  VOID: '作废',
  CALCULATE: '核算',
  BEFORE_CALCULATE: '重新核算前',
  PAID: '登记发放',
  PAYMENT_REGISTER: '登记实际发放',
  BEFORE_REOPEN: '撤回确认前快照',
  REOPEN: '撤回确认',
  CORRECTION_CREATE: '创建跨月补差',
  CORRECTION_RECEIVE: '接收跨月补差',
  CORRECTION_VOID: '作废补差',
  PROFILE_BEFORE: '薪酬档案维护前',
  PROFILE_BATCH: '批量维护薪酬档案',
  RULE_SAVE: '保存规则',
  BEFORE_RULE_UPDATE: '规则修改前',
  INPUT_BEFORE: '月度调整前',
  INPUT_SAVE: '月度调整',
  EXPENSE_SAVE: '保存报销',
  EXPENSE_BEFORE: '报销修改前',
  EXPENSE_CONFIRMED: '确认报销',
  EXPENSE_VOID: '作废报销',
}
export const auditLabel = (action: string) => names[action] ?? action
export function parseSnapshot(value?: string) {
  if (!value) return null
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

/** 审计展示业务字段，避免将内部请求编号和原始 JSON 放进操作流程。 */
export function costSnapshotFields(snapshot: unknown): { label: string; value: string }[] {
  if (!snapshot || typeof snapshot !== 'object') return []
  const row = snapshot as Record<string, unknown>
  const data = row.data as Record<string, unknown> | undefined
  if (!data) return []
  const fields: { label: string; value: string }[] = []
  const add = (label: string, value: unknown) => {
    if (value !== undefined && value !== null && value !== '')
      fields.push({ label, value: String(value) })
  }
  add('费用单号', row.documentNo)
  add('录入人', row.createdBy)
  add('录入时间', row.createdTime)
  add('修改人', row.updatedBy)
  add('修改时间', row.updatedTime)
  add('事项', data.title)
  if (row.categoryCode === 'MARKETING')
    add('费用类型', costLabel('MARKETING_EXPENSE_TYPE', data.typeCode as string))
  if (row.categoryCode === 'EXPENSE')
    add('费用类型', costLabel('REIMBURSEMENT_EXPENSE_TYPE', data.typeCode as string))
  add('归属城市', data.cityName)
  add('经办人', row.ownerEmployeeName ?? row.employeeName ?? data.ownerName)
  add('费用日期', data.costDate)
  add('费用月份', data.costMonth)
  add('收款方', data.payeeName)
  add('单据来源', costSourceLabel(snapshot as CostRecord))
  for (const [index, doc] of externalDocuments(snapshot as CostRecord).entries()) {
    add(
      `外部单据 ${index + 1}`,
      `${externalSourceName(doc.sourceSystem)} · ${doc.documentNo} · ${doc.documentDate} · ${doc.senderName} → ${doc.receiverName}`,
    )
    add(`外部单据 ${index + 1} 备注`, doc.remark)
    add(`外部单据 ${index + 1} 关联状态`, doc.linkedId ? '已关联本系统' : '手工补录')
    add(`外部单据 ${index + 1} 收货地址`, doc.destinationAddress)
    add(`外部单据 ${index + 1} 差异说明`, doc.differenceReason)
  }
  const sources = row.sources as
    | {
        documentNo: string
        originalNo?: string
        sourceSystem?: string
        senderName: string
        receiverName: string
      }[]
    | undefined
  add(
    '关联系统单据',
    sources
      ?.map(
        (s) =>
          `${externalSourceName(s.sourceSystem ?? 'UNKNOWN')} · ${s.originalNo || s.documentNo} · 本系统单号 ${s.documentNo} · ${s.senderName} → ${s.receiverName}`,
      )
      .join('；'),
  )
  add('金额', costMoney(data.amount as number | null))
  add('确认状态', costLabel('COST_STATUS', row.statusCode as string))
  add('付款状态', costLabel('COST_PAYMENT_STATUS', data.paymentStatusCode as string))
  add('备注', data.remark)
  const transport = data.logistics as Record<string, unknown> | undefined
  if (transport) {
    add('物流类型', costLabel('COST_LOGISTICS_LEG', transport.legCode as string))
    const route = logisticsRoute(
      (snapshot as CostRecord).data.logistics,
      (snapshot as CostRecord).sources,
    )
    add(route.sender, route.senderName)
    add(route.receiver, route.receiverName)
    add('起点', transport.originAddress)
    add('终点', transport.destinationAddress)
    for (const stop of (snapshot as CostRecord).data.logistics?.deliveryStops || [])
      add(`${stop.customerName}收货地址`, stop.address)
    add('无单原因', transport.noSourceReason)
    add('手填对象说明', transport.manualPartyReason)
    add('承运方', transport.carrierName)
    add('运单号', transport.trackingNo)
    add('费用承担方', costLabel('COST_PAYER', transport.payerCode as string))
  }
  const rental = data.rental as Record<string, unknown> | undefined
  if (rental) {
    const premisesType =
      (rental.premisesType as string) || (rental.warehouseId ? 'WAREHOUSE' : 'UNKNOWN')
    add(
      '场地类型',
      premisesType === 'UNKNOWN' ? '类型待核对' : costLabel('COST_PREMISES_TYPE', premisesType),
    )
    add('场地名称', rental.premisesName || row.warehouseName)
    add('地址', rental.address)
    add('出租方', rental.landlordName)
    if (rental.warehouseId) add('仓库', row.warehouseName)
    add('合同编号', rental.contractNo)
    add('面积（㎡）', rental.area)
    if (rental.leaseFrom || rental.leaseTo)
      add('租期', `${rental.leaseFrom || '—'} 至 ${rental.leaseTo || '—'}`)
    if (rental.deposit != null) add('押金', costMoney(rental.deposit as number))
  }
  const goods = data.goods as Record<string, unknown> | undefined
  if (goods) {
    for (const [key, label] of Object.entries({
      productName: '商品名称',
      specification: '规格',
      unit: '单位',
      unitPrice: '进货单价',
      quantity: '数量',
      supplierName: '供应商',
      location: '发生地点',
      lossReason: '损耗原因',
      amountReason: '金额说明',
    }))
      add(label, goods[key])
    add('仓库', row.warehouseName)
  }
  const marketing = data.marketing as Record<string, unknown> | undefined
  if (marketing) {
    add('投放渠道', marketing.channelName)
    if (marketing.serviceFrom || marketing.serviceTo)
      add('活动服务期间', `${marketing.serviceFrom || '—'} 至 ${marketing.serviceTo || '—'}`)
  }
  return fields
}
