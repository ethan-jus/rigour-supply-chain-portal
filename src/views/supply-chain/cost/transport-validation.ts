import type { TransportDraft } from '@/api/core/transport-records'
export type TransportErrors = Record<string, string>
const phone = /^[+0-9()（） #\-]{5,50}$/
/** 三个入口使用同一保存规则；未知金额可登记，资料完整状态由服务端判定。 */
export function validateManualTransport(d: TransportDraft): TransportErrors {
  const errors: TransportErrors = {}
  const required = (
    field: string,
    value: string | null | undefined,
    max: number,
    label: string,
  ) => {
    if (!value?.trim() || value.length > max) errors[field] = `请填写有效的${label}`
  }
  required('transportType', d.transportType, 64, '运输类型')
  required('deliveryModeCode', d.deliveryModeCode, 64, '配送方式')
  required('date', d.date, 10, '发货日期')
  if (
    !d.shippingTime ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(d.shippingTime) ||
    d.shippingTime.slice(0, 10) !== d.date
  )
    errors.date = '请填写精确到时分秒的发货时间'
  if (d.deliveryModeCode !== 'SELF') {
    required('carrierCode', d.carrierCode, 64, '物流公司')
    required('platformOrderNo', d.platformOrderNo, 80, '快递单号')
  }
  required('senderName', d.senderName, 100, '实际发货方')
  required('senderAddress', d.senderAddress, 500, '发货地址')
  if (d.senderPhone && !phone.test(d.senderPhone)) errors.senderPhone = '联系电话格式无效'
  if (!d.orderCodes.length) errors.orderCodes = '请选择关联业务订单'
  if (!d.receivingPoints?.length) errors.receivingPoints = '请填写收货信息'
  d.receivingPoints?.forEach((point, i) => {
    const key = `receivingPoints.${i}.`
    required(key + 'manualName', point.manualName || point.displayName, 100, '收货单位')
    required(key + 'contactName', point.contactName, 100, '收货联系人')
    required(key + 'address', point.address, 500, '收货地址')
    if (!point.phone || !phone.test(point.phone)) errors[key + 'phone'] = '请填写有效的收货联系电话'
  })
  if (
    d.amount != null &&
    (!Number.isFinite(d.amount) ||
      d.amount < 0 ||
      Math.abs(d.amount * 100 - Math.round(d.amount * 100)) > 0.0001)
  )
    errors.amount = '金额须为非负数，最多两位小数'
  if (d.amount === 0 && !d.zeroReason?.trim()) errors.zeroReason = '请填写零元原因'
  return errors
}
