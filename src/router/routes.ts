import type { RouteRecordRaw } from 'vue-router'
import { SUPPLY_DOMAIN_PAGES } from '@/views/supply-chain/domain/catalog'

const erpProductManagementRouteKeys = new Set([
  'supply.erp.master-data.products',
])

const erpProductSpecificationRouteKeys = new Set([
  'supply.erp.master-data.attributes.specifications',
])

const erpProductPriceRouteKeys = new Set([
  'supply.erp.master-data.prices',
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

const crmShippingAddressRouteKeys = new Set([
  'supply.crm.customers.shipping-addresses',
])

const crmCustomerDictionaryRouteKeys = new Set([
  'supply.crm.customers.levels-tags',
  'supply.crm.customers.areas',
])

const hrEmployeeRouteKeys = new Set([
  'supply.hr.employees',
])

const hrPositionRouteKeys = new Set([
  'supply.hr.positions',
])

const businessDictionaryRouteKeys = new Set([
  'supply.settings.numbering-dictionaries',
])

const integrationSyncCenterRouteKeys = new Set([
  'supply.integration.overview',
])

const feishuImportRouteKeys = new Set([
  'supply.integration.feishu-import',
])

const procurementPaymentPlaceholderRouteKeys = new Set([
  'supply.erp.procurement.payments',
])

/** 订单域已有独立业务页面，不能再生成同路径的通用Capability路由。 */
const dedicatedOrderRouteKeys = new Set([
  'supply.order.sales-orders',
  'supply.order.fulfillments',
  'supply.order.shipments',
  'supply.order.sales-payments',
  'supply.order.lines',
  'supply.order.statistics',
  'supply.order.invoices',
  'supply.order.fund-documents',
  'supply.order.sales-refunds',
])

const routableSupplyDomainPages = SUPPLY_DOMAIN_PAGES
  .filter((page) => page.domainKey !== 'bi' && !dedicatedOrderRouteKeys.has(page.routeKey))

const supplyDomainRoutes: RouteRecordRaw[] = routableSupplyDomainPages.map((page) => ({
  path: page.path.replace('/supply-chain/', ''),
  name: `SupplyDomain${page.routeKey.split('.').map((part) => part.replace(/(^|-)([a-z])/g, (_, __, letter) => letter.toUpperCase())).join('')}`,
  component: erpProductManagementRouteKeys.has(page.routeKey)
    ? () => import('@/views/supply-chain/erp/ErpProductManagementView.vue')
    : erpProductSpecificationRouteKeys.has(page.routeKey)
      ? () => import('@/views/supply-chain/erp/ErpProductSpecificationView.vue')
      : erpProductPriceRouteKeys.has(page.routeKey)
        ? () => import('@/views/supply-chain/erp/ErpProductCustomerTypePriceView.vue')
        : erpBasicDataRouteKeys.has(page.routeKey)
        ? () => import('@/views/supply-chain/erp/ErpBasicDataManagementView.vue')
        : erpInventoryBalanceRouteKeys.has(page.routeKey)
          ? () => import('@/views/supply-chain/erp/ErpInventoryBalanceView.vue')
          : erpDocumentRouteKeys.has(page.routeKey)
            ? () => import('@/views/supply-chain/erp/ErpDocumentManagementView.vue')
            : crmCustomerManagementRouteKeys.has(page.routeKey)
              ? () => import('@/views/supply-chain/crm/CrmCustomerManagementView.vue')
              : crmShippingAddressRouteKeys.has(page.routeKey)
                ? () => import('@/views/supply-chain/crm/CrmShippingAddressView.vue')
                : crmCustomerDictionaryRouteKeys.has(page.routeKey)
                  ? () => import('@/views/supply-chain/crm/CrmCustomerDictionaryView.vue')
                  : page.routeKey === 'supply.hr.departments'
                    ? () => import('@/views/supply-chain/hr/HrDepartmentManagementView.vue')
                    : hrEmployeeRouteKeys.has(page.routeKey)
                    ? () => import('@/views/supply-chain/hr/HrEmployeeManagementView.vue')
                    : hrPositionRouteKeys.has(page.routeKey)
                      ? () => import('@/views/supply-chain/hr/HrPositionManagementView.vue')
                      : businessDictionaryRouteKeys.has(page.routeKey)
                        ? () => import('@/views/supply-chain/settings/BusinessDictionaryView.vue')
                        : feishuImportRouteKeys.has(page.routeKey)
                          ? () => import('@/views/supply-chain/feishu/FeishuImportPage.vue')
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
    permission: page.routeKey === 'supply.hr.departments' ? 'hr:department:read' : page.domainKey === 'crm'
      ? 'crm:customer:read'
      : hrEmployeeRouteKeys.has(page.routeKey)
        ? 'hr:employee:read'
        : hrPositionRouteKeys.has(page.routeKey)
          ? 'hr:position:read'
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
    redirect: '/supply-chain',
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
    path: '/supply-chain',
    name: 'SupplyChainConsole',
    component: () => import('@/layouts/ConsoleShell.vue'),
    meta: { title: '供应链系统', hidden: true, requiresAuth: true, applicationCode: 'SUPPLY_CHAIN' },
    children: [
      { path: '', name: 'SupplyChainDashboard', component: () => import('@/views/supply-chain/dashboard/IndexView.vue'), meta: { title: '供应链系统', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN' } },
      { path: 'crm', name: 'SupplyCrm', component: () => import('@/views/supply-chain/crm/IndexView.vue'), meta: { title: 'CRM', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', permission: 'crm:customer:read' } },
      { path: 'order', name: 'SupplyOrder', redirect: '/supply-chain/order/sales-orders', meta: { title: '订单管理', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.order.menu' } },
      { path: 'order/fulfillments', name: 'SupplyOrderFulfillments', component: () => import('@/views/supply-chain/order/FulfillmentView.vue'), meta: { title: '订单出库', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.order.fulfillments', pageKey: 'fulfillments', permission: 'order:outbound:read' } },
      { path: 'order/sales-orders', name: 'SupplyOrderSalesOrders', component: () => import('@/views/supply-chain/order/OrderListView.vue'), meta: { title: '订单列表', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.order.sales-orders', pageKey: 'sales-orders', permission: 'order:read' } },
      { path: 'order/shipments', name: 'SupplyOrderShipments', component: () => import('@/views/supply-chain/order/SalesShipmentView.vue'), meta: { title: '发货单', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.order.shipments', pageKey: 'shipments', permission: 'order:read' } },
      { path: 'order/sales-payments', name: 'SupplyOrderSalesPayments', component: () => import('@/views/supply-chain/order/PaymentRecordListView.vue'),         meta: {
          title: '订单回款', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.order.sales-payments', pageKey: 'sales-payments', permission: 'order:read' } },
      { path: 'order/fund-documents', name: 'SupplyOrderFundDocuments', component: () => import('@/views/supply-chain/order/FundDocumentView.vue'), meta: { title: '客户资金流水', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.order.fund-documents', pageKey: 'fund-documents', permission: 'order:read' } },
      { path: 'order/sales-refunds', name: 'SupplyOrderSalesRefunds', component: () => import('@/views/supply-chain/order/SalesRefundRecordView.vue'), meta: { title: '销售退款', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.order.sales-refunds', pageKey: 'sales-refunds', permission: 'order:read' } },
      { path: 'order/lines', name: 'SupplyOrderLines', component: () => import('@/views/supply-chain/order/OrderLineListView.vue'), meta: { title: '订单明细', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.order.lines', pageKey: 'order-lines', permission: 'order:read' } },
      { path: 'order/statistics', name: 'SupplyOrderStatistics', component: () => import('@/views/supply-chain/order/OrderStatisticsView.vue'), meta: { title: '订单与回款统计', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.order.statistics', pageKey: 'order-statistics', permission: 'order:read' } },
      { path: 'order/invoices', name: 'SupplyOrderInvoices', component: () => import('@/views/supply-chain/order/InvoiceManagementView.vue'), meta: { title: '发票管理', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.order.invoices', pageKey: 'order-invoices', permission: 'order:read' } },
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
      { path: 'bi', name: 'SupplyBi', component: () => import('@/views/supply-chain/bi/IndexView.vue'), meta: { title: '供应链经营总览', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.bi.index', dashboardSection: 'overview', permission: 'analytics:dashboard:read' } },
      { path: 'bi/hr', name: 'SupplyBiHr', component: () => import('@/views/supply-chain/bi/HrDashboardView.vue'), meta: { title: 'HR 人事看板', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.bi.hr', permission: 'analytics:dashboard:read' } },
      { path: 'bi/sales-visits', name: 'SupplyBiSalesVisits', component: () => import('@/views/supply-chain/bi/VisitDashboardView.vue'), meta: { title: '销售拜访看板', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.bi.sales-visits', permission: 'analytics:dashboard:read' } },
      { path: 'bi/sales', name: 'SupplyBiSales', component: () => import('@/views/supply-chain/bi/IndexView.vue'), meta: { title: '销售看板', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.bi.sales', dashboardSection: 'sales', permission: 'analytics:dashboard:read' } },
      { path: 'bi/city-operating', name: 'SupplyBiCityOperating', component: () => import('@/views/supply-chain/bi/IndexView.vue'), meta: { title: '城市经营看板', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.bi.city-operating', dashboardSection: 'city-operating', permission: 'analytics:dashboard:read' } },
      { path: 'bi/customer', name: 'SupplyBiCustomer', component: () => import('@/views/supply-chain/bi/IndexView.vue'), meta: { title: '客户看板', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.bi.customer', dashboardSection: 'customer', permission: 'analytics:dashboard:read' } },
      { path: 'bi/activity', name: 'SupplyBiActivity', component: () => import('@/views/supply-chain/bi/IndexView.vue'), meta: { title: '活动看板', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.bi.activity', dashboardSection: 'activity', permission: 'analytics:dashboard:read' } },
      { path: 'bi/product-inventory', name: 'SupplyBiProductInventory', component: () => import('@/views/supply-chain/bi/IndexView.vue'), meta: { title: '商品/库存看板', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.bi.product-inventory', dashboardSection: 'product-inventory', permission: 'analytics:dashboard:read' } },
      { path: 'bi/sales-collection', name: 'SupplyBiSalesCollection', component: () => import('@/views/supply-chain/bi/IndexView.vue'), meta: { title: '销售与回款看板', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.bi.sales-collection', dashboardSection: 'sales-collection', permission: 'analytics:dashboard:read' } },
      { path: 'bi/product-sales', name: 'SupplyBiProductSales', component: () => import('@/views/supply-chain/bi/IndexView.vue'), meta: { title: '商品销售统计', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.bi.product-sales', dashboardSection: 'product-sales', permission: 'analytics:dashboard:read' } },
      { path: 'bi/gross-profit', name: 'SupplyBiGrossProfit', component: () => import('@/views/supply-chain/bi/IndexView.vue'), meta: { title: '销售毛利分析', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.bi.gross-profit', dashboardSection: 'gross-profit', permission: 'analytics:dashboard:read' } },
      { path: 'bi/payment-risk', name: 'SupplyBiPaymentRisk', component: () => import('@/views/supply-chain/bi/IndexView.vue'), meta: { title: '回款风险看板', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.bi.payment-risk', dashboardSection: 'payment-risk', permission: 'analytics:dashboard:read' } },
      { path: 'bi/city-cost', name: 'SupplyBiCityCost', component: () => import('@/views/supply-chain/bi/IndexView.vue'), meta: { title: '城市成本看板', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.bi.city-cost', dashboardSection: 'city-cost', permission: 'analytics:dashboard:read' } },
      { path: 'bi/inventory-risk', name: 'SupplyBiInventoryRisk', component: () => import('@/views/supply-chain/bi/IndexView.vue'), meta: { title: '库存风险看板', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', routeKey: 'supply.bi.inventory-risk', dashboardSection: 'inventory-risk', permission: 'analytics:dashboard:read' } },
      { path: 'settings', name: 'SupplySettings', component: () => import('@/views/supply-chain/settings/IndexView.vue'), meta: { title: '系统设置', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN' } },
      { path: 'settings/users', name: 'SupplySettingsUsers', component: () => import('@/views/supply-chain/settings/UserView.vue'), meta: { title: '用户管理', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', permission: 'supply:user:read' } },
      { path: 'settings/roles', name: 'SupplySettingsRoles', component: () => import('@/views/supply-chain/settings/RoleView.vue'), meta: { title: '角色管理', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', permission: 'supply:role:read' } },
      { path: 'settings/menus', name: 'SupplySettingsMenus', component: () => import('@/views/supply-chain/settings/MenuView.vue'), meta: { title: '菜单管理', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', permission: 'supply:menu:read' } },
      { path: 'settings/parameters', name: 'SupplySettingsParameters', component: () => import('@/views/supply-chain/settings/ParameterView.vue'), meta: { title: '业务参数', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', permission: 'supply:parameter:read' } },
      { path: 'settings/audits', name: 'SupplySettingsAudits', component: () => import('@/views/supply-chain/settings/AuditView.vue'), meta: { title: '操作日志', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN', permission: 'supply:audit:read' } },
      ...supplyDomainRoutes,
    ],
  },
]

/** 动态路由（需要认证，按权限过滤后动态添加） */
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
