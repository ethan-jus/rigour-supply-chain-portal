import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createRouter, createWebHashHistory, type Router } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { usePermissionStore } from '@/stores/permission'
import { useApplicationStore } from '@/stores/application'
import { useNavigationStore } from '@/stores/navigation'
import { constantRoutes, asyncRoutes, notFoundRoute } from '@/router/routes'
import { setupPermissionGuard } from '@/router/permissionGuard'
import { filterAsyncRoutes } from '@/utils/route-filter'

function createTestRouter(): Router {
  const router = createRouter({
    history: createWebHashHistory(),
    routes: [...constantRoutes, ...asyncRoutes, notFoundRoute],
  })
  setupPermissionGuard(router)
  return router
}

describe('路由守卫：未登录', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
  })

  it('未登录访问需认证页面应该跳转 /login', async () => {
    const router = createTestRouter()
    router.push('/dashboard')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('未登录访问 /login 应该直接放行', async () => {
    const router = createTestRouter()
    router.push('/login')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('Login')
  })
})

describe('路由守卫：无权限跳转 403', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('普通用户访问需要权限的页面应该跳转 /403', async () => {
    const authStore = useAuthStore()
    authStore.user = {
      id: 'u002', principalScope: 'TENANT', username: 'viewer', displayName: '访客',
      roles: ['viewer'], permissions: ['dashboard:view'], tenantId: 'demo', tenantName: '测试租户',
    }
    ;(authStore as unknown as Record<string, boolean>).isAuthenticated = true

    const router = createTestRouter()
    router.push('/erp/sku')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/403')
  })

  it('有权限的用户访问对应页面应该放行', async () => {
    const authStore = useAuthStore()
    authStore.user = {
      id: 'u003', principalScope: 'TENANT', username: 'operator', displayName: '操作员',
      roles: ['operator'], permissions: ['erp:sku:list', 'dashboard:view'], tenantId: 'demo', tenantName: '测试租户',
    }
    ;(authStore as unknown as Record<string, boolean>).isAuthenticated = true

    const permissionStore = usePermissionStore()
    permissionStore.initRoutes(authStore.user.permissions)

    const router = createTestRouter()
    router.push('/erp/sku')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/erp/sku')
  })
})

describe('路由守卫：应用许可', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  function authenticatedPlatformUser() {
    const authStore = useAuthStore()
    authStore.user = {
      id: 'u-platform', principalScope: 'PLATFORM', username: 'admin', displayName: '平台管理员',
      roles: ['SUPER_ADMIN'], permissions: ['*:*:*'], tenantId: null, tenantName: null,
    }
    ;(authStore as unknown as Record<string, boolean>).isAuthenticated = true
  }

  it('只有IAM返回PLATFORM_ADMIN卡片时才允许进入系统管理', async () => {
    authenticatedPlatformUser()
    const applicationStore = useApplicationStore()
    applicationStore.applications = [{
      id: 'app-1', code: 'PLATFORM_ADMIN', name: '平台管理中心', iconKey: null,
      launchMode: 'INTERNAL_ROUTE', targetUri: '/platform-admin', sortOrder: 10,
    }]
    applicationStore.loaded = true
    const navigationStore = useNavigationStore()
    navigationStore.navigationByApplication.PLATFORM_ADMIN = [{
      id: 'nav-1', parentId: null, code: 'PLATFORM_ADMIN.PAGE.DASHBOARD', type: 'PAGE',
      displayName: '平台管理首页', permissionCode: null, routeKey: 'platform.dashboard',
      routePath: '/platform-admin', iconKey: null, sortOrder: 10, visible: true, keepAlive: false, children: [],
    }]
    navigationStore.loadedApplications.push('PLATFORM_ADMIN')
    const router = createTestRouter()
    router.push('/platform-admin')
    await router.isReady()
    expect(router.currentRoute.value.name).toBe('PlatformAdminDashboard')
  })

  it('缺少应用许可时拒绝直接输入系统地址', async () => {
    authenticatedPlatformUser()
    const applicationStore = useApplicationStore()
    applicationStore.applications = []
    applicationStore.loaded = true
    const router = createTestRouter()
    router.push('/platform-admin')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/403')
  })

  it('菜单接口异常时返回应用门户而不是伪装成403', async () => {
    authenticatedPlatformUser()
    const applicationStore = useApplicationStore()
    applicationStore.applications = [{
      id: 'app-1', code: 'PLATFORM_ADMIN', name: '平台管理中心', iconKey: null,
      launchMode: 'INTERNAL_ROUTE', targetUri: '/platform-admin', sortOrder: 10,
    }]
    applicationStore.loaded = true
    const navigationStore = useNavigationStore()
    navigationStore.fetchNavigation = vi.fn().mockRejectedValue({ code: 'INTERNAL_ERROR' })

    const router = createTestRouter()
    router.push('/platform-admin')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/apps')
    expect(router.currentRoute.value.query.launchError).toBe('navigation-unavailable')
  })
})

