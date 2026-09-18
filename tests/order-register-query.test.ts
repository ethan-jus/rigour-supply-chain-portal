import { describe, expect, it } from 'vitest'
import {
  dateRangeParams,
  empty,
  hasUnpaidValue,
  orderRegisterCommonParams,
  orderRegisterDateParams,
} from '@/utils/order-register-query'

describe('订单注册查询参数', () => {
  it('下单时间范围是上海时区左闭右开，结束日包含全天', () => {
    const result = orderRegisterDateParams(['2026-09-01', '2026-09-10'])
    expect(result.orderDateFrom).toBe('2026-08-31T16:00:00.000Z')
    expect(result.orderDateTo).toBe('2026-09-10T16:00:00.000Z')
  })

  it('自定义日期键同样取次日零点作为不包含边界', () => {
    const result = dateRangeParams(['2026-09-01', '2026-09-01'], 'paymentTimeFrom', 'paymentTimeTo')
    expect(result.paymentTimeFrom).toBe('2026-08-31T16:00:00.000Z')
    expect(result.paymentTimeTo).toBe('2026-09-01T16:00:00.000Z')
  })

  it('结束日早于开始日抛错，空范围返回空对象', () => {
    expect(() => orderRegisterDateParams(['2026-09-10', '2026-09-01'])).toThrow(
      '下单时间结束日不能早于开始日',
    )
    expect(orderRegisterDateParams(null)).toEqual({})
    expect(orderRegisterDateParams(['', ''])).toEqual({})
  })

  it('空条件被剔除，hasUnpaid 只在明确选择时返回布尔', () => {
    expect(orderRegisterCommonParams({ a: '', b: null, c: undefined, d: 1 })).toEqual({ d: 1 })
    expect(hasUnpaidValue('true')).toBe(true)
    expect(hasUnpaidValue('false')).toBe(false)
    expect(hasUnpaidValue('')).toBeUndefined()
    expect(empty('  订单  ')).toBe('订单')
  })
})
