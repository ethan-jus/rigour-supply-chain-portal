import { describe, expect, it } from 'vitest'
import { constantRoutes } from '@/router/routes'

describe('销售管理路由权限', () => {
  const supplyRoot = constantRoutes.find((route) => route.path === '/supply-chain')

  it.each([
    ['sales', 'sales:dashboard:read'],
    ['sales/visits/plans', 'sales:visit-plan:read'],
    ['sales/visits/reviews', 'sales:visit:review'],
    ['sales/exceptions/reviews', 'sales:visit:review'],
    ['sales/exceptions/location', 'sales:location:sensitive:read'],
  ])('%s 与后端读取权限保持一致', (path, permission) => {
    const route = supplyRoot?.children?.find((item) => item.path === path)

    expect(route?.meta?.permission).toBe(permission)
  })
})
