import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearBusinessDictionariesForTest,
  seedBusinessDictionaryForTest,
} from '@/utils/business-dictionary'
import {
  formatAdminOrder,
  formatApiStatus,
  formatBusinessType,
  formatFinancialBusinessType,
  formatCommonStatus,
  formatCustomerType,
  formatExceptionStatus,
  formatInboundType,
  formatInvoiceType,
  formatOrderStatus,
  formatOrderType,
  formatPaymentMethod,
  formatPaymentStatus,
  formatPayloadType,
  formatSendType,
  formatPreSale,
  formatContentType,
  formatDeliveryMode,
  formatReturnType,
  formatShipmentLineType,
  formatShipmentType,
  formatSettlementMethod,
  formatSplitType,
  formatSourceDevice,
  statusLabel,
} from '@/utils/dhb-order-status'

function seed(moduleCode: string, code: string, values: Array<[string, string]>) {
  seedBusinessDictionaryForTest(moduleCode, code, values.map(([value, name], index) => ({
    code: `ITEM_${index}`,
    name,
    value,
    status: 'ACTIVE',
    sortNo: index,
  })))
}

describe('订货宝订单状态展示', () => {
  beforeEach(() => {
    clearBusinessDictionariesForTest()
    seed('ORDER', 'DHB_ORDER_STATUS', [['stockup', '待出库']])
    seed('ORDER', 'DHB_ORDER_PAYMENT_STATUS', [['unoblig', '待确认付款']])
    seed('ORDER', 'DHB_ORDER_API_STATUS', [['F', '未下载']])
    seed('ORDER', 'DHB_ORDER_EXCEPTION_STATUS', [['T', '异常']])
    seed('ORDER', 'DHB_ORDER_ADMIN_FLAG', [['T', '管理端下单']])
    seed('ORDER', 'DHB_ORDER_TYPE', [['M', '管理端代提交']])
    seed('ORDER', 'DHB_ORDER_LINE_TYPE', [['g', '赠品']])
    seed('ORDER', 'DHB_RETURN_TYPE', [['1', '退货退款']])
    seed('ORDER', 'DHB_SETTLEMENT_METHOD', [['forward', '现付']])
    seed('ORDER', 'DHB_PAYMENT_METHOD', [
      ['wechat', '微信支付'], ['Offline', '转账支付'],
      ['TPPAY_UNIFIED_WX_MINIAPP', '微信支付（通企付）'],
    ])
    seed('ORDER', 'DHB_FINANCIAL_BUSINESS_TYPE', [['13', '订单收款'], ['5', '预存款扣款']])
    seed('ORDER', 'DHB_INVOICE_TYPE', [['P', '普通发票']])
    seed('ORDER', 'DHB_SHIPMENT_TYPE', [['10', '销售出库']])
    seed('ERP', 'DHB_WAREHOUSING_TYPE', [['1', '采购入库']])
  })

  it('将订单和支付状态转换成中文', () => {
    expect(formatOrderStatus('stockup')).toBe('待出库')
    expect(formatPaymentStatus('unoblig')).toBe('待确认付款')
  })

  it('将来源状态转换成中文', () => {
    expect(formatApiStatus('F')).toBe('未下载')
    expect(formatExceptionStatus('T')).toBe('异常')
    expect(formatAdminOrder('T')).toBe('管理端下单')
  })

  it('只翻译已装载字典，非枚举业务文本保留本地来源原值', () => {
    expect(formatOrderType('M')).toBe('管理端代提交')
    expect(formatSourceDevice('android')).toBe('android')
    expect(formatSourceDevice('mini')).toBe('mini')
    expect(formatSendType('express')).toBe('express')
    expect(formatPreSale('1')).toBe('1')
    expect(formatContentType('g')).toBe('赠品')
    expect(formatReturnType('1')).toBe('退货退款')
    expect(formatDeliveryMode('self')).toBe('self')
    expect(formatShipmentLineType('WAIT_STOCK')).toBe('WAIT_STOCK')
    expect(formatOrderType('new_type')).toBe('订单类型未配置（new_type）')
    expect(statusLabel([{ label: '已完成', value: 'finished' }], 'future')).toBe('状态未配置（future）')
  })

  it('将订单详情中的状态、分类和方式转换成中文', () => {
    expect(formatCommonStatus('ACTIVE')).toBe('启用')
    expect(formatCustomerType('dealer')).toBe('dealer')
    expect(formatSettlementMethod('forward')).toBe('现付')
    expect(formatPaymentMethod('wechat')).toBe('微信支付')
    expect(formatPaymentMethod('Offline')).toBe('转账支付')
    expect(formatPaymentMethod('TPPAY_UNIFIED_WX_MINIAPP')).toBe('微信支付（通企付）')
    expect(formatBusinessType('13')).toBe('订单收款')
    expect(formatFinancialBusinessType('5', 'PAYMENT')).toBe('预存款扣款')
    expect(formatFinancialBusinessType('13', 'RECEIPT')).toBe('订单收款')
    expect(formatInvoiceType('P')).toBe('普通发票')
    expect(formatShipmentType('10')).toBe('销售出库')
    expect(formatInboundType('1')).toBe('采购入库')
    expect(formatSplitType(null, null)).toBe('-')
    expect(formatPayloadType('ORDER')).toBe('订单')
  })
})
