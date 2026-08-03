import type { RouteRecordRaw } from 'vue-router'

/**
 * 路由配置
 *
 * 职责：定义全部路由元数据，按权限过滤由 permissionGuard.ts 和 permissionStore 处理。
 * 路由分为三类：
 * - constantRoutes：无需认证（登录、403、404）
 * - asyncRoutes：需要认证的动态路由
 * - notFoundRoute：兜底 404
 *
 * 边界：路由定义不包含业务逻辑；权限判定在 Store 层完成。
 */

/** 静态路由（无需认证即可访问） */
export const constantRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'RootRedirect',
    redirect: '/apps',
    meta: {
      title: '首页',
      hidden: true,
      requiresAuth: false,
    },
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/LoginView.vue'),
    meta: {
      title: '登录',
      hidden: true,
      requiresAuth: false,
    },
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('@/views/error/ForbiddenView.vue'),
    meta: {
      title: '无权限',
      hidden: true,
      requiresAuth: false,
    },
  },
  {
    path: '/service-unavailable',
    name: 'ServiceUnavailable',
    component: () => import('@/views/error/ServiceUnavailableView.vue'),
    meta: {
      title: '服务暂不可用',
      hidden: true,
      requiresAuth: false,
    },
  },
  {
    path: '/platform-admin',
    component: () => import('@/layouts/ConsoleShell.vue'),
    meta: { title: '平台管理中心', hidden: true, requiresAuth: true, applicationCode: 'PLATFORM_ADMIN' },
    children: [
      { path: '', name: 'PlatformAdminDashboard', component: () => import('@/views/admin/dashboard/IndexView.vue'), meta: { title: '平台管理', requiresAuth: true, applicationCode: 'PLATFORM_ADMIN' } },
      { path: 'tenants', name: 'PlatformTenants', component: () => import('@/views/admin/tenants/IndexView.vue'), meta: { title: '租户管理', requiresAuth: true, applicationCode: 'PLATFORM_ADMIN' } },
      { path: 'packages', name: 'PlatformPackages', component: () => import('@/views/admin/packages/IndexView.vue'), meta: { title: '套餐管理', requiresAuth: true, applicationCode: 'PLATFORM_ADMIN' } },
      { path: 'applications', name: 'PlatformApplications', component: () => import('@/views/admin/applications/IndexView.vue'), meta: { title: '应用目录', requiresAuth: true, applicationCode: 'PLATFORM_ADMIN' } },
      { path: 'resources', name: 'PlatformResources', component: () => import('@/views/admin/resources/IndexView.vue'), meta: { title: '菜单与资源', requiresAuth: true, applicationCode: 'PLATFORM_ADMIN' } },
      { path: 'dictionaries', name: 'PlatformDictionaries', component: () => import('@/views/admin/dictionaries/DictionaryManagementPage.vue'), meta: { title: '数据字典', requiresAuth: true, applicationCode: 'PLATFORM_ADMIN', dictionaryScope: 'platform' } },
      { path: 'audit', name: 'PlatformAudit', component: () => import('@/views/admin/audit-logs/IndexView.vue'), meta: { title: '平台审计', requiresAuth: true, applicationCode: 'PLATFORM_ADMIN' } },
    ],
  },
  {
    path: '/system-admin',
    component: () => import('@/layouts/ConsoleShell.vue'),
    meta: { title: '系统管理', hidden: true, requiresAuth: true, applicationCode: 'SYSTEM_ADMIN' },
    children: [
      { path: '', name: 'SystemAdminDashboard', component: () => import('@/views/admin/dashboard/IndexView.vue'), meta: { title: '系统管理', requiresAuth: true, applicationCode: 'SYSTEM_ADMIN' } },
      { path: 'organizations', name: 'SystemOrganizations', component: () => import('@/views/admin/organizations/IndexView.vue'), meta: { title: '组织管理', requiresAuth: true, applicationCode: 'SYSTEM_ADMIN' } },
      { path: 'users', name: 'SystemUsers', component: () => import('@/views/admin/users/IndexView.vue'), meta: { title: '用户管理', requiresAuth: true, applicationCode: 'SYSTEM_ADMIN' } },
      { path: 'roles', name: 'SystemRoles', component: () => import('@/views/admin/roles/IndexView.vue'), meta: { title: '角色与资源授权', requiresAuth: true, applicationCode: 'SYSTEM_ADMIN' } },
      { path: 'data-scopes', name: 'SystemDataScopes', component: () => import('@/views/admin/data-scopes/IndexView.vue'), meta: { title: '数据范围', requiresAuth: true, applicationCode: 'SYSTEM_ADMIN' } },
      { path: 'settings', name: 'SystemSettings', component: () => import('@/views/admin/settings/IndexView.vue'), meta: { title: '系统设置', requiresAuth: true, applicationCode: 'SYSTEM_ADMIN' } },
      { path: 'dictionaries', name: 'SystemDictionaries', component: () => import('@/views/admin/dictionaries/DictionaryManagementPage.vue'), meta: { title: '数据字典', requiresAuth: true, applicationCode: 'SYSTEM_ADMIN', dictionaryScope: 'tenant' } },
      { path: 'audit', name: 'SystemAudit', component: () => import('@/views/admin/audit-logs/IndexView.vue'), meta: { title: '租户审计', requiresAuth: true, applicationCode: 'SYSTEM_ADMIN' } },
    ],
  },
  {
    path: '/supply-chain',
    component: () => import('@/layouts/ConsoleShell.vue'),
    meta: { title: '供应链系统', hidden: true, requiresAuth: true, applicationCode: 'SUPPLY_CHAIN' },
    children: [
      { path: '', name: 'SupplyChainDashboard', component: () => import('@/views/supply-chain/dashboard/IndexView.vue'), meta: { title: '供应链系统', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN' } },
      { path: 'city', name: 'SupplyCity', component: () => import('@/views/supply-chain/city/IndexView.vue'), meta: { title: '城市运营', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN' } },
      { path: 'crm', name: 'SupplyCrm', component: () => import('@/views/supply-chain/crm/IndexView.vue'), meta: { title: 'CRM', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN' } },
      { path: 'order', name: 'SupplyOrder', component: () => import('@/views/supply-chain/order/IndexView.vue'), meta: { title: '订单', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN' } },
      { path: 'sales', name: 'SupplySales', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '销售监管', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN' } },
      { path: 'erp', name: 'SupplyErp', component: () => import('@/views/supply-chain/erp/IndexView.vue'), meta: { title: 'ERP', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN' } },
      { path: 'hr', name: 'SupplyHr', component: () => import('@/views/supply-chain/hr/IndexView.vue'), meta: { title: '人事', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN' } },
      { path: 'channel', name: 'SupplyChannel', component: () => import('@/views/supply-chain/channel/IndexView.vue'), meta: { title: '渠道代理', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN' } },
      { path: 'bi', name: 'SupplyBi', component: () => import('@/views/supply-chain/bi/IndexView.vue'), meta: { title: 'BI', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN' } },
      { path: 'settings', name: 'SupplySettings', component: () => import('@/views/supply-chain/settings/IndexView.vue'), meta: { title: '业务设置', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN' } },
      { path: 'dinghuobao', name: 'SupplyDinghuobaoOverview', component: () => import('@/views/supply-chain/dinghuobao/DinghuobaoPage.vue'), meta: { title: '订货宝同步概览', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'overview' } },
      { path: 'dinghuobao/order-mirror', name: 'SupplyDinghuobaoOrderMirror', component: () => import('@/views/supply-chain/dinghuobao/DinghuobaoPage.vue'), meta: { title: '订单镜像', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'order-mirror' } },
      { path: 'dinghuobao/sync-tasks', name: 'SupplyDinghuobaoSyncTasks', component: () => import('@/views/supply-chain/dinghuobao/DinghuobaoPage.vue'), meta: { title: '同步任务', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'sync-tasks' } },
      { path: 'dinghuobao/sync-logs', name: 'SupplyDinghuobaoSyncLogs', component: () => import('@/views/supply-chain/dinghuobao/DinghuobaoPage.vue'), meta: { title: '同步日志与死信', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'sync-logs' } },
      { path: 'dinghuobao/connections', name: 'SupplyDinghuobaoConnections', component: () => import('@/views/supply-chain/dinghuobao/DinghuobaoPage.vue'), meta: { title: '连接配置', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'connections' } },
      { path: 'dinghuobao/field-mappings', name: 'SupplyDinghuobaoFieldMappings', component: () => import('@/views/supply-chain/dinghuobao/DinghuobaoPage.vue'), meta: { title: '字段映射', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'field-mappings' } },
      { path: 'dinghuobao/data-quality', name: 'SupplyDinghuobaoDataQuality', component: () => import('@/views/supply-chain/dinghuobao/DinghuobaoPage.vue'), meta: { title: '数据质量', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'data-quality' } },
      { path: 'dinghuobao/bi-prep', name: 'SupplyDinghuobaoBiPrep', component: () => import('@/views/supply-chain/dinghuobao/DinghuobaoPage.vue'), meta: { title: 'BI数据准备', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'bi-prep' } },
    ],
  },
]

/** 动态路由（需要认证，按权限过滤后动态添加） */
export const asyncRoutes: RouteRecordRaw[] = [
  {
    path: '/apps',
    component: () => import('@/layouts/AppPortalLayout.vue'),
    meta: { title: '我的应用', hidden: true, requiresAuth: true },
    children: [
      {
        path: '',
        name: 'MyApplications',
        component: () => import('@/views/apps/MyApplicationsView.vue'),
        meta: { title: '我的应用', hidden: true, requiresAuth: true },
      },
    ],
  },
]

/** 兜底路由（404） */
export const notFoundRoute: RouteRecordRaw = {
  path: '/:pathMatch(.*)*',
  name: 'NotFound',
  component: () => import('@/views/error/NotFoundView.vue'),
  meta: {
    title: '页面不存在',
    hidden: true,
    requiresAuth: false,
  },
}
