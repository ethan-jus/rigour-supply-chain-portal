import { describe, expect, it } from 'vitest'
import {
  moneyText,
  numberText,
  orderPaymentStatusLabel,
  orderPaymentStatusTag,
  orderStatusLabel,
  orderStatusTag,
  paymentRecordStatusLabel,
  paymentRecordStatusTag,
  sourceSystemLabel,
  totalsText,
} from '@/utils/order-register-status'

describe('订单注册状态文案', () => {
  it('订单状态命中映射，未知值回退原值', () => {
    expect(orderStatusLabel('PENDING_OUTBOUND')).toBe('待出库')
    expect(orderStatusLabel('PENDING_SHIPPED')).toBe('待发货')
    expect(orderStatusLabel('RETURNED')).toBe('已退货')
    expect(orderStatusLabel('SUBMITTED')).toBe('已提交')
    expect(orderStatusLabel('UNKNOWN_CODE')).toBe('UNKNOWN_CODE')
    expect(orderStatusLabel(null)).toBe('-')
  })

  it('订单收款状态与标签颜色按口径映射', () => {
    expect(orderPaymentStatusLabel('UNPAID')).toBe('待收款')
    expect(orderPaymentStatusLabel('PARTIAL_PAID')).toBe('部分收款')
    expect(orderPaymentStatusTag('PAID')).toBe('success')
    expect(orderPaymentStatusTag('UNPAID')).toBe('danger')
  })

  it('单笔收款状态区分已收款与已核对，且都计入回款', () => {
    expect(paymentRecordStatusLabel('PENDING')).toBe('待收款')
    expect(paymentRecordStatusLabel('CONFIRMED')).toBe('已收款')
    expect(paymentRecordStatusLabel('CHECKED')).toBe('已核对')
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
