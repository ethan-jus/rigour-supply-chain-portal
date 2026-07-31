import { describe, expect, it } from 'vitest'
import { validateNavigation } from '@/utils/route-registry'
import type { NavigationNode } from '@/types/management'

function node(routeKey: string, routePath: string | null): NavigationNode {
  return {
    id: 'navigation-id', parentId: null, code: 'NAVIGATION.CODE', type: 'PAGE',
    displayName: '导航', permissionCode: null, routeKey, routePath, iconKey: null,
    sortOrder: 10, visible: true, keepAlive: false, children: [],
  }
}

describe('数据库导航注册表', () => {
  it('接受已编译且路径一致的routeKey', () => {
    expect(validateNavigation([node('system.user.list', '/system-admin/users')]))
      .toHaveLength(1)
  })

  it('对未注册routeKey失败关闭', () => {
    expect(() => validateNavigation([node('system.script.injected', '/system-admin/users')]))
      .toThrow('未注册或路径不一致')
  })

  it('对routeKey与数据库路径不一致失败关闭', () => {
    expect(() => validateNavigation([node('system.user.list', '/platform-admin/tenants')]))
      .toThrow('未注册或路径不一致')
  })
})
