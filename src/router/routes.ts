import type { RouteRecordRaw } from 'vue-router'
import { SUPPLY_DOMAIN_PAGES } from '@/views/supply-chain/domain/catalog'

const erpProductManagementRouteKeys = new Set([
  'supply.erp.master-data.products',
])

const erpProductSpecificationRouteKeys = new Set([
  'supply.erp.master-data.attributes.specifications',
])

const erpDocumentRouteKeys = new Set([
  'supply.erp.procurement.orders',
  'supply.erp.procurement.receipts',
  'supply.erp.inventory.inbound',
  'supply.erp.inventory.outbound',
  'supply.erp.inventory.transfers',
])

const erpInventoryBalanceRouteKeys = new Set([
  'supply.erp.inventory.inventory',
])

const erpBasicDataRouteKeys = new Set([
  'supply.erp.master-data.attributes.categories',
  'supply.erp.master-data.attributes.brands',
  'supply.erp.master-data.attributes.tags',
  'supply.erp.inventory.warehouses',
  'supply.erp.suppliers.profiles',
])

const crmCustomerManagementRouteKeys = new Set([
  'supply.crm.customers.profiles',
])

const crmCustomerDictionaryRouteKeys = new Set([
  'supply.crm.customers.levels-tags',
  'supply.crm.customers.areas',
])

const businessDictionaryRouteKeys = new Set([
  'supply.settings.numbering-dictionaries',
])

const integrationSyncCenterRouteKeys = new Set([
  'supply.integration.overview',
])

const procurementPaymentPlaceholderRouteKeys = new Set([
  'supply.erp.procurement.payments',
])

