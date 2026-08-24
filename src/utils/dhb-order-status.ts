import { businessDictionaryLabel, sourceText } from '@/utils/business-dictionary'

export interface DhbStatusOption {
  label: string
  value: string
}

export const pendingOrderStatusValues = new Set(['pricing', 'pending', 'stock_up', 'stockup', 'shipped', 'received'])

export function statusLabel(options: DhbStatusOption[], value: string | null): string {
  if (!value) return '-'
  return options.find((item) => item.value === value)?.label || value
}

export function formatOrderStatus(value: string | null): string {
  return businessDictionaryLabel('ORDER', 'DHB_ORDER_STATUS', value, '订单状态')
}

export function formatPaymentStatus(value: string | null): string {
  return businessDictionaryLabel('ORDER', 'DHB_ORDER_PAYMENT_STATUS', value, '收款状态')
}

export function formatApiStatus(value: string | null): string {
  return businessDictionaryLabel('ORDER', 'DHB_ORDER_API_STATUS', value, '下载状态')
}

export function formatExceptionStatus(value: string | null): string {
  return businessDictionaryLabel('ORDER', 'DHB_ORDER_EXCEPTION_STATUS', value, '异常标记')
}

export function formatOrderType(value: string | null): string {
  return businessDictionaryLabel('ORDER', 'DHB_ORDER_TYPE', value, '订单类型')
}

export function formatAdminOrder(value: string | null): string {
  return businessDictionaryLabel('ORDER', 'DHB_ORDER_ADMIN_FLAG', value, '订单来源')
}

/** 订货宝未公布完整设备枚举，保持本地库中的来源原文，不在 Portal 猜测。 */
export function formatSourceDevice(value: string | null): string {
  return sourceText(value)
}

/** 发货方式是业务配置文本，不是固定枚举。 */
export function formatSendType(value: string | null): string {
  return sourceText(value)
}

/** 预售标记尚无已验证业务字典；显示原值，避免把未知值误判为现货。 */
export function formatPreSale(value: string | null): string {
  return sourceText(value)
}

export function formatContentType(value: string | null): string {
  return businessDictionaryLabel('ORDER', 'DHB_ORDER_LINE_TYPE', value, '商品明细类型')
}

export function formatReturnType(value: string | null): string {
  return businessDictionaryLabel('ORDER', 'DHB_RETURN_TYPE', value, '退货类型')
}

/** 退货配送方式是业务文本，保持来源原文。 */
export function formatDeliveryMode(value: string | null): string {
  return sourceText(value)
}

/** 出库明细状态没有经过官方枚举核验，保持来源原文。 */
export function formatShipmentLineType(value: string | null): string {
  return sourceText(value)
}

const commonStatusLabels: Record<string, string> = {
  ACTIVE: '启用', INACTIVE: '停用', ENABLED: '启用', DISABLED: '停用',
  LOCKED: '锁定', SUSPENDED: '暂停', EXPIRED: '已过期', CLOSED: '已关闭',
  PENDING: '待处理', RUNNING: '运行中', PAUSED: '已暂停', FAILED: '失败',
  IDLE: '待运行', SUCCEEDED: '成功', SUCCESS: '成功', COMPLETED: '已完成',
  COMPLETE: '已完成', CANCELLED: '已取消', CANCELED: '已取消',
}

function mappedLabel(value: string | null | undefined, labels: Record<string, string>, unknown: string): string {
  if (!value) return '-'
  const normalized = value.trim()
  if (!normalized) return '-'
  if (/[㐀-鿿]/.test(normalized)) return normalized
  return labels[normalized.toUpperCase()] || `${unknown}（${normalized}）`
}

/** 仅用于平台内部通用状态；订货宝来源状态必须调用具体业务字典。 */
export function formatCommonStatus(value: string | null | undefined): string {
  return mappedLabel(value, commonStatusLabels, '未知内部状态')
}

export function formatSettlementMethod(value: string | null | undefined): string {
  return businessDictionaryLabel('ORDER', 'DHB_SETTLEMENT_METHOD', value, '结算方式')
}

export function formatPaymentMethod(value: string | null | undefined): string {
  return businessDictionaryLabel('ORDER', 'DHB_PAYMENT_METHOD', value, '支付方式')
}

export function formatBusinessType(value: string | null | undefined): string {
  return businessDictionaryLabel('ORDER', 'DHB_FINANCIAL_BUSINESS_TYPE', value, '业务类型')
}

export function formatFinancialBusinessType(value: string | null | undefined, _documentType: string | null | undefined): string {
  return formatBusinessType(value)
}

export function formatInvoiceType(value: string | null | undefined): string {
  return businessDictionaryLabel('ORDER', 'DHB_INVOICE_TYPE', value, '发票类型')
}

export function formatShipmentType(value: string | null | undefined): string {
  return businessDictionaryLabel('ORDER', 'DHB_SHIPMENT_TYPE', value, '出库类型')
}

export function formatInboundType(value: string | null | undefined): string {
  return businessDictionaryLabel('ERP', 'DHB_WAREHOUSING_TYPE', value, '入库类型')
}

export function formatSplitType(name: string | null | undefined, value: string | null | undefined): string {
  if (name?.trim()) return name.trim()
  return businessDictionaryLabel('ORDER', 'DHB_ORDER_SPLIT_TYPE', value, '拆单类型')
}

/** 客户类型当前是订单记录上的业务文本，尚未定义为有限枚举。 */
export function formatCustomerType(value: string | null | undefined): string {
  return sourceText(value)
}

/** 平台归一化记录类型，不是订货宝来源枚举。 */
export function formatPayloadType(value: string | null | undefined): string {
  return mappedLabel(value, {
    ORDER: '订单', PAYMENT: '付款', RECEIPT: '收款', REFUND: '退款', SHIPMENT: '出库/发货',
  }, '未知记录类型')
}
