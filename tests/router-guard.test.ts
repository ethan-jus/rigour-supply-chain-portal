import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import { useNavigationStore } from '@/stores/navigation'
import { useSupplyAuthorizationStore } from '@/stores/supply-authorization'
import { constantRoutes, notFoundRoute } from '@/router/routes'
import { setupPermissionGuard } from '@/router/permissionGuard'
import type { NavigationNode } from '@/types/management'
import { registerCustomRoutes } from '@/utils/dynamic-pages'

function page(path = '/supply-chain/settings/users'): NavigationNode {
  return { id: path, parentId: null, code: 'PAGE', type: 'PAGE', displayName: '用户管理',
    permissionCode: 'supply:user:read', routeKey: 'supply.settings.users',
    routePath: path, iconKey: null, sortOrder: 1, visible: true, keepAlive: false, children: [] }
}
function router() {
  const stub = (route: RouteRecordRaw): RouteRecordRaw => ({
    ...route, component: { template: '<div />' }, children: route.children?.map(stub),
  } as RouteRecordRaw)
  const result = createRouter({ history: createMemoryHistory(), routes: [...constantRoutes, notFoundRoute].map(stub) })
  setupPermissionGuard(result)
  return result
}
function authenticated(permissions: string[] = ['supply:user:read']) {
  const auth = useAuthStore()
  auth.user = { id: 'user', principalScope: 'TENANT', username: 'sales', displayName: '张三',
    roles: ['SALES'], permissions: [], tenantId: 'tenant-a', tenantName: '企业 A' }
  auth.isAuthenticated = true
  vi.spyOn(auth, 'synchronizeTokenState').mockImplementation(() => {})
  const access = useSupplyAuthorizationStore()
  access.context = { initialized: true, canInitialize: false, mode: 'ACTIVE', version: 1, permissions }
  vi.spyOn(access, 'refresh').mockImplementation(async () => access.context!)
  const navigation = useNavigationStore()
  navigation.navigationByApplication.SUPPLY_CHAIN = [page()]
  navigation.loadedApplications.push('SUPPLY_CHAIN')
  return { auth, access, navigation }
}
beforeEach(() => { setActivePinia(createPinia()); sessionStorage.clear() })
afterEach(() => vi.restoreAllMocks())

describe('SCDP 单产品入口与权限', () => {
  it('未登录访问首页显示登录页，不携带旧跳转目标', async () => {
    const r = router()
    await r.push('/')
    expect(r.currentRoute.value.path).toBe('/login')
    expect(r.currentRoute.value.query.redirect).toBeUndefined()
  })
  it('未登录访问业务页面也统一进入登录页', async () => {
    const r = router()
    await r.push('/supply-chain/settings/users?keyword=zhang')
    expect(r.currentRoute.value.path).toBe('/login')
    expect(r.currentRoute.value.query.redirect).toBeUndefined()
  })
  it('有效成员无需应用目录即可进入授权页面', async () => {
    const { access } = authenticated()
    const r = router()
    await r.push('/supply-chain/settings/users')
    expect(r.currentRoute.value.path).toBe('/supply-chain/settings/users')
    expect(access.refresh).toHaveBeenCalled()
  })
  it('首页无授权时进入第一个可访问页面', async () => {
    authenticated()
    const r = router()
    await r.push('/supply-chain')
    expect(r.currentRoute.value.path).toBe('/supply-chain/settings/users')
  })
  it('新租户管理员进入初始化页面', async () => {
    const { access, navigation } = authenticated([])
    access.context = { initialized: false, canInitialize: true, mode: 'PREPARING', version: 0, permissions: [] }
    navigation.navigationByApplication.SUPPLY_CHAIN = [page('/supply-chain/settings')]
    const r = router()
    await r.push('/')
    expect(r.currentRoute.value.path).toBe('/supply-chain/settings')
  })
  it('导航不能替代功能授权，也不接受旧超级管理员通配符', async () => {
    const { auth } = authenticated([])
    auth.user!.permissions = ['*:*:*']
    auth.user!.roles = ['TENANT_SUPER_ADMIN']
    const r = router()
    await r.push('/supply-chain/settings/users')
    expect(r.currentRoute.value.path).toBe('/403')
  })
  it('直接访问未授权菜单仍拒绝', async () => {
    authenticated(['supply:role:read'])
    const r = router()
    await r.push('/supply-chain/settings/roles')
    expect(r.currentRoute.value.path).toBe('/403')
  })
  it.each(['/apps', '/platform-admin', '/system-admin/users', '/sales-workbench'])('已撤销入口 %s 返回 404', async path => {
    authenticated()
    const r = router()
    await r.push(path)
    expect(r.currentRoute.value.name).toBe('NotFound')
  })
  it.each([['IAM_TOKEN_INVALID', '/login'], ['IAM_FORBIDDEN', '/403'], ['UNAVAILABLE', '/service-unavailable']])(
    '权限服务返回 %s 时进入 %s', async (code, target) => {
      const { access, auth } = authenticated()
      vi.mocked(access.refresh).mockRejectedValue({ code })
      const r = router()
      await r.push('/supply-chain/settings/users')
      expect(r.currentRoute.value.path).toBe(target)
      expect(auth.isAuthenticated).toBe(code !== 'IAM_TOKEN_INVALID')
    })
  it('菜单校验错误保持拒绝访问，不清理有效会话', async () => {
    const { navigation, auth } = authenticated()
    navigation.reset()
    vi.spyOn(navigation, 'fetchNavigation').mockRejectedValue(new Error('unknown routeKey'))
    const r = router()
    await r.push('/supply-chain')
    expect(r.currentRoute.value.path).toBe('/service-unavailable')
    expect(r.currentRoute.value.query.reason).toBe('navigation-unavailable')
    expect(auth.isAuthenticated).toBe(true)
  })
  it('刷新落在后台自定义页面深链时先加载菜单，再按路径重新解析路由', async () => {
    const { navigation } = authenticated()
    navigation.reset()
    const customPage: NavigationNode = {
      id: 'custom-1',
      parentId: null,
      code: 'CUSTOM.1',
      type: 'PAGE',
      displayName: '自定义报表',
      permissionCode: null,
      routeKey: 'tenant.custom.page.1',
      routePath: '/supply-chain/reports/custom-report',
      componentPath: 'supply-chain/settings/ParameterView.vue',
      iconKey: null,
      sortOrder: 1,
      visible: true,
      keepAlive: false,
      children: [],
    }
    const r = router()
    vi.spyOn(navigation, 'fetchNavigation').mockImplementation(async (applicationCode: string) => {
      registerCustomRoutes(r, [customPage])
      navigation.navigationByApplication[applicationCode] = [customPage]
      navigation.loadedApplications.push(applicationCode)
      return [customPage]
    })
    await r.push('/supply-chain/reports/custom-report')
    expect(r.currentRoute.value.path).toBe('/supply-chain/reports/custom-report')
    expect(r.currentRoute.value.name).toBe('CustomPagecustom1')
    expect(navigation.fetchNavigation).toHaveBeenCalled()
  })
  it('菜单里不存在的自定义页面地址保持 404', async () => {
    authenticated()
    const r = router()
    await r.push('/supply-chain/reports/missing-page')
    expect(r.currentRoute.value.name).toBe('NotFound')
  })
})
