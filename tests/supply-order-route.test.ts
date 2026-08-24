import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { asyncRoutes, constantRoutes, notFoundRoute } from '@/router/routes'

const expectedRoutes = [
  ['order/sales-orders', 'SupplyOrderSalesOrders', 'sales-orders'],
  ['order/shipments', 'SupplyOrderShipments', 'shipments'],
  ['order/sales-payments', 'SupplyOrderSalesPayments', 'sales-payments'],
  ['order/fund-documents', 'SupplyOrderFundDocuments', 'fund-documents'],
  ['order/sales-refunds', 'SupplyOrderSalesRefunds', 'sales-refunds'],
] as const

describe('订单中心前端路由', () => {
  it('只注册IAM当前发布的五个订单业务页面', () => {
    const supplyRoute = constantRoutes.find(route => route.path === '/supply-chain')
    const orderRoutes = supplyRoute?.children?.filter(route => String(route.path).startsWith('order/')) || []

    expect(orderRoutes.map(route => [route.path, route.name, route.meta?.pageKey])).toEqual(expectedRoutes)
    expect(orderRoutes.every(route => route.meta?.applicationCode === 'SUPPLY_CHAIN')).toBe(true)
    expect(orderRoutes.every(route => route.meta?.requiresAuth === true)).toBe(true)
    expect(orderRoutes.every(route => typeof route.component === 'function')).toBe(true)
  })

  it('五个当前路径可解析，V54删除的旧订货宝订单路径进入404', () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [...constantRoutes, ...asyncRoutes, notFoundRoute],
    })

    for (const [path, name] of expectedRoutes) {
      expect(router.resolve(`/supply-chain/${path}`).name).toBe(name)
    }
    expect(router.resolve('/supply-chain/order/orders').name).toBe('NotFound')
  })
})
