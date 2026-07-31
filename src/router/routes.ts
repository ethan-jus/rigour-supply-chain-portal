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
    path: '/platform-admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { title: '平台管理中心', hidden: true, requiresAuth: true, applicationCode: 'PLATFORM_ADMIN' },
    children: [
      { path: '', name: 'PlatformAdminDashboard', component: () => import('@/views/admin/dashboard/IndexView.vue'), meta: { title: '平台管理', requiresAuth: true, applicationCode: 'PLATFORM_ADMIN' } },
      { path: 'tenants', name: 'PlatformTenants', component: () => import('@/views/admin/tenants/IndexView.vue'), meta: { title: '租户管理', requiresAuth: true, applicationCode: 'PLATFORM_ADMIN' } },
      { path: 'packages', name: 'PlatformPackages', component: () => import('@/views/admin/packages/IndexView.vue'), meta: { title: '套餐管理', requiresAuth: true, applicationCode: 'PLATFORM_ADMIN' } },
      { path: 'applications', name: 'PlatformApplications', component: () => import('@/views/admin/applications/IndexView.vue'), meta: { title: '应用目录', requiresAuth: true, applicationCode: 'PLATFORM_ADMIN' } },
      { path: 'resources', name: 'PlatformResources', component: () => import('@/views/admin/resources/IndexView.vue'), meta: { title: '菜单与资源', requiresAuth: true, applicationCode: 'PLATFORM_ADMIN' } },
      { path: 'audit', name: 'PlatformAudit', component: () => import('@/views/admin/audit-logs/IndexView.vue'), meta: { title: '平台审计', requiresAuth: true, applicationCode: 'PLATFORM_ADMIN' } },
    ],
  },
  {
    path: '/system-admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { title: '系统管理', hidden: true, requiresAuth: true, applicationCode: 'SYSTEM_ADMIN' },
    children: [
      { path: '', name: 'SystemAdminDashboard', component: () => import('@/views/admin/dashboard/IndexView.vue'), meta: { title: '系统管理', requiresAuth: true, applicationCode: 'SYSTEM_ADMIN' } },
      { path: 'organizations', name: 'SystemOrganizations', component: () => import('@/views/admin/organizations/IndexView.vue'), meta: { title: '组织管理', requiresAuth: true, applicationCode: 'SYSTEM_ADMIN' } },
      { path: 'users', name: 'SystemUsers', component: () => import('@/views/admin/users/IndexView.vue'), meta: { title: '用户管理', requiresAuth: true, applicationCode: 'SYSTEM_ADMIN' } },
      { path: 'roles', name: 'SystemRoles', component: () => import('@/views/admin/roles/IndexView.vue'), meta: { title: '角色与资源授权', requiresAuth: true, applicationCode: 'SYSTEM_ADMIN' } },
      { path: 'data-scopes', name: 'SystemDataScopes', component: () => import('@/views/admin/data-scopes/IndexView.vue'), meta: { title: '数据范围', requiresAuth: true, applicationCode: 'SYSTEM_ADMIN' } },
      { path: 'settings', name: 'SystemSettings', component: () => import('@/views/admin/settings/IndexView.vue'), meta: { title: '系统设置', requiresAuth: true, applicationCode: 'SYSTEM_ADMIN' } },
      { path: 'audit', name: 'SystemAudit', component: () => import('@/views/admin/audit-logs/IndexView.vue'), meta: { title: '租户审计', requiresAuth: true, applicationCode: 'SYSTEM_ADMIN' } },
    ],
  },
  {
    path: '/supply-chain',
    component: () => import('@/layouts/SupplyChainLayout.vue'),
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
  {
    path: '/',
    component: () => import('@/layouts/DefaultLayout.vue'),
    redirect: '/dashboard',
    meta: { title: '首页', hidden: false, requiresAuth: true },
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/dashboard/DashboardView.vue'),
        meta: {
          title: '工作台',
          icon: 'Odometer',
          requiresAuth: true,
          keepAlive: true,
        },
      },
    ],
  },
  {
    path: '/hq',
    name: 'Hq',
    component: () => import('@/layouts/DefaultLayout.vue'),
    redirect: '/hq/index',
    meta: { title: '总部管理', icon: 'OfficeBuilding', requiresAuth: true },
    children: [
      {
        path: 'index',
        name: 'HqIndex',
        component: () => import('@/views/hq/IndexView.vue'),
        meta: { title: '总部概览', requiresAuth: true, permission: 'hq:overview' },
      },
    ],
  },
  {
    path: '/erp',
    name: 'Erp',
    component: () => import('@/layouts/DefaultLayout.vue'),
    redirect: '/erp/index',
    meta: { title: 'ERP', icon: 'SetUp', requiresAuth: true },
    children: [
      {
        path: 'index',
        name: 'ErpIndex',
        component: () => import('@/views/erp/IndexView.vue'),
        meta: { title: 'ERP 概览', requiresAuth: true, permission: 'erp:overview' },
      },
      {
        path: 'sku',
        name: 'ErpSku',
        component: () => import('@/views/erp/IndexView.vue'),
        meta: { title: 'SKU 管理', requiresAuth: true, permission: 'erp:sku:list' },
      },
      {
        path: 'warehouse',
        name: 'ErpWarehouse',
        component: () => import('@/views/erp/IndexView.vue'),
        meta: { title: '仓库管理', requiresAuth: true, permission: 'erp:warehouse:list' },
      },
      {
        path: 'purchase',
        name: 'ErpPurchase',
        component: () => import('@/views/erp/IndexView.vue'),
        meta: { title: '采购管理', requiresAuth: true, permission: 'erp:purchase:list' },
      },
      {
        path: 'supplier',
        name: 'ErpSupplier',
        component: () => import('@/views/erp/IndexView.vue'),
        meta: { title: '供应商管理', requiresAuth: true, permission: 'erp:supplier:list' },
      },
    ],
  },
  {
    path: '/order',
    name: 'Order',
    component: () => import('@/layouts/DefaultLayout.vue'),
    redirect: '/order/index',
    meta: { title: '订单管理', icon: 'List', requiresAuth: true },
    children: [
      {
        path: 'index',
        name: 'OrderIndex',
        component: () => import('@/views/order/IndexView.vue'),
        meta: { title: '订单列表', requiresAuth: true, permission: 'order:order:list' },
      },
      {
        path: 'after-sale',
        name: 'OrderAfterSale',
        component: () => import('@/views/order/IndexView.vue'),
        meta: { title: '售后管理', requiresAuth: true, permission: 'order:after-sale:list' },
      },
      {
        path: 'receivable',
        name: 'OrderReceivable',
        component: () => import('@/views/order/IndexView.vue'),
        meta: { title: '应收管理', requiresAuth: true, permission: 'order:receivable:list' },
      },
    ],
  },
  {
    path: '/sales',
    name: 'Sales',
    component: () => import('@/layouts/DefaultLayout.vue'),
    redirect: '/sales/index',
    meta: { title: '销售管理', icon: 'User', requiresAuth: true },
    children: [
      {
        path: 'index',
        name: 'SalesIndex',
        component: () => import('@/views/sales/IndexView.vue'),
        meta: { title: '销售概览', requiresAuth: true, permission: 'sales:overview' },
      },
      {
        path: 'attendance',
        name: 'SalesAttendance',
        component: () => import('@/views/sales/IndexView.vue'),
        meta: { title: '考勤管理', requiresAuth: true, permission: 'sales:attendance:list' },
      },
      {
        path: 'visit',
        name: 'SalesVisit',
        component: () => import('@/views/sales/IndexView.vue'),
        meta: { title: '拜访记录', requiresAuth: true, permission: 'sales:visit:list' },
      },
    ],
  },
  {
    path: '/bi',
    name: 'Bi',
    component: () => import('@/layouts/DefaultLayout.vue'),
    redirect: '/bi/index',
    meta: { title: '数据分析', icon: 'DataAnalysis', requiresAuth: true },
    children: [
      {
        path: 'index',
        name: 'BiIndex',
        component: () => import('@/views/bi/IndexView.vue'),
        meta: { title: 'BI 概览', requiresAuth: true, permission: 'bi:overview' },
      },
      {
        path: 'dashboard',
        name: 'BiDashboard',
        component: () => import('@/views/bi/IndexView.vue'),
        meta: { title: '领导驾驶舱', requiresAuth: true, permission: 'bi:dashboard:view' },
      },
      {
        path: 'report',
        name: 'BiReport',
        component: () => import('@/views/bi/IndexView.vue'),
        meta: { title: '战报', requiresAuth: true, permission: 'bi:report:view' },
      },
    ],
  },
  {
    path: '/hr',
    name: 'Hr',
    component: () => import('@/layouts/DefaultLayout.vue'),
    redirect: '/hr/index',
    meta: { title: '人事管理', icon: 'Avatar', requiresAuth: true },
    children: [
      {
        path: 'index',
        name: 'HrIndex',
        component: () => import('@/views/hr/IndexView.vue'),
        meta: { title: '人事概览', requiresAuth: true, permission: 'hr:overview' },
      },
      {
        path: 'payroll',
        name: 'HrPayroll',
        component: () => import('@/views/hr/IndexView.vue'),
        meta: { title: '薪酬管理', requiresAuth: true, permission: 'hr:payroll:list' },
      },
    ],
  },
  {
    path: '/city',
    name: 'City',
    component: () => import('@/layouts/DefaultLayout.vue'),
    redirect: '/city/index',
    meta: { title: '城市运营', icon: 'MapLocation', requiresAuth: true },
    children: [
      {
        path: 'index',
        name: 'CityIndex',
        component: () => import('@/views/city/IndexView.vue'),
        meta: { title: '城市概览', requiresAuth: true, permission: 'city:overview' },
      },
      {
        path: 'budget',
        name: 'CityBudget',
        component: () => import('@/views/city/IndexView.vue'),
        meta: { title: '预算管理', requiresAuth: true, permission: 'city:budget:list' },
      },
    ],
  },
  {
    path: '/channel',
    name: 'Channel',
    component: () => import('@/layouts/DefaultLayout.vue'),
    redirect: '/channel/index',
    meta: { title: '代理管理', icon: 'Connection', requiresAuth: true },
    children: [
      {
        path: 'index',
        name: 'ChannelIndex',
        component: () => import('@/views/channel/IndexView.vue'),
        meta: { title: '代理概览', requiresAuth: true, permission: 'channel:overview' },
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
