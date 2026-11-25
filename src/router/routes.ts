import { scmReportRoutes } from './scm-report-routes'
import type { RouteRecordRaw } from 'vue-router'
import { SUPPLY_DOMAIN_PAGES } from '@/views/supply-chain/domain/catalog'

const loadCostManagementEntry = () => import('@/views/supply-chain/cost/CostManagementEntry.vue')
const loadCrmCustomerDictionary = () => import('@/views/supply-chain/crm/CrmCustomerDictionaryView.vue')
const loadCrmStorePool = () => import('@/views/supply-chain/crm/CrmStorePoolView.vue')
const loadErpBasicDataManagement = () => import('@/views/supply-chain/erp/ErpBasicDataManagementView.vue')
const loadErpDocumentManagement = () => import('@/views/supply-chain/erp/ErpDocumentManagementView.vue')
const loadPayrollComponent = () => import('@/views/supply-chain/hr/PayrollComponentView.vue')

// 每个内置业务页都必须有真实组件。权限与路由组件在同一条记录中维护。
const domainRoutes: Record<string, { component: NonNullable<RouteRecordRaw['component']>; permission?: string }> = {
  'supply.cost.logistics': { component: loadCostManagementEntry, permission: 'order:logistics-cost:read' },
  'supply.cost.losses': { component: loadCostManagementEntry, permission: 'erp:cost:loss:read' },
  'supply.cost.marketing': { component: loadCostManagementEntry, permission: 'erp:cost:marketing:read' },
  'supply.cost.office-rentals': { component: loadCostManagementEntry, permission: 'erp:cost:rental:read' },
  'supply.cost.purchases': { component: () => import('@/views/supply-chain/cost/ProcurementCostRecordsView.vue'), permission: 'erp:cost:purchase:read' },
  'supply.cost.warehouse-rentals': { component: loadCostManagementEntry, permission: 'erp:cost:rental:read' },
  'supply.crm.customers.areas': { component: loadCrmCustomerDictionary, permission: 'crm:customer:read' },
  'supply.crm.customers.levels-tags': { component: loadCrmCustomerDictionary, permission: 'crm:customer:read' },
  'supply.crm.customers.profiles': { component: () => import('@/views/supply-chain/crm/CrmCustomerManagementView.vue'), permission: 'crm:customer:read' },
  'supply.crm.customers.shipping-addresses': { component: () => import('@/views/supply-chain/crm/CrmShippingAddressView.vue'), permission: 'crm:customer:read' },
  'supply.crm.stores.analysis': { component: loadCrmStorePool, permission: 'crm:coverage:read' },
  'supply.crm.stores.cooperated': { component: loadCrmStorePool, permission: 'crm:store:cooperation-read' },
  'supply.crm.stores.leads': { component: loadCrmStorePool, permission: 'crm:lead:read' },
  'supply.crm.stores.library': { component: loadCrmStorePool, permission: 'crm:store:library-read' },
  'supply.crm.stores.mine': { component: loadCrmStorePool, permission: 'crm:pool:private-read' },
  'supply.crm.stores.public': { component: loadCrmStorePool, permission: 'crm:pool:public-read' },
  'supply.erp.inventory.inbound': { component: loadErpDocumentManagement },
  'supply.erp.inventory.inventory': { component: () => import('@/views/supply-chain/erp/ErpInventoryBalanceView.vue') },
  'supply.erp.inventory.outbound': { component: loadErpDocumentManagement },
  'supply.erp.inventory.transfers': { component: loadErpDocumentManagement },
  'supply.erp.inventory.warehouses': { component: loadErpBasicDataManagement },
  'supply.erp.master-data.attributes.brands': { component: loadErpBasicDataManagement },
  'supply.erp.master-data.attributes.categories': { component: loadErpBasicDataManagement },
  'supply.erp.master-data.attributes.specifications': { component: () => import('@/views/supply-chain/erp/ErpProductSpecificationView.vue') },
  'supply.erp.master-data.attributes.tags': { component: loadErpBasicDataManagement },
  'supply.erp.master-data.prices': { component: () => import('@/views/supply-chain/erp/ErpProductCustomerTypePriceView.vue') },
  'supply.erp.master-data.products': { component: () => import('@/views/supply-chain/erp/ErpProductManagementView.vue') },
  'supply.erp.procurement.orders': { component: () => import('@/views/supply-chain/erp/ErpProcurementManagementView.vue') },
  'supply.erp.suppliers.profiles': { component: () => import('@/views/supply-chain/erp/ErpSupplierManagementView.vue') },
  'supply.hr.allowance-rules': { component: loadPayrollComponent, permission: 'hr:payroll-rule:read' },
  'supply.hr.attendance': { component: () => import('@/views/supply-chain/hr/HrAttendanceView.vue'), permission: 'hr:attendance:read' },
  'supply.hr.attendance-rules': { component: () => import('@/views/supply-chain/hr/HrAttendanceRuleView.vue'), permission: 'hr:attendance-rule:read' },
  'supply.hr.city-managers': { component: () => import('@/views/supply-chain/hr/PayrollRuleView.vue'), permission: 'hr:payroll-rule:read' },
  'supply.hr.commission-rules': { component: loadPayrollComponent, permission: 'hr:payroll-rule:read' },
  'supply.hr.departments': { component: () => import('@/views/supply-chain/hr/HrDepartmentManagementView.vue'), permission: 'hr:department:read' },
  'supply.hr.employees': { component: () => import('@/views/supply-chain/hr/HrEmployeeManagementView.vue'), permission: 'hr:employee:read' },
  'supply.hr.expenses': { component: loadCostManagementEntry, permission: 'hr:expense:read' },
  'supply.hr.payroll': { component: () => import('@/views/supply-chain/hr/PayrollView.vue'), permission: 'hr:payroll:read' },
  'supply.hr.performance-rules': { component: loadPayrollComponent, permission: 'hr:payroll-rule:read' },
  'supply.hr.positions': { component: () => import('@/views/supply-chain/hr/HrPositionManagementView.vue'), permission: 'hr:position:read' },
  'supply.hr.target-settings': { component: () => import('@/views/supply-chain/hr/HrTargetSettingsView.vue'), permission: 'hr:targets:read' },
  'supply.integration.huolala': { component: () => import('@/views/supply-chain/huolala/HuolalaIntegrationView.vue'), permission: 'integration:huolala:read' },
  'supply.integration.overview': { component: () => import('@/views/supply-chain/dhb/DhbPage.vue') },
  'supply.integration.schedules': { component: () => import('@/views/supply-chain/dhb/DhbScheduleView.vue'), permission: 'integration:dhb:read' },
  'supply.settings.numbering-dictionaries': { component: () => import('@/views/supply-chain/settings/BusinessDictionaryView.vue'), permission: 'business-settings:dict:read' },
}

