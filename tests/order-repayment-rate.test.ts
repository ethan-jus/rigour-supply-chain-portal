import { describe, expect, it } from 'vitest'
import { repaymentRateText } from '@/utils/order-register-status'

describe('回款率', () => {
  it.each([
    [120, 350, '34.29%'], [741, 741, '100.00%'], [0, 100, '0.00%'],
    [120, 100, '120.00%'], [0, 0, '-'], [10, 0, '-'],
    [undefined, 100, '-'], [10, null, '-'],
  ])('回款 %s / 订单 %s = %s', (received, payable, expected) => {
    expect(repaymentRateText(received, payable)).toBe(expected)
  })
})
