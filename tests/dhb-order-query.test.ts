import { describe, expect, it } from 'vitest'
import { buildDhbOrderQuery, DHB_PENDING_ORDER_STATUS } from '@/utils/dhb-order-query'

describe('订单中心订货宝查询参数', () => {
  const base = { begin: 0, step: 20 }

  it('待处理订单按来源订单状态查询，并排除来源异常', () => {
    expect(buildDhbOrderQuery({ ...base, pageKey: 'order-pending' })).toEqual({
      ...base,
      apiStatus: 'all',
      exceptionStatus: 'F',
      order_status_val: DHB_PENDING_ORDER_STATUS,
    })
  })

  it('异常订单使用 order-center 的来源异常参数，不隐藏异常菜单', () => {
    expect(buildDhbOrderQuery({
      ...base,
      pageKey: 'order-exceptions',
      orderStatus: 'pending',
      payStatus: 'oblig',
    })).toEqual({
      ...base,
      apiStatus: 'all',
      exceptionStatus: 'T',
    })
  })

  it('全部订单显式传 all，避免命中订货宝默认未下载条件', () => {
    expect(buildDhbOrderQuery({ ...base, pageKey: 'order-all' })).toEqual({
      ...base,
      apiStatus: 'all',
      exceptionStatus: 'all',
    })
  })

  it('保留订单中心支持的时间和收款状态参数', () => {
    expect(buildDhbOrderQuery({
      ...base,
      pageKey: 'order-list',
      orderStatus: 'finished',
      startDate: '2026-08-01',
      endDate: '2026-08-07',
      payStatus: 'paided',
      apiStatus: 'T',
    })).toMatchObject({
      order_status_val: 'finished',
      starttime: '2026-08-01 00:00:00',
      endtime: '2026-08-07 23:59:59',
      payStatus: 'paided',
      apiStatus: 'T',
      exceptionStatus: 'F',
    })
  })

  it('保留并清理订单关键词，供订单中心匹配订单和收货信息', () => {
    expect(buildDhbOrderQuery({
      ...base,
      pageKey: 'order-list',
      keyword: '  ORD-1  ',
    })).toMatchObject({ keyword: 'ORD-1' })
    expect(buildDhbOrderQuery({
      ...base,
      pageKey: 'order-list',
      keyword: '   ',
    })).not.toHaveProperty('keyword')
  })
})