describe('filterAsyncRoutes：路由过滤', () => {
  it('超级管理员应该看到全部模块路由', () => {
    const result = filterAsyncRoutes(asyncRoutes, ['*:*:*'])
    expect(result.length).toBe(10)
    for (const route of result) {
      if (route.children) expect(route.children.length).toBeGreaterThan(0)
    }
  })

  it('仅 dashboard 权限的用户只看到通用工作台', () => {
    const result = filterAsyncRoutes(asyncRoutes, ['dashboard:view'])
    const routePaths = result.map((r) => r.path)
    // 工作台是所有已认证用户的通用入口。
    expect(routePaths).toContain('/')
    expect(routePaths).not.toContain('/hq')
    expect(routePaths).not.toContain('/erp')
  })

  it('有限权限用户只看到授权的模块和子路由', () => {
    const result = filterAsyncRoutes(asyncRoutes, [
      'erp:sku:list', 'erp:warehouse:list', 'order:order:list',
    ])
    const routePaths = result.map((r) => r.path)
    expect(routePaths).toContain('/')
    expect(routePaths).not.toContain('/hq')
    expect(routePaths).toContain('/erp')
    expect(routePaths).toContain('/order')

    const erpRoute = result.find((r) => r.path === '/erp')
    const erpChildPaths = erpRoute?.children?.map((c) => c.path) || []
    expect(erpChildPaths).toContain('sku')
    expect(erpChildPaths).toContain('warehouse')
    expect(erpChildPaths).not.toContain('purchase')
    expect(erpChildPaths).not.toContain('supplier')
  })

  it('空权限数组只保留无 permission 要求的子路由', () => {
    const result = filterAsyncRoutes(asyncRoutes, [])
    const routePaths = result.map((r) => r.path)
    // 只有通用工作台不要求模块权限。
    expect(routePaths).toContain('/')
    expect(routePaths).not.toContain('/hq')
    expect(routePaths).not.toContain('/erp')
    // 有 permission 要求的模块被过滤
    expect(routePaths).not.toContain('/order')
    expect(routePaths).not.toContain('/sales')
    expect(routePaths).not.toContain('/bi')
  })
})

describe('permissionStore：initRoutes / reset', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initRoutes 应该填充 accessibleRoutes', () => {
    const store = usePermissionStore()
    expect(store.accessibleRoutes.length).toBe(0)
    store.initRoutes(['*:*:*'])
    expect(store.accessibleRoutes.length).toBe(10)
    expect(store.loaded).toBe(true)
  })

  it('reset 应该清空 accessibleRoutes', () => {
    const store = usePermissionStore()
    store.initRoutes(['*:*:*'])
    store.reset()
    expect(store.accessibleRoutes.length).toBe(0)
    expect(store.loaded).toBe(false)
  })
})

describe('authStore 生命周期触发权限路由', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
  })

  it('clearLocalSession 应该清空 permissionStore', () => {
    const authStore = useAuthStore()
    const permStore = usePermissionStore()
    authStore.user = {
      id: 'u001', principalScope: 'TENANT', username: 'admin', displayName: '管理员',
      roles: ['super_admin'], permissions: ['*:*:*'], tenantId: 'demo', tenantName: '测试租户',
    }
    permStore.initRoutes(['*:*:*'])
    expect(permStore.accessibleRoutes.length).toBe(10)

    authStore.clearLocalSession()
    expect(permStore.accessibleRoutes.length).toBe(0)
    expect(authStore.isAuthenticated).toBe(false)
    expect(authStore.user).toBeNull()
  })
})

describe('authStore 权限判定', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('超级管理员拥有所有权限', () => {
    const authStore = useAuthStore()
    authStore.user = {
      id: 'u001', principalScope: 'TENANT', username: 'admin', displayName: '管理员',
      roles: ['super_admin'], permissions: ['*:*:*'], tenantId: 'demo', tenantName: '测试租户',
    }
    expect(authStore.hasPermission('any:random:permission')).toBe(true)
    expect(authStore.hasRole('super_admin')).toBe(true)
  })

  it('普通用户只有指定权限', () => {
    const authStore = useAuthStore()
    authStore.user = {
      id: 'u003', principalScope: 'TENANT', username: 'operator', displayName: '操作员',
      roles: ['operator'], permissions: ['erp:sku:list', 'order:order:list'], tenantId: 'demo', tenantName: '测试租户',
    }
    expect(authStore.hasPermission('erp:sku:list')).toBe(true)
    expect(authStore.hasPermission('erp:warehouse:list')).toBe(false)
    expect(authStore.hasRole('operator')).toBe(true)
    expect(authStore.hasRole('super_admin')).toBe(false)
  })

  it('未登录返回 false', () => {
    const authStore = useAuthStore()
    expect(authStore.hasPermission('anything')).toBe(false)
  })
})
