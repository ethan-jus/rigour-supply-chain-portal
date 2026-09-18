import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { constantRoutes, notFoundRoute } from '@/router/routes'

const expectedRoutes = [
  ['order/fulfillments', 'SupplyOrderFulfillments', 'fulfillments'],
  ['order/sales-orders', 'SupplyOrderSalesOrders', 'sales-orders'],
  ['order/shipments', 'SupplyOrderShipments', 'shipments'],
  ['order/sales-payments', 'SupplyOrderSalesPayments', 'sales-payments'],
  ['order/fund-documents', 'SupplyOrderFundDocuments', 'fund-documents'],
  ['order/sales-refunds', 'SupplyOrderSalesRefunds', 'sales-refunds'],
  ['order/lines', 'SupplyOrderLines', 'order-lines'],
  ['order/statistics', 'SupplyOrderStatistics', 'order-statistics'],
] as const

describe('订单中心前端路由', () => {
  it('注册订单域已编译的八个业务页面，订单明细与统计页可解析', () => {
    const supplyRoute = constantRoutes.find(route => route.path === '/supply-chain')
    const orderRoutes = supplyRoute?.children?.filter(route => String(route.path).startsWith('order/')) || []

    expect(orderRoutes.map(route => [route.path, route.name, route.meta?.pageKey])).toEqual(expectedRoutes)
    expect(orderRoutes.every(route => route.meta?.applicationCode === 'SUPPLY_CHAIN')).toBe(true)
    expect(orderRoutes.every(route => route.meta?.requiresAuth === true)).toBe(true)
    expect(orderRoutes.every(route => typeof route.component === 'function')).toBe(true)
  })

  it('八个当前路径可解析，V54删除的旧订货宝订单路径进入404', () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [...constantRoutes, notFoundRoute],
    })

    for (const [path, name] of expectedRoutes) {
      expect(router.resolve(`/supply-chain/${path}`).name).toBe(name)
    }
    expect(router.resolve('/supply-chain/order/orders').name).toBe('NotFound')
  })
})
