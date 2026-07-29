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
]

/** 动态路由（需要认证，按权限过滤后动态添加） */
export const asyncRoutes: RouteRecordRaw[] = [
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
