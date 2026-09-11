import { afterEach, describe, it, expect, beforeEach, vi } from 'vitest'
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

function markAuthenticated(authStore: ReturnType<typeof useAuthStore>): void {
  ;(authStore as unknown as Record<string, boolean>).isAuthenticated = true
  vi.spyOn(authStore, 'synchronizeTokenState').mockImplementation(() => {})
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('路由守卫：未登录', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    sessionStorage.clear()
  })

  it('未登录访问需认证页面应该跳转 /login', async () => {
    const router = createTestRouter()
    router.push('/platform-admin')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('已登录用户的内存Token到期时标记续期原因并保留原菜单', async () => {
    const authStore = useAuthStore()
    ;(authStore as unknown as Record<string, boolean>).isAuthenticated = true
    vi.spyOn(authStore, 'synchronizeTokenState').mockImplementation(() => {
      ;(authStore as unknown as Record<string, boolean>).isAuthenticated = false
    })
    const router = createTestRouter()
    router.push('/supply-chain/crm/customers/areas?from=order')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.reason).toBe('session_expired')
    expect(router.currentRoute.value.query.redirect).toBe('/supply-chain/crm/customers/areas?from=order')
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

  it('普通用户访问未授权应用页面应该跳转 /403', async () => {
    const authStore = useAuthStore()
    authStore.user = {
      id: 'u002', principalScope: 'TENANT', username: 'viewer', displayName: '访客',
      roles: ['viewer'], permissions: [], tenantId: 'demo', tenantName: '测试租户',
    }
    markAuthenticated(authStore)
    const applicationStore = useApplicationStore()
    applicationStore.applications = []
    applicationStore.loaded = true
    applicationStore.fetchApplications = vi.fn().mockResolvedValue(undefined)

    const router = createTestRouter()
    router.push('/system-admin/users')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/403')
  })

  it('已授权应用且导航路径存在时访问页面应该放行', async () => {
    const authStore = useAuthStore()
    authStore.user = {
      id: 'u003', principalScope: 'TENANT', username: 'admin', displayName: '管理员',
      roles: ['super_admin'], permissions: ['*:*:*'], tenantId: 'demo', tenantName: '测试租户',
    }
    markAuthenticated(authStore)

    const applicationStore = useApplicationStore()
    applicationStore.applications = [{
      id: 'app-2', code: 'SYSTEM_ADMIN', name: '系统管理', iconKey: null,
      launchMode: 'INTERNAL_ROUTE', targetUri: '/system-admin', sortOrder: 20,
    }]
    applicationStore.loaded = true
    const navigationStore = useNavigationStore()
    navigationStore.navigationByApplication.SYSTEM_ADMIN = [{
      id: 'nav-2', parentId: null, code: 'SYSTEM_ADMIN.PAGE.USER_LIST', type: 'PAGE',
      displayName: '用户管理', permissionCode: 'iam:user:read', routeKey: 'system.user.list',
      routePath: '/system-admin/users', iconKey: null, sortOrder: 30, visible: true, keepAlive: false, children: [],
    }]
    navigationStore.loadedApplications.push('SYSTEM_ADMIN')

    const router = createTestRouter()
    router.push('/system-admin/users')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/system-admin/users')
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
    markAuthenticated(authStore)
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
    applicationStore.fetchApplications = vi.fn().mockResolvedValue(undefined)
    const router = createTestRouter()
    router.push('/platform-admin')
    await router.isReady()
    expect(router.currentRoute.value.path).toBe('/403')
  })

  it('应用目录曾加载为空时会重新请求IAM应用授权', async () => {
    authenticatedPlatformUser()
    const applicationStore = useApplicationStore()
    applicationStore.applications = []
    applicationStore.loaded = true
    applicationStore.fetchApplications = vi.fn().mockImplementation(async () => {
      applicationStore.applications = [{
        id: 'app-1', code: 'PLATFORM_ADMIN', name: '平台管理中心', iconKey: null,
        launchMode: 'INTERNAL_ROUTE', targetUri: '/platform-admin', sortOrder: 10,
      }]
      applicationStore.loaded = true
    })
    const navigationStore = useNavigationStore()
    navigationStore.fetchNavigation = vi.fn().mockImplementation(async (applicationCode: string) => {
      navigationStore.navigationByApplication[applicationCode] = [{
        id: 'nav-1', parentId: null, code: 'PLATFORM_ADMIN.PAGE.DASHBOARD', type: 'PAGE',
        displayName: '平台管理首页', permissionCode: null, routeKey: 'platform.dashboard',
        routePath: '/platform-admin', iconKey: null, sortOrder: 10, visible: true, keepAlive: false, children: [],
      }]
      navigationStore.loadedApplications.push(applicationCode)
    })

    const router = createTestRouter()
    router.push('/platform-admin')
    await router.isReady()

    expect(applicationStore.fetchApplications).toHaveBeenCalledOnce()
    expect(router.currentRoute.value.name).toBe('PlatformAdminDashboard')
  })

  it('菜单接口异常时进入服务不可用页而不是静默回到应用门户', async () => {
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

    expect(router.currentRoute.value.path).toBe('/service-unavailable')
    expect(router.currentRoute.value.query.reason).toBe('navigation-unavailable')
  })

  it('菜单接口明确返回IAM_FORBIDDEN时进入403', async () => {
    authenticatedPlatformUser()
    const applicationStore = useApplicationStore()
    applicationStore.applications = [{
      id: 'app-1', code: 'PLATFORM_ADMIN', name: '平台管理中心', iconKey: null,
      launchMode: 'INTERNAL_ROUTE', targetUri: '/platform-admin', sortOrder: 10,
    }]
    applicationStore.loaded = true
    const navigationStore = useNavigationStore()
    navigationStore.fetchNavigation = vi.fn().mockRejectedValue({
      code: 'IAM_FORBIDDEN', response: { status: 403 },
    })

    const router = createTestRouter()
    router.push('/platform-admin')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/403')
  })

  it('菜单接口返回标准FORBIDDEN HTTP 403时进入403', async () => {
    authenticatedPlatformUser()
    const applicationStore = useApplicationStore()
    applicationStore.applications = [{
      id: 'app-1', code: 'PLATFORM_ADMIN', name: '平台管理中心', iconKey: null,
      launchMode: 'INTERNAL_ROUTE', targetUri: '/platform-admin', sortOrder: 10,
    }]
    applicationStore.loaded = true
    const navigationStore = useNavigationStore()
    navigationStore.fetchNavigation = vi.fn().mockRejectedValue({
      code: 'FORBIDDEN', response: { status: 403 },
    })

    const router = createTestRouter()
    router.push('/platform-admin')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/403')
  })

  it('菜单接口返回通用FORBIDDEN 403时仍进入403', async () => {
    authenticatedPlatformUser()
    const applicationStore = useApplicationStore()
    applicationStore.applications = [{
      id: 'app-1', code: 'PLATFORM_ADMIN', name: '平台管理中心', iconKey: null,
      launchMode: 'INTERNAL_ROUTE', targetUri: '/platform-admin', sortOrder: 10,
    }]
    applicationStore.loaded = true
    const navigationStore = useNavigationStore()
    navigationStore.fetchNavigation = vi.fn().mockRejectedValue({
      code: 'FORBIDDEN', response: { status: 403 },
    })

    const router = createTestRouter()
    router.push('/platform-admin')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/403')
  })

  it('直接访问飞书销售工作台必须具有FEISHU_SALES应用许可', async () => {
    authenticatedPlatformUser()
    const applicationStore = useApplicationStore()
    applicationStore.applications = [{
      id: 'app-sales', code: 'FEISHU_SALES', name: '飞书销售工作台', iconKey: null,
      launchMode: 'FEISHU_DEEPLINK', targetUri: '/sales-workbench', sortOrder: 30,
    }]
    applicationStore.loaded = true

    const router = createTestRouter()
    router.push('/sales-workbench')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/sales-workbench')
  })

  it('缺少FEISHU_SALES应用许可时拒绝直接访问销售工作台', async () => {
    authenticatedPlatformUser()
    const applicationStore = useApplicationStore()
    applicationStore.applications = []
    applicationStore.loaded = true
    applicationStore.fetchApplications = vi.fn().mockResolvedValue(undefined)

    const router = createTestRouter()
    router.push('/sales-workbench')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/403')
  })

  it('恢复用户信息遇到服务异常时不应清除会话或跳转登录', async () => {
    const authStore = useAuthStore()
    markAuthenticated(authStore)
    vi.spyOn(authStore, 'fetchUser').mockRejectedValue({ code: 'NETWORK_ERROR' })

    const router = createTestRouter()
    router.push('/apps')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/service-unavailable')
    expect(authStore.isAuthenticated).toBe(true)
  })

  it('恢复用户信息明确返回IAM_TOKEN_INVALID时清除会话并保留原路径', async () => {
    const authStore = useAuthStore()
    markAuthenticated(authStore)
    vi.spyOn(authStore, 'fetchUser').mockRejectedValue({
      code: 'IAM_TOKEN_INVALID', response: { status: 401 },
    })

    const router = createTestRouter()
    router.push('/apps?tab=mine')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/login')
    expect(router.currentRoute.value.query.redirect).toBe('/apps?tab=mine')
    expect(router.currentRoute.value.query.reason).toBe('session_expired')
    expect(authStore.isAuthenticated).toBe(false)
  })

  it('恢复用户信息返回TRUSTED_CONTEXT_INVALID 401时保留会话并进入503', async () => {
    const authStore = useAuthStore()
    markAuthenticated(authStore)
    vi.spyOn(authStore, 'fetchUser').mockRejectedValue({
      code: 'TRUSTED_CONTEXT_INVALID', response: { status: 401 },
    })

    const router = createTestRouter()
    router.push('/apps?tab=mine')
    await router.isReady()

    expect(router.currentRoute.value.path).toBe('/service-unavailable')
    expect(router.currentRoute.value.query.redirect).toBe('/apps?tab=mine')
    expect(authStore.isAuthenticated).toBe(true)
  })
})

describe('filterAsyncRoutes：路由过滤', () => {
  it('超级管理员可以看到统一门户入口', () => {
    const result = filterAsyncRoutes(asyncRoutes, ['*:*:*'])
    expect(result.length).toBe(1)
    expect(result[0]?.path).toBe('/apps')
  })

  it('门户入口不依赖业务权限', () => {
    const result = filterAsyncRoutes(asyncRoutes, ['dashboard:view'])
    const routePaths = result.map((r) => r.path)
    expect(routePaths).toContain('/apps')
  })

  it('业务模块菜单不再由前端权限列表决定', () => {
    const result = filterAsyncRoutes(asyncRoutes, [
      'erp:sku:list', 'erp:warehouse:list', 'order:order:list',
    ])
    const routePaths = result.map((r) => r.path)
    expect(routePaths).toEqual(['/apps'])
  })

  it('空权限数组仍保留统一门户入口', () => {
    const result = filterAsyncRoutes(asyncRoutes, [])
    const routePaths = result.map((r) => r.path)
    expect(routePaths).toEqual(['/apps'])
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
    expect(store.accessibleRoutes.length).toBe(1)
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
    expect(permStore.accessibleRoutes.length).toBe(1)

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
