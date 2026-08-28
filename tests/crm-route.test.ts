import { describe, expect, it } from 'vitest'
import { constantRoutes } from '@/router/routes'
import CrmShippingAddressView from '@/views/supply-chain/crm/CrmShippingAddressView.vue'

describe('CRM 前端路由', () => {
  it('CRM 首页和已接入客户页面都要求客户读取权限', () => {
    const supplyRoute = constantRoutes.find((route) => route.path === '/supply-chain')
    const crmHome = supplyRoute?.children?.find((route) => route.path === 'crm')
    const crmPages = [
      'crm/customers/profiles',
      'crm/customers/shipping-addresses',
      'crm/customers/levels-tags',
      'crm/customers/areas',
    ].map((path) => supplyRoute?.children?.find((route) => route.path === path))

    expect(crmHome?.meta?.permission).toBe('crm:customer:read')
    expect(crmPages.map((route) => route?.meta?.routeKey)).toEqual([
      'supply.crm.customers.profiles',
      'supply.crm.customers.shipping-addresses',
      'supply.crm.customers.levels-tags',
      'supply.crm.customers.areas',
    ])
    expect(crmPages.every((route) => route?.meta?.permission === 'crm:customer:read')).toBe(true)
    expect(crmPages.every((route) => typeof route?.component === 'function')).toBe(true)
  })

  it('客户地址入口加载地址簿业务页，不落到通用占位页', async () => {
    const supplyRoute = constantRoutes.find((route) => route.path === '/supply-chain')
    const shippingAddressRoute = supplyRoute?.children?.find((route) =>
      route.meta?.routeKey === 'supply.crm.customers.shipping-addresses')

    expect(shippingAddressRoute?.path).toBe('crm/customers/shipping-addresses')
    expect(shippingAddressRoute?.meta?.title).toBe('客户地址')

    const componentModule = await (shippingAddressRoute?.component as () => Promise<{ default: unknown }>)()
    expect(componentModule.default).toBe(CrmShippingAddressView)
  })
})
