import { describe, expect, it } from 'vitest'
import { constantRoutes } from '@/router/routes'

describe('集成工作台路由元数据', () => {
  const supplyRoot = constantRoutes.find((route) => route.path === '/supply-chain')

  it('只编译订货宝同步中心单入口', () => {
    const route = supplyRoot?.children?.find((item) => item.path === 'integration')
    const paths = new Set(supplyRoot?.children?.map((item) => item.path) || [])

    expect(route?.meta?.title).toBe('订货宝同步中心')
    expect(route?.meta?.routeKey).toBe('supply.integration.overview')
    expect(paths.has('integration/raw-data')).toBe(false)
    expect(paths.has('integration/retries-dead-letters')).toBe(false)
    expect(paths.has('integration/connections')).toBe(false)
    expect(paths.has('integration/field-mappings')).toBe(false)
  })
})
