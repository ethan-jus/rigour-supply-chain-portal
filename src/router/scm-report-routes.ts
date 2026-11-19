import type { RouteRecordRaw } from 'vue-router'

export const scmReportRoutes = [
  {
    path: 'bi/receivables',
    name: 'SupplyBiReceivables',
    component: () => import('@/views/supply-chain/bi/ReceivablesView.vue'),
    meta: {
      title: '回款与应收',
      applicationCode: 'SUPPLY_CHAIN',
      requiresAuth: true,
      routeKey: 'supply.bi.receivables',
      permission: 'analytics:dashboard:read',
    },
  },
  {
    path: 'sales/overview',
    name: 'SupplySalesOverview',
    component: () => import('@/views/supply-chain/sales/SalesTeamOverview.vue'),
    meta: {
      title: '销售总览',
      applicationCode: 'SUPPLY_CHAIN',
      requiresAuth: true,
      routeKey: 'supply.sales.overview',
      permission: 'analytics:dashboard:read',
    },
  },
  {
    path: 'sales/performance',
    name: 'SupplySalesPerformance',
    component: () => import('@/views/supply-chain/sales/SalesTeamOverview.vue'),
    meta: {
      title: '绩效达成',
      applicationCode: 'SUPPLY_CHAIN',
      requiresAuth: true,
      routeKey: 'supply.sales.performance',
      permission: 'analytics:dashboard:read',
    },
  },
  {
    path: 'sales/customer-followups',
    name: 'SupplySalesCustomerFollowups',
    component: () => import('@/views/supply-chain/sales/SalesActionsView.vue'),
    meta: {
      title: '客户跟进',
      applicationCode: 'SUPPLY_CHAIN',
      requiresAuth: true,
      routeKey: 'supply.sales.customer-followups',
      permission: 'analytics:dashboard:read',
    },
  },
  {
    path: 'sales/risk-cases',
    name: 'SupplySalesRiskCases',
    component: () => import('@/views/supply-chain/sales/SalesActionsView.vue'),
    meta: {
      title: '风险处置',
      applicationCode: 'SUPPLY_CHAIN',
      requiresAuth: true,
      routeKey: 'supply.sales.risk-cases',
      permission: 'analytics:dashboard:read',
    },
  },
  {
    path: 'sales/visits/records',
    name: 'SupplySalesVisitsRecords',
    component: () => import('@/views/supply-chain/sales/TeamVisitRecords.vue'),
    meta: {
      title: '拜访记录',
      applicationCode: 'SUPPLY_CHAIN',
      requiresAuth: true,
      routeKey: 'supply.sales.visits.records',
      permission: 'sales:dashboard:read',
    },
  },
  {
    path: 'sales/pay-statements',
    name: 'SupplySalesPayStatements',
    component: () => import('@/views/supply-chain/hr/SalesPayrollBoard.vue'),
    meta: {
      title: '薪酬核对',
      applicationCode: 'SUPPLY_CHAIN',
      requiresAuth: true,
      routeKey: 'supply.sales.pay-statements',
      permission: 'hr:payroll:self',
    },
  },
  {
    path: 'hr/sales-payroll',
    name: 'SupplyHrSalesPayroll',
    component: () => import('@/views/supply-chain/hr/SalesPayrollBoard.vue'),
    meta: {
      title: '销售薪酬看板',
      applicationCode: 'SUPPLY_CHAIN',
      requiresAuth: true,
      routeKey: 'supply.hr.sales-payroll',
      permission: 'hr:payroll:read',
    },
  },
] satisfies RouteRecordRaw[]
