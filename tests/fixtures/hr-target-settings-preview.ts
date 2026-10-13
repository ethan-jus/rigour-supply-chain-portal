/** Isolated preview of the production page; every request is intercepted. No live sync. */
import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory, RouterView } from 'vue-router'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import '@/assets/styles/index.scss'
import ConsoleShell from '@/layouts/ConsoleShell.vue'
import Targets from '@/views/supply-chain/hr/HrTargetSettingsView.vue'
import type { TargetSettings, TargetHistory, TargetBatch } from '@/api/core/hr-target-settings'
import { useAuthStore } from '@/stores/auth'
import { useNavigationStore } from '@/stores/navigation'
import { apiClient } from '@/api/core/client'
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
  node('supply.bi.menu', '数据看板', '/supply-chain/bi', 'DataAnalysis'),
  node('supply.order.menu', '订单管理', '/supply-chain/order', 'Document'),
  node('supply.crm.menu', '客户管理', '/supply-chain/crm', 'User'),
  node('supply.erp.menu', 'ERP 管理', '/supply-chain/erp', 'Box'),
  node('supply.hr.menu', '人事管理', null, 'Avatar', [
    node('supply.hr.target-settings', '指标设置', '/supply-chain/hr/target-settings', 'Aim'),
  ]),
  node('supply.integration.sync-control.menu', '数据同步', null, 'Refresh', [
    node(
      'supply.integration.overview',
      '同步总览',
      '/supply-chain/integration/overview',
      'DataAnalysis',
    ),
    node(
      'supply.integration.schedules',
      '定时任务',
      '/supply-chain/integration/schedules',
      'Timer',
    ),
    node('supply.integration.dhb', '订货宝同步', '/supply-chain/integration/dhb', 'Refresh'),
  ]),
  node('supply.setting.menu', '系统设置', '/supply-chain/settings', 'Setting'),
]
const readonly = new URLSearchParams(location.search).has('readonly')
const cityNames = ['北京市', '杭州市', '南京市', '成都市', '武汉市', '西安市', '苏州市', '唐山市']
const subjects: TargetSettings['subjects'] = cityNames.map((name, i) => ({
  dimensionType: 'CITY',
  code: `C${i}`,
  name,
  cityCode: `C${i}`,
  cityName: name,
  departmentName: null,
  employmentStatus: null,
  writable: !readonly,
}))
for (const [i, name] of ['李明', '陈晨', '王宁', '刘洋', '周敏', '赵凯', '林悦'].entries()) {
  const city = i < 3 ? 0 : i - 2
  subjects.push({
    dimensionType: 'SALES_OWNER',
    code: `XS00${i + 1}`,
    name,
    cityCode: `C${city}`,
    cityName: cityNames[city]!,
    departmentName: '销售部',
    employmentStatus: 'ACTIVE',
    writable: !readonly,
  })
}
const byMonth = new Map<string, TargetSettings['targets']>()
const history = new Map<string, TargetHistory[]>()
function values(month: string) {
  if (!byMonth.has(month))
    byMonth.set(
      month,
      subjects.flatMap((subject) =>
        ['SALES_AMOUNT', 'RECEIPT_AMOUNT', 'NEW_CUSTOMER', 'REPEAT_CUSTOMER'].map((metric) => ({
          month,
          dimensionType: subject.dimensionType,
          code: subject.code,
          name: subject.name,
          metric: metric as TargetSettings['targets'][number]['metric'],
          value:
            metric === 'NEW_CUSTOMER'
              ? 200
              : metric === 'REPEAT_CUSTOMER'
                ? 100
                : subject.dimensionType === 'CITY'
                  ? 100000
                  : metric === 'SALES_AMOUNT'
                    ? 40000
                    : 20000,
          revision: 0,
        })),
      ),
    )
  return byMonth.get(month)!
}
apiClient.defaults.adapter = async (config) => {
  const url = config.url || '',
    params = config.params || {}
  let body: unknown = null
  if (url.endsWith('/target-settings/history'))
    body = history.get(`${params.month}:${params.dimensionType}:${params.code}`) || []
  else if (url.endsWith('/target-settings') && config.method === 'put') {
    if (readonly) throw new Error('当前为只读预览')
    const batch = JSON.parse(config.data as string) as TargetBatch
    for (const change of batch.changes) {
      const target = values(batch.month).find(
        (t) =>
          t.dimensionType === change.dimensionType &&
          t.code === change.code &&
          t.metric === change.metric,
      )!
      if (target.revision !== change.expectedRevision) throw new Error('指标已被其他人修改，请刷新')
    }
    for (const change of batch.changes) {
      const target = values(batch.month).find(
        (t) =>
          t.dimensionType === change.dimensionType &&
          t.code === change.code &&
          t.metric === change.metric,
      )!
      target.value = change.value
      target.revision++
      const key = `${batch.month}:${change.dimensionType}:${change.code}`
      history.set(key, [
        {
          metric: change.metric,
          value: change.value,
          revision: target.revision,
          reason: batch.reason,
          actor: '示例人事',
          occurredAt: new Date().toISOString(),
        },
        ...(history.get(key) || []),
      ])
    }
  } else if (url.endsWith('/target-settings'))
    body = { month: params.month, subjects, targets: values(params.month) }
  else throw new Error(`Preview blocks live request: ${url}`)
  return { config, data: structuredClone(body), status: 200, statusText: 'OK', headers: {} }
}
const pinia = createPinia()
useAuthStore(pinia).user = {
  id: 'preview',
  principalScope: 'TENANT',
  username: 'preview',
  displayName: '设计预览',
  roles: [],
  permissions: [
    'integration:dhb:read',
    'integration:dhb:write',
    'hr:targets:read',
    'hr:targets:write',
    'hr:employee:read',
    'hr:employee:update',
    'hr:employee:create',
    'analytics:dashboard:read',
    'analytics:refresh:write',
  ],
  tenantId: 'preview',
  tenantName: '设计预览 · 示例数据',
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
      meta: { applicationCode: 'SUPPLY_CHAIN', title: '人事管理' },
      children: [
        { path: 'hr/target-settings', component: Targets, meta: { title: '指标设置' } },
        {
          path: ':rest(.*)*',
          component: { render: () => h('p', '菜单导航预览，请返回人事管理 → 员工档案。') },
          meta: { title: '菜单导航' },
        },
      ],
    },
  ],
})
await router.push('/supply-chain/hr/target-settings')
await router.isReady()
createApp({ render: () => h(RouterView) })
  .use(pinia)
  .use(router)
  .use(ElementPlus, { locale: zhCn })
  .mount('#app')
