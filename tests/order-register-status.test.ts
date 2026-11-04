import { beforeEach, describe, expect, it } from 'vitest'
import {
  moneyText,
  numberText,
  orderPaymentStatusLabel,
  orderPaymentStatusTag,
  orderStatusLabel,
  orderLifecycleOptions,
  orderStatusTag,
  paymentRecordStatusLabel,
  paymentConfirmationLabel,
  paymentRecordStatusTag,
  sourceSystemLabel,
  totalsText,
} from '@/utils/order-register-status'

import { clearBusinessDictionariesForTest, seedBusinessDictionaryForTest } from '@/utils/business-dictionary'
describe('订单注册状态文案', () => {
  beforeEach(() => {
    clearBusinessDictionariesForTest()
    for (const [code, values] of Object.entries({
      SALES_ORDER_STATUS: { DRAFT: '草稿', SUBMITTED: '进行中', COMPLETED: '已完成', CANCELLED: '已取消', DELETED: '已删除' },
      ORDER_COLLECTION_STATUS: { UNPAID: '未收款', PARTIAL_PAID: '部分收款', PAID: '已结清', NOT_REQUIRED: '无需收款' },
      PAYMENT_RECEIPT_STATUS: { PENDING: '待收款', RECEIVED: '已收款', CANCELLED: '已作废' },
      PAYMENT_CONFIRMATION_STATUS: { UNCONFIRMED: '待确认', CONFIRMED: '已确认' },
    })) seedBusinessDictionaryForTest('ORDER', code, Object.entries(values).map(([code,name]) => ({code,name})))
  })
  it('订单状态命中映射，未知值回退原值', () => {
    expect(orderStatusLabel('DRAFT')).toBe('草稿')
    expect(orderStatusLabel('COMPLETED')).toBe('已完成')
    expect(orderStatusLabel('CANCELLED')).toBe('已取消')
    expect(orderStatusLabel('DELETED')).toBe('已删除')
    expect(orderLifecycleOptions()).toContainEqual({ value: 'DELETED', label: '已删除' })
    expect(orderStatusLabel('SUBMITTED')).toBe('进行中')
    expect(orderStatusLabel('UNKNOWN_CODE')).toBe('UNKNOWN_CODE')
    expect(orderStatusLabel(null)).toBe('-')
  })

  it('历史自动项不进入主状态筛选，合法状态名称与排序仍取租户字典', () => {
    seedBusinessDictionaryForTest('ORDER', 'SALES_ORDER_STATUS', [
      { code: 'COMPLETED', name: '租户已交付' },
      { code: 'AUTO_PAID', name: '已结清' },
      { code: 'AUTO_UNPAID', name: '待回款' },
      { code: 'AUTO_PENDING', name: '未审核' },
      { code: 'AUTO_APPROVED', name: '已审核' },
      { code: 'AUTO_REJECTED', name: '驳回' },
      { code: 'DRAFT', name: '草稿' },
    ])
    expect(orderLifecycleOptions()).toEqual([
      { value: 'COMPLETED', label: '租户已交付' }, { value: 'DRAFT', label: '草稿' },
    ])
    expect(orderStatusLabel('AUTO_PAID')).toBe('已结清')
  })

  it('订单收款状态与标签颜色按口径映射', () => {
    expect(orderPaymentStatusLabel('UNPAID')).toBe('未收款')
    expect(orderPaymentStatusLabel('PARTIAL_PAID')).toBe('部分收款')
    expect(orderPaymentStatusTag('PAID')).toBe('success')
    expect(orderPaymentStatusTag('UNPAID')).toBe('warning')
  })

  it('单笔回款状态与财务确认独立展示', () => {
    expect(paymentRecordStatusLabel('PENDING')).toBe('待收款')
    expect(paymentRecordStatusLabel('RECEIVED')).toBe('已收款')
    expect(paymentRecordStatusLabel('CHECKED')).toBe('已收款')
    expect(paymentConfirmationLabel('CHECKED')).toBe('已确认')
    expect(paymentConfirmationLabel('RECEIVED')).toBe('待确认')
    expect(paymentConfirmationLabel('PENDING')).toBe('-')
    expect(orderPaymentStatusLabel('NOT_REQUIRED')).toBe('无需收款')
    expect(paymentRecordStatusTag('CHECKED')).toBe('success')
    expect(paymentRecordStatusTag('PENDING')).toBe('warning')
  })

  it('来源与金额展示不把 null 当零', () => {
    expect(sourceSystemLabel('DINGHUOBAO')).toBe('订货宝')
    expect(sourceSystemLabel('FEISHU')).toBe('飞书')
    expect(moneyText(1234.5)).toBe('¥1,234.50')
    expect(moneyText(null)).toBe('-')
    expect(numberText(12)).toBe('12')
    expect(totalsText(null)).toBe('未提供')
    expect(orderStatusTag('COMPLETED')).toBe('success')
  })
})
