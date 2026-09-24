/** Isolated design fixture. Not imported by the production application. */
import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory, RouterView } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '@/assets/styles/index.scss'
import ConsoleShell from '@/layouts/ConsoleShell.vue'
import DashboardView from '@/views/supply-chain/bi/DashboardView.vue'
import ConsoleDashboard from '@/components/console/ConsoleDashboard.vue'
import { useAuthStore } from '@/stores/auth'
import { useNavigationStore } from '@/stores/navigation'
import { apiClient } from '@/api/core/client'
import { meetingFixture } from './bi-meeting-data'
import { salesMeetingFixture } from './bi-sales-meeting-data'
import type { NavigationNode } from '@/types/management'
function node(
  key: string,
  displayName: string,
  routePath: string | null,
  iconKey: string,
  children: NavigationNode[] = [],
): NavigationNode {
  return {
    id: key,
    code: key,
    routeKey: key,
    displayName,
    routePath,
    iconKey,
    children,
    parentId: null,
    type: routePath ? 'PAGE' : 'MENU',
    permissionCode: null,
    sortOrder: 0,
    visible: true,
    keepAlive: true,
  }
}
const nodes = [
  node('supply.dashboard', '工作首页', '/supply-chain', 'House'),
  node('supply.bi.menu', '数据看板', null, 'DataAnalysis', [
    node('supply.bi.overview', '经营总览', '/supply-chain/bi', 'DataAnalysis'),
    node(
      'supply.bi.city-operating',
      '城市经营',
      '/supply-chain/bi/city-operating',
      'OfficeBuilding',
    ),
    node('supply.bi.sales', '销售业绩', '/supply-chain/bi/sales', 'TrendCharts'),
  ]),
  node('supply.order.menu', '订单管理', null, 'Document', [
    node('supply.order.sales-orders', '销售订单', '/supply-chain/order/sales-orders', 'Document'),
    node('supply.order.sales-payments', '收款记录', '/supply-chain/order/sales-payments', 'Wallet'),
  ]),
  node('supply.crm.menu', '客户管理', null, 'User', [
    node(
      'supply.crm.customers.profiles',
      '客户档案',
      '/supply-chain/crm/customers/profiles',
      'User',
    ),
  ]),
  node('supply.erp.menu', 'ERP管理', null, 'Box', [
    node(
      'supply.erp.inventory.inventory',
      '库存查询',
      '/supply-chain/erp/inventory/inventory',
      'Box',
    ),
  ]),
  node('supply.sales.menu', '销售管理', null, 'TrendCharts', [
    node('demo.sales', '销售工作台', '/supply-chain/demo-sales', 'TrendCharts'),
  ]),
  node('supply.hr.menu', '人事管理', null, 'Avatar', [
    node('demo.hr', '员工档案', '/supply-chain/demo-hr', 'Avatar'),
  ]),
  node('supply.integration.menu', '数据同步', '/supply-chain/demo-sync', 'Refresh'),
  node('supply.setting.menu', '系统设置', '/supply-chain/demo-setting', 'Setting'),
]
const snapshot = meetingFixture()
const data = snapshot.current
data.salesRanking = salesMeetingFixture().people.map((person) => ({
  rankType: 'SALES',
  dimensionCode: person.code,
  dimensionName: person.name,
  regionCode: person.cityCode,
  regionName: person.city,
  salesAmount: person.sales || 0,
  paidAmount: person.cohort?.received || 0,
  unpaidAmount: (person.sales || 0) - (person.cohort?.received || 0),
  orderCount: 20,
  customerCount: 10,
  rate: 0,
}))
for (const [code, value] of Object.entries({
  sales_amount: 268450,
  receipt_amount: 192680,
  cooperated_customer_count: 126,
}))
  data.metrics.find((row) => row.metricCode === code)!.value = value
data.cityTargetCompletions = data.cityTargetCompletions.slice(0, 3).map((row) => ({
  ...row,
  targetValue: row.metricCode === 'SALES_AMOUNT' ? 400000 : 300000,
  actualValue: row.metricCode === 'SALES_AMOUNT' ? 268450 : 192680,
}))
snapshot.analysis!.customerRetention = { orderingCustomerCount: 126, returningCustomerCount: 48 }
const customers = [
  '杭州市星辰台球俱乐部',
  '金华市鼎点台球会馆',
  '宁波市悦动运动馆',
  '苏州市北岸台球中心',
  '北京市蓝湾台球俱乐部',
]
const items = customers.map((customerName, i) => ({
  id: String(i),
  orderNo: `DEMO-${i}`,
  customerName,
  paidAmount: [3200, 5800, 2400, 7600, 4200][i],
  payableAmount: 9800 + i * 2000,
  unpaidAmount: 6600 + i * 1000,
  paymentTime: '2026-09-23T08:30:00+08:00',
  orderDate: '2026-09-22T08:30:00+08:00',
}))
// Every request is intercepted; this page cannot read or modify live business data.
apiClient.defaults.adapter = async (config) => {
  let body: unknown
  if (config.url?.endsWith('effective-scope')) body = { accessLevel: 'TENANT' }
  else if (config.url?.endsWith('/trust')) body = null
  else if (config.url?.endsWith('/overview')) body = data
  else if (config.url?.endsWith('/operating-analysis')) body = snapshot.analysis
  else if (config.url?.endsWith('/payments')) body = { total: 8, items }
  else if (config.url?.endsWith('/orders'))
    body = { total: config.params?.hasUnpaid ? 18 : 12, items }
  else throw new Error(`Fixture does not implement ${config.url}`)
  return { config, data: body, status: 200, statusText: 'OK', headers: {} }
}
const pinia = createPinia()
useAuthStore(pinia).user = {
  id: 'preview',
  principalScope: 'TENANT',
  username: 'preview',
  displayName: '设计预览',
  roles: [],
  permissions: [],
  tenantId: 'preview',
  tenantName: '合成数据 · 非真实经营数据',
}
const nav = useNavigationStore(pinia)
nav.navigationByApplication.SUPPLY_CHAIN = nodes
nav.loadedApplications.push('SUPPLY_CHAIN')
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/supply-chain',
      component: ConsoleShell,
      meta: { applicationCode: 'SUPPLY_CHAIN', title: '工作首页' },
      children: [
        { path: '', component: ConsoleDashboard, meta: { title: '工作首页' } },
        ...[
          ['bi', 'overview', '经营总览'],
          ['bi/city-operating', 'city-operating', '城市经营'],
          ['bi/sales', 'sales', '销售业绩'],
        ].map(([path, dashboardSection, title]) => ({
          path,
          component: DashboardView,
          meta: { dashboardSection, title },
        })),
        {
          path: ':rest(.*)*',
          component: {
            setup: () => () =>
              h('section', [
                h('h1', '业务入口交互预览'),
                h('p', '此处仅验证菜单、标签页及传递的查询条件；真实业务页面请登录平台验收。'),
                h('p', router.currentRoute.value.fullPath),
              ]),
          },
          meta: { title: '业务页面' },
        },
      ],
    },
  ],
})
await router.push('/supply-chain')
await router.isReady()
createApp({ render: () => h(RouterView) })
  .use(pinia)
  .use(router)
  .use(ElementPlus)
  .mount('#app')
