import { logisticsRoute } from './cost-logistics'
import { costSourceLabel, externalDocuments, externalSourceName } from './cost-source'
import type { CostRecord } from '@/api/core/cost'
import { costLabel, costMoney } from './cost-dictionaries'
import { auditActorLabel } from '@/utils/audit-actor'
import { displayDateTime } from '@/utils/business-date'
import type { CostCategory } from '@/api/core/cost'

/** 业务导出采用固定字段清单，操作记录、技术来源及内部标识仅用于系统内追溯。 */
export function costExportHeaders(category: CostCategory): string[] {
  const business: Record<CostCategory, string[]> = {
    purchases: ['供应商', '仓库', '商品名称', '规格', '单位', '进货单价', '数量'],
    losses: ['仓库', '商品名称', '规格', '单位', '数量', '发生地点', '损耗原因'],
    logistics: ['物流类型', '发货方', '收货方', '承运方', '运单号', '费用承担方'],
    'warehouse-rentals': ['费用月份', '场地名称', '面积（㎡）', '出租方', '合同编号'],
    'office-rentals': ['费用月份', '场地名称', '面积（㎡）', '出租方', '合同编号'],
    marketing: ['事项', '费用类型', '投放渠道', '收款方', '经办人', '活动服务期间'],
    expenses: [
      '费用月份',
      '报销员工',
      '费用类型',
      '费用用途／出差事由',
      '物品或服务',
      '数量',
      '单位',
      '单价',
      '开始日期',
      '结束日期',
      '出发地',
      '目的地',
      '寄送内容',
      '收件客户 / 合作方',
      '快递公司',
      '运单号',
    ],
  }
  return ['费用单号', '费用日期', '费用归属', ...business[category], '金额', '确认状态']
}

/** 复用已展示的业务值，同时将不同运输环节归并为统一的发货方、收货方列。 */
export function costExportFields(row: CostRecord): { label: string; value: string | number }[] {
  const fields = costSnapshotFields(row, false)
  const route = row.data.logistics ? logisticsRoute(row.data.logistics, row.sources) : undefined
  return [
    ...fields.map((field) =>
      field.label === '金额' ? { ...field, value: row.data.amount ?? '' } : field,
    ),
    { label: '报销员工', value: row.ownerEmployeeName || '' },
    { label: '费用用途／出差事由', value: row.data.expense?.purpose || '' },
    { label: '发货方', value: route?.senderName || '' },
    { label: '收货方', value: route?.receiverName || '' },
  ]
}
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
  PAYMENT_ATTACHMENT_ADD: '补充发放凭证',
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
  EXPENSE_ATTACHMENT: '上传报销凭据',
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
export function costSnapshotFields(
  snapshot: unknown,
  includeAudit = true,
): { label: string; value: string }[] {
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
  if (includeAudit) {
    add('录入人', auditActorLabel(typeof row.createdBy === 'string' ? row.createdBy : undefined))
    add(
      '录入时间',
      displayDateTime(typeof row.createdTime === 'string' ? row.createdTime : undefined),
    )
    add('修改人', auditActorLabel(typeof row.updatedBy === 'string' ? row.updatedBy : undefined))
    add(
      '修改时间',
      displayDateTime(typeof row.updatedTime === 'string' ? row.updatedTime : undefined),
    )
  }
  add('事项', data.title)
  if (row.categoryCode === 'MARKETING')
    add('费用类型', costLabel('MARKETING_EXPENSE_TYPE', data.typeCode as string))
  if (row.categoryCode === 'EXPENSE')
    add('费用类型', costLabel('REIMBURSEMENT_EXPENSE_TYPE', data.typeCode as string))
  add('费用归属', data.cityName)
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
  const expense = data.expense as Record<string, unknown> | undefined
  if (expense) {
    for (const [key, label] of Object.entries({
      purpose: ['TRAVEL', 'ACCOMMODATION', 'TAXI'].includes(String(data.typeCode))
        ? '出差事项'
        : '费用用途',
      payeeName: '收款对象',
      itemName: '物品或服务',
      quantity: '数量',
      unit: '单位',
      unitPrice: '单价',
      amountReason: '金额说明',
      tripReference: '出差事项编号',
      startDate: '开始日期',
      endDate: '结束日期',
      departure: '出发地',
      destination: '目的地',
      evidenceNo: '凭据编号',
      noEvidenceReason: '无凭据说明',
    }))
      add(label, expense[key])
    if (data.typeCode === 'COURIER' && expense.courier) {
      const courier = expense.courier as Record<string, unknown>
      add('寄送内容', courier.contents)
      add('收件客户 / 合作方', courier.recipientName)
      add('快递公司', courier.companyName)
      add('运单号', courier.trackingNo)
    }
  }
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
      add(
        label,
        key === 'unit' && goods[key] ? costLabel('PRODUCT_UNIT', goods[key] as string) : goods[key],
      )
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