const supplyDomainRoutes: RouteRecordRaw[] = SUPPLY_DOMAIN_PAGES.flatMap((page) => {
  const entry = domainRoutes[page.routeKey]
  if (!entry) return []
  return [{
    path: page.path.replace('/supply-chain/', ''),
    name: `SupplyDomain${page.routeKey.split('.').map((part) =>
      part.replace(/(^|-)([a-z])/g, (_, __, letter) => letter.toUpperCase()),
    ).join('')}`,
    component: entry.component,
    meta: {
      title: page.title,
      requiresAuth: true,
      applicationCode: 'SUPPLY_CHAIN',
      routeKey: page.routeKey,
      permission: entry.permission,
    },
  }]
})

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
    meta: {
      title: '供应链系统',
      hidden: true,
      requiresAuth: true,
      applicationCode: 'SUPPLY_CHAIN',
    },
    children: [
      {
        path: '',
        name: 'SupplyChainDashboard',
        component: () => import('@/views/supply-chain/dashboard/IndexView.vue'),
        meta: { title: '供应链系统', requiresAuth: true, applicationCode: 'SUPPLY_CHAIN' },
      },
      {
        path: 'order',
        name: 'SupplyOrder',
        redirect: '/supply-chain/order/sales-orders',
        meta: {
          title: '订单管理',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          routeKey: 'supply.order.menu',
        },
      },
      {
        path: 'order/fulfillments',
        name: 'SupplyOrderFulfillments',
        component: () => import('@/views/supply-chain/order/FulfillmentView.vue'),
        meta: {
          title: '订单出库',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          routeKey: 'supply.order.fulfillments',
          pageKey: 'fulfillments',
          permission: 'order:outbound:read',
        },
      },
      {
        path: 'order/sales-orders',
        name: 'SupplyOrderSalesOrders',
        component: () => import('@/views/supply-chain/order/OrderListView.vue'),
        meta: {
          title: '订单列表',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          routeKey: 'supply.order.sales-orders',
          pageKey: 'sales-orders',
          permission: 'order:register-orders:read',
        },
      },
      {
        path: 'order/shipments',
        name: 'SupplyOrderShipments',
        component: () => import('@/views/supply-chain/order/SalesShipmentView.vue'),
        meta: {
          title: '发货单',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          routeKey: 'supply.order.shipments',
          pageKey: 'shipments',
          permission: 'order:read',
        },
      },
      {
        path: 'order/sales-payments',
        name: 'SupplyOrderSalesPayments',
        component: () => import('@/views/supply-chain/order/PaymentRecordListView.vue'),
        meta: {
          title: '订单回款',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          routeKey: 'supply.order.sales-payments',
          pageKey: 'sales-payments',
          permission: 'order:register-payments:read',
        },
      },
      {
        path: 'order/fund-documents',
        name: 'SupplyOrderFundDocuments',
        component: () => import('@/views/supply-chain/order/FundDocumentView.vue'),
        meta: {
          title: '客户资金流水',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          routeKey: 'supply.order.fund-documents',
          pageKey: 'fund-documents',
          permission: 'order:read',
        },
      },
      {
        path: 'order/sales-refunds',
        name: 'SupplyOrderSalesRefunds',
        component: () => import('@/views/supply-chain/order/SalesRefundRecordView.vue'),
        meta: {
          title: '销售退款',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          routeKey: 'supply.order.sales-refunds',
          pageKey: 'sales-refunds',
          permission: 'order:read',
        },
      },
      {
        path: 'order/lines',
        name: 'SupplyOrderLines',
        component: () => import('@/views/supply-chain/order/OrderLineListView.vue'),
        meta: {
          title: '订单明细',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          routeKey: 'supply.order.lines',
          pageKey: 'order-lines',
          permission: 'order:register-lines:read',
        },
      },
      {
        path: 'order/invoices',
        name: 'SupplyOrderInvoices',
        component: () => import('@/views/supply-chain/order/InvoiceManagementView.vue'),
        meta: {
          title: '发票管理',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          routeKey: 'supply.order.invoices',
          pageKey: 'order-invoices',
          permission: 'order:invoice:read',
        },
      },
      ...scmReportRoutes,
      {
        path: 'sales',
        name: 'SupplySalesDashboard',
        component: () => import('@/views/supply-chain/sales/SalesFieldwork.vue'),
        meta: {
          title: '团队外勤',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          pageKey: 'dashboard',
          inlineSubviewNavigation: true,
          permission: 'sales:fieldwork:read',
        },
      },
      {
        path: 'sales/visits/plans',
        name: 'SupplySalesVisitPlans',
        component: () => import('@/views/supply-chain/sales/IndexView.vue'),
        meta: {
          title: '拜访计划',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          pageKey: 'visit-plans',
          permission: 'sales:visit-plan:read',
        },
      },
      {
        path: 'sales/visits/reviews',
        name: 'SupplySalesVisitReviews',
        component: () => import('@/views/supply-chain/sales/IndexView.vue'),
        meta: {
          title: '拜访申诉',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          pageKey: 'visit-reviews',
          permission: 'crm:store:visit-review',
        },
      },
      {
        path: 'sales/exceptions/location',
        name: 'SupplySalesLocationExceptions',
        component: () => import('@/views/supply-chain/sales/IndexView.vue'),
        meta: {
          title: '定位异常',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          pageKey: 'exceptions-location',
          permission: 'sales:location:sensitive:read',
        },
      },
      {
        path: 'sales/policies/visit',
        name: 'SupplySalesVisitPolicies',
        component: () => import('@/views/supply-chain/sales/IndexView.vue'),
        meta: {
          title: '拜访规则',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          pageKey: 'policies-visit',
          permission: 'sales:policy:read',
        },
      },
      {
        path: 'bi',
        name: 'SupplyBi',
        component: () => import('@/views/supply-chain/bi/DashboardView.vue'),
        meta: {
          title: '供应链经营总览',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          routeKey: 'supply.bi.index',
          dashboardSection: 'overview',
          permission: 'analytics:dashboard:read',
        },
      },
      {
        path: 'bi/hr',
        name: 'SupplyBiHr',
        component: () => import('@/views/supply-chain/bi/HrDashboardView.vue'),
        meta: {
          title: 'HR 人事看板',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          routeKey: 'supply.bi.hr',
          permission: 'analytics:dashboard:read',
        },
      },
      {
        path: 'bi/sales-visits',
        name: 'SupplyBiSalesVisits',
        component: () => import('@/views/supply-chain/bi/VisitDashboardView.vue'),
        meta: {
          title: '销售拜访看板',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          routeKey: 'supply.bi.sales-visits',
          permission: 'analytics:dashboard:read',
        },
      },
      {
        path: 'bi/sales',
        name: 'SupplyBiSales',
        component: () => import('@/views/supply-chain/bi/DashboardView.vue'),
        meta: {
          title: '销售看板',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          routeKey: 'supply.bi.sales',
          dashboardSection: 'sales',
          permission: 'analytics:dashboard:read',
        },
      },
      {
        path: 'bi/city-operating',
        name: 'SupplyBiCityOperating',
        component: () => import('@/views/supply-chain/bi/DashboardView.vue'),
        meta: {
          title: '城市经营看板',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          routeKey: 'supply.bi.city-operating',
          dashboardSection: 'city-operating',
          permission: 'analytics:dashboard:read',
        },
      },
      {
        path: 'bi/customer',
        name: 'SupplyBiCustomer',
        component: () => import('@/views/supply-chain/bi/IndexView.vue'),
        meta: {
          title: '客户看板',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          routeKey: 'supply.bi.customer',
          dashboardSection: 'customer',
          permission: 'analytics:dashboard:read',
        },
      },
      {
        path: 'bi/product-inventory',
        name: 'SupplyBiProductInventory',
        component: () => import('@/views/supply-chain/bi/IndexView.vue'),
        meta: {
          title: '商品/库存看板',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          routeKey: 'supply.bi.product-inventory',
          dashboardSection: 'product-inventory',
          permission: 'analytics:dashboard:read',
        },
      },
      {
        path: 'bi/product-sales',
        name: 'SupplyBiProductSales',
        component: () => import('@/views/supply-chain/bi/IndexView.vue'),
        meta: {
          title: '商品销售统计',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          routeKey: 'supply.bi.product-sales',
          dashboardSection: 'product-sales',
          permission: 'analytics:dashboard:read',
        },
      },
      {
        path: 'bi/gross-profit',
        name: 'SupplyBiGrossProfit',
        component: () => import('@/views/supply-chain/bi/IndexView.vue'),
        meta: {
          title: '销售毛利分析',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          routeKey: 'supply.bi.gross-profit',
          dashboardSection: 'gross-profit',
          permission: 'analytics:dashboard:read',
        },
      },
      {
        path: 'bi/payment-risk',
        name: 'SupplyBiPaymentRisk',
        component: () => import('@/views/supply-chain/bi/PaymentRiskView.vue'),
        meta: {
          title: '回款风险看板',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          routeKey: 'supply.bi.payment-risk',
          dashboardSection: 'payment-risk',
          permission: 'analytics:dashboard:read',
        },
      },
      {
        path: 'bi/city-cost',
        name: 'SupplyBiCityCost',
        component: () => import('@/views/supply-chain/bi/CostDashboardView.vue'),
        meta: {
          title: '成本数据看板',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          routeKey: 'supply.bi.city-cost',
          dashboardSection: 'city-cost',
          permission: 'analytics:cost-dashboard:read',
        },
      },
      {
        path: 'bi/inventory-risk',
        name: 'SupplyBiInventoryRisk',
        component: () => import('@/views/supply-chain/bi/IndexView.vue'),
        meta: {
          title: '库存风险看板',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          routeKey: 'supply.bi.inventory-risk',
          dashboardSection: 'inventory-risk',
          permission: 'analytics:dashboard:read',
        },
      },
      {
        path: 'settings/users',
        name: 'SupplySettingsUsers',
        component: () => import('@/views/supply-chain/settings/UserView.vue'),
        meta: {
          title: '用户管理',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          permission: 'supply:user:read',
        },
      },
      {
        path: 'settings/roles',
        name: 'SupplySettingsRoles',
        component: () => import('@/views/supply-chain/settings/RoleView.vue'),
        meta: {
          title: '角色管理',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          permission: 'supply:role:read',
        },
      },
      {
        path: 'settings/menus',
        name: 'SupplySettingsMenus',
        component: () => import('@/views/supply-chain/settings/MenuView.vue'),
        meta: {
          title: '菜单管理',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          permission: 'supply:menu:read',
        },
      },
      {
        path: 'settings/parameters',
        name: 'SupplySettingsParameters',
        component: () => import('@/views/supply-chain/settings/ParameterView.vue'),
        meta: {
          title: '业务参数',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          permission: 'supply:parameter:read',
        },
      },
      {
        path: 'settings/admin-divisions',
        name: 'SupplySettingsAdminDivisions',
        component: () => import('@/views/supply-chain/settings/AdminDivisionView.vue'),
        meta: {
          title: '行政区划',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          routeKey: 'supply.settings.admin-divisions',
          permission: 'supply:admin-division:read',
        },
      },
      {
        path: 'settings/store-territories',
        name: 'SupplySettingsStoreTerritories',
        component: () => import('@/views/supply-chain/settings/StoreTerritoryView.vue'),
        meta: {
          title: '客户地域权限',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          routeKey: 'supply.settings.store-territories',
          permission: 'supply:territory:read',
        },
      },
      {
        path: 'settings/audits',
        name: 'SupplySettingsAudits',
        component: () => import('@/views/supply-chain/settings/AuditView.vue'),
        meta: {
          title: '操作日志',
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          permission: 'supply:audit:read',
        },
      },
      // 旧考勤占位地址进入正式功能，由目标路由执行权限校验。
      { path: 'hr/calendar-policies', redirect: '/supply-chain/hr/attendance-rules' },
      { path: 'hr/attendance-appeals', redirect: '/supply-chain/hr/attendance' },
      // 旧薪酬占位地址统一进入月度工作台，由目标路由执行权限校验。
      ...['payroll-commission', 'performance', 'monthly-close'].map((path) => ({
        path: `hr/${path}`,
        redirect: '/supply-chain/hr/payroll',
      })),
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