const supplyDomainRoutes: RouteRecordRaw[] = SUPPLY_DOMAIN_PAGES.map((page) => ({
  path: page.path.replace('/supply-chain/', ''),
  name: `SupplyDomain${page.routeKey.split('.').map((part) => part.replace(/(^|-)([a-z])/g, (_, __, letter) => letter.toUpperCase())).join('')}`,
  component: erpProductManagementRouteKeys.has(page.routeKey)
    ? () => import('@/views/supply-chain/erp/ErpProductManagementView.vue')
    : erpProductSpecificationRouteKeys.has(page.routeKey)
      ? () => import('@/views/supply-chain/erp/ErpProductSpecificationView.vue')
      : erpBasicDataRouteKeys.has(page.routeKey)
        ? () => import('@/views/supply-chain/erp/ErpBasicDataManagementView.vue')
        : erpInventoryBalanceRouteKeys.has(page.routeKey)
          ? () => import('@/views/supply-chain/erp/ErpInventoryBalanceView.vue')
          : erpDocumentRouteKeys.has(page.routeKey)
            ? () => import('@/views/supply-chain/erp/ErpDocumentManagementView.vue')
            : crmCustomerManagementRouteKeys.has(page.routeKey)
              ? () => import('@/views/supply-chain/crm/CrmCustomerManagementView.vue')
              : crmCustomerDictionaryRouteKeys.has(page.routeKey)
                ? () => import('@/views/supply-chain/crm/CrmCustomerDictionaryView.vue')
                : businessDictionaryRouteKeys.has(page.routeKey)
                    ? () => import('@/views/supply-chain/settings/BusinessDictionaryView.vue')
                    : integrationSyncCenterRouteKeys.has(page.routeKey)
                      ? () => import('@/views/supply-chain/dhb/DhbPage.vue')
                      : procurementPaymentPlaceholderRouteKeys.has(page.routeKey)
                        ? () => import('@/views/supply-chain/erp/PurchasePaymentPlaceholderView.vue')
                        : () => import('@/views/supply-chain/domain/CapabilityView.vue'),
  meta: {
    title: page.title,
    requiresAuth: true,
    applicationCode: 'SUPPLY_CHAIN',
    routeKey: page.routeKey,
    permission: page.domainKey === 'crm'
      ? 'crm:customer:read'
      : businessDictionaryRouteKeys.has(page.routeKey)
        ? 'business-settings:dict:read'
        : undefined,
  },
}))

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
    path: '/sales-workbench',
    name: 'SalesWorkbenchLaunch',
    component: () => import('@/views/apps/SalesWorkbenchLaunchView.vue'),
    meta: {
      title: '飞书销售工作台',
      hidden: true,
      requiresAuth: true,
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
      { path: 'staff', name: 'SystemStaff', component: () => import('@/views/admin/staff/IndexView.vue'), meta: { title: '人员管理', requiresAuth: true, applicationCode: 'SYSTEM_ADMIN', routeKey: 'system.staff.list', permission: 'iam:staff:read' } },
      { path: 'positions', name: 'SystemPositions', component: () => import('@/views/admin/positions/IndexView.vue'), meta: { title: '岗位管理', requiresAuth: true, applicationCode: 'SYSTEM_ADMIN', routeKey: 'system.position.list', permission: 'iam:position:read' } },
      { path: 'users', name: 'SystemUsers', component: () => import('@/views/admin/users/IndexView.vue'), meta: { title: '用户管理', requiresAuth: true, applicationCode: 'SYSTEM_ADMIN' } },
      { path: 'roles', name: 'SystemRoles', component: () => import('@/views/admin/roles/IndexView.vue'), meta: { title: '角色与资源授权', requiresAuth: true, applicationCode: 'SYSTEM_ADMIN' } },
      { path: 'data-scopes', name: 'SystemDataScopes', component: () => import('@/views/admin/data-scopes/IndexView.vue'), meta: { title: '数据范围', requiresAuth: true, applicationCode: 'SYSTEM_ADMIN' } },
      { path: 'menus', name: 'SystemMenus', component: () => import('@/views/admin/menus/IndexView.vue'), meta: { title: '菜单管理', requiresAuth: true, applicationCode: 'SYSTEM_ADMIN' } },
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
      { path: 'crm', name: 'SupplyCrm', component: () => import('@/views/supply-chain/crm/IndexView.vue'), meta: { title: 'CRM', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', permission: 'crm:customer:read' } },
      { path: 'order', name: 'SupplyOrder', redirect: '/supply-chain/order/sales-orders', meta: { title: '订单管理', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.order.menu' } },
      { path: 'order/sales-orders', name: 'SupplyOrderSalesOrders', component: () => import('@/views/supply-chain/order/SalesOrderView.vue'), meta: { title: '销售订单', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.order.sales-orders', pageKey: 'sales-orders', permission: 'order:read' } },
      { path: 'order/shipments', name: 'SupplyOrderShipments', component: () => import('@/views/supply-chain/order/SalesShipmentView.vue'), meta: { title: '发货单', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.order.shipments', pageKey: 'shipments', permission: 'order:read' } },
      { path: 'order/sales-payments', name: 'SupplyOrderSalesPayments', component: () => import('@/views/supply-chain/order/SalesPaymentRecordView.vue'), meta: { title: '销售回款', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.order.sales-payments', pageKey: 'sales-payments', permission: 'order:read' } },
      { path: 'order/fund-documents', name: 'SupplyOrderFundDocuments', component: () => import('@/views/supply-chain/order/FundDocumentView.vue'), meta: { title: '客户资金流水', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.order.fund-documents', pageKey: 'fund-documents', permission: 'order:read' } },
      { path: 'order/sales-refunds', name: 'SupplyOrderSalesRefunds', component: () => import('@/views/supply-chain/order/SalesRefundRecordView.vue'), meta: { title: '销售退款', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.order.sales-refunds', pageKey: 'sales-refunds', permission: 'order:read' } },
      { path: 'sales', name: 'SupplySalesDashboard', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '销售管控台', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'dashboard', permission: 'sales:dashboard:read' } },
      { path: 'sales/attendance/today', name: 'SupplySalesAttendanceToday', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '今日状态', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'attendance-today' } },
      { path: 'sales/attendance/punches', name: 'SupplySalesAttendancePunches', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '打卡明细', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'attendance-punches' } },
      { path: 'sales/attendance/days', name: 'SupplySalesAttendanceDays', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '工作日结', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'attendance-days' } },
      { path: 'sales/attendance/interruptions', name: 'SupplySalesAttendanceInterruptions', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '定位中断摘要', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'attendance-interruptions' } },
      { path: 'sales/attendance/adjustments', name: 'SupplySalesAttendanceAdjustments', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '补卡与异常', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'attendance-adjustments' } },
      { path: 'sales/visits/plans', name: 'SupplySalesVisitPlans', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '拜访计划', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'visit-plans', permission: 'sales:visit-plan:read' } },
      { path: 'sales/visits/records', name: 'SupplySalesVisitRecords', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '拜访记录', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'visit-records' } },
      { path: 'sales/visits/reviews', name: 'SupplySalesVisitReviews', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '待复核', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'visit-reviews', permission: 'sales:visit:review' } },
      { path: 'sales/visits/appeals', name: 'SupplySalesVisitAppeals', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '申诉与调整', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'visit-appeals' } },
      { path: 'sales/stores/assigned', name: 'SupplySalesStoresAssigned', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '负责门店', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'stores-assigned' } },
      { path: 'sales/stores/uncovered', name: 'SupplySalesStoresUncovered', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '未覆盖门店', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'stores-uncovered' } },
      { path: 'sales/stores/visited', name: 'SupplySalesStoresVisited', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '已拜访门店', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'stores-visited' } },
      { path: 'sales/stores/effective', name: 'SupplySalesStoresEffective', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '有效拜访门店', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'stores-effective' } },
      { path: 'sales/stores/candidates', name: 'SupplySalesStoresCandidates', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '新客户门店线索', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'stores-candidates' } },
      { path: 'sales/organization/profiles', name: 'SupplySalesProfiles', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '销售画像', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'organization-profiles' } },
      { path: 'sales/organization/teams', name: 'SupplySalesTeams', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '销售团队', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'organization-teams' } },
      { path: 'sales/organization/scopes', name: 'SupplySalesOrganizationScopes', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '任职与城市范围', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'organization-scopes' } },
      { path: 'sales/tasks/visits', name: 'SupplySalesVisitTasks', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '拜访任务', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'tasks-visits' } },
      { path: 'sales/tasks/targets', name: 'SupplySalesTargets', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '目标分配', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'tasks-targets' } },
      { path: 'sales/tasks/exemptions', name: 'SupplySalesTargetExemptions', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '目标减免', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'tasks-exemptions' } },
      { path: 'sales/exceptions/punch', name: 'SupplySalesPunchExceptions', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '打卡异常', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'exceptions-punch' } },
      { path: 'sales/exceptions/location', name: 'SupplySalesLocationExceptions', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '定位异常', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'exceptions-location', permission: 'sales:location:sensitive:read' } },
      { path: 'sales/exceptions/evidence', name: 'SupplySalesEvidenceExceptions', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '拜访证据异常', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'exceptions-evidence' } },
      { path: 'sales/exceptions/recording', name: 'SupplySalesRecordingExceptions', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '录音与AI异常', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'exceptions-recording' } },
      { path: 'sales/exceptions/reviews', name: 'SupplySalesExceptionReviews', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '主管复核', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'exceptions-reviews', permission: 'sales:visit:review' } },
      { path: 'sales/policies/field', name: 'SupplySalesFieldPolicies', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '外勤规则', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'policies-field' } },
      { path: 'sales/policies/visit', name: 'SupplySalesVisitPolicies', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '拜访规则', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'policies-visit' } },
      { path: 'sales/policies/recording-ai', name: 'SupplySalesRecordingAiPolicies', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '录音与AI规则', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'policies-recording-ai' } },
      { path: 'sales/policies/scopes', name: 'SupplySalesPolicyScopes', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '适用范围', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'policies-scopes' } },
      { path: 'sales/policies/releases', name: 'SupplySalesPolicyReleases', component: () => import('@/views/supply-chain/sales/IndexView.vue'), meta: { title: '发布与历史版本', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', pageKey: 'policies-releases' } },
      { path: 'erp', name: 'SupplyErp', component: () => import('@/views/supply-chain/erp/IndexView.vue'), meta: { title: 'ERP', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN' } },
      { path: 'hr', name: 'SupplyHr', component: () => import('@/views/supply-chain/hr/IndexView.vue'), meta: { title: '人事与绩效', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN' } },
      { path: 'channel', name: 'SupplyChannel', component: () => import('@/views/supply-chain/channel/IndexView.vue'), meta: { title: '渠道代理', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN' } },
      { path: 'bi', name: 'SupplyBi', component: () => import('@/views/supply-chain/bi/IndexView.vue'), meta: { title: 'BI 数据看板', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN' } },
      { path: 'settings', name: 'SupplySettings', component: () => import('@/views/supply-chain/settings/IndexView.vue'), meta: { title: '业务设置', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN' } },
      ...supplyDomainRoutes,
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
