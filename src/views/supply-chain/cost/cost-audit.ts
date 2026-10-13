import { costLabel, costMoney } from './cost-dictionaries'
const names: Record<string, string> = {
  CREATE: '新增',
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
  add('事项', data.title)
  add('归属城市', data.cityName)
  add('经办员工', row.ownerEmployeeName ?? row.employeeName)
  add('费用日期', data.costDate)
  add('金额', costMoney(data.amount as number | null))
  add('确认状态', costLabel('COST_STATUS', row.statusCode as string))
  add('付款状态', costLabel('COST_PAYMENT_STATUS', data.paymentStatusCode as string))
  add('备注', data.remark)
  const transport = data.logistics as Record<string, unknown> | undefined
  if (transport) {
    add('物流类型', costLabel('COST_LOGISTICS_LEG', transport.legCode as string))
    add('承运方', transport.carrierName)
    add('运单号', transport.trackingNo)
    add('费用承担方', costLabel('COST_PAYER', transport.payerCode as string))
  }
  const rental = data.rental as Record<string, unknown> | undefined
  if (rental) {
    add('仓库', row.warehouseName)
    add('合同编号', rental.contractNo)
    add('面积（㎡）', rental.area)
    add('租期', `${rental.leaseFrom} 至 ${rental.leaseTo}`)
    add('押金', costMoney(rental.deposit as number | null))
  }
  return fields
}
