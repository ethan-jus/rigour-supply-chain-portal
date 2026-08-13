import { describe, expect, it } from 'vitest'
import { constantRoutes } from '@/router/routes'

describe('CRM 前端路由', () => {
  it('CRM 首页和四个已接入页面都要求客户读取权限', () => {
    const supplyRoute = constantRoutes.find((route) => route.path === '/supply-chain')
    const crmHome = supplyRoute?.children?.find((route) => route.path === 'crm')
    const crmPages = [
      'crm/customers/profiles',
      'crm/customers/shipping-addresses',
      'crm/customers/levels-tags',
      'crm/customers/areas',
      'crm/assignments/external-staff',
    ].map((path) => supplyRoute?.children?.find((route) => route.path === path))

    expect(crmHome?.meta?.permission).toBe('crm:customer:read')
    expect(crmPages.map((route) => route?.meta?.routeKey)).toEqual([
      'supply.crm.customers.profiles',
      'supply.crm.customers.shipping-addresses',
      'supply.crm.customers.levels-tags',
      'supply.crm.customers.areas',
      'supply.crm.assignments.external-staff',
    ])
    expect(crmPages.every((route) => route?.meta?.permission === 'crm:customer:read')).toBe(true)
    expect(crmPages.every((route) => typeof route?.component === 'function')).toBe(true)
  })
})
