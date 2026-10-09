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
import type {
  TargetSettings,
  TargetHistory,
  TargetBatch,
  DefaultBatch,
} from '@/api/core/bi-target-settings'
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
const byMonth = new Map<string, TargetSettings['overrides']>()
const defaults: TargetSettings['defaults'] = []
const history = new Map<string, TargetHistory[]>()
function overrides(month: string) {
  if (!byMonth.has(month))
    byMonth.set(
      month,
      [
        { dimensionType: 'CITY', code: 'C0', metric: 'SALES_AMOUNT', value: 150000 },
        { dimensionType: 'CITY', code: 'C0', metric: 'NEW_CUSTOMER', value: 250 },
        { dimensionType: 'CITY', code: 'C1', metric: 'SALES_AMOUNT', value: 120000 },
        { dimensionType: 'SALES_OWNER', code: 'XS001', metric: 'SALES_AMOUNT', value: 60000 },
        { dimensionType: 'SALES_OWNER', code: 'XS001', metric: 'RECEIPT_AMOUNT', value: 30000 },
      ].map((x) => ({
        ...x,
        revision: 1,
        deleted: false,
        updatedBy: '示例人事',
        updatedAt: '2026-10-09T07:30:00Z',
      })) as TargetSettings['overrides'],
    )
  return byMonth.get(month)!
}
apiClient.defaults.adapter = async (config) => {
  const url = config.url || ''
  const params = config.params || {}
  let body: unknown = null
  if (url.endsWith('/target-settings/history'))
    body = history.get(`${params.month}:${params.dimensionType}:${params.code}`) || []
  else if (url.endsWith('/target-settings/defaults') && config.method === 'put') {
    if (readonly) throw new Error('当前账号仅可查看')
    const batch = JSON.parse(String(config.data)) as DefaultBatch
    for (const change of batch.changes) {
      const old = defaults.find(
        (d) =>
          d.dimensionType === batch.dimensionType &&
          d.effectiveMonth === batch.effectiveMonth &&
          d.metric === change.metric,
      )
      if ((old?.revision || 0) !== change.expectedRevision)
        throw new Error('指标已被其他人修改，请刷新后重试')
    }
    for (const change of batch.changes) {
      const old = defaults.find(
        (d) =>
          d.dimensionType === batch.dimensionType &&
          d.effectiveMonth === batch.effectiveMonth &&
          d.metric === change.metric,
      )
      const next = {
        dimensionType: batch.dimensionType,
        effectiveMonth: batch.effectiveMonth,
        metric: change.metric,
        value: change.value,
        revision: change.expectedRevision + 1,
      }
      if (old) Object.assign(old, next)
      else defaults.push(next)
    }
  } else if (url.endsWith('/target-settings') && config.method === 'put') {
    if (readonly) throw new Error('当前账号仅可查看')
    const batch = JSON.parse(String(config.data)) as TargetBatch
    const list = overrides(batch.month)
    for (const c of batch.changes) {
      const old = list.find(
        (o) => o.dimensionType === c.dimensionType && o.code === c.code && o.metric === c.metric,
      )
      if ((old?.revision || 0) !== c.expectedRevision)
        throw new Error('指标已被其他人修改，请刷新后重试')
    }
    for (const c of batch.changes) {
      const old = list.find(
        (o) => o.dimensionType === c.dimensionType && o.code === c.code && o.metric === c.metric,
      )
      const next = {
        dimensionType: c.dimensionType,
        code: c.code,
        metric: c.metric,
        value: c.value ?? 0,
        deleted: c.value === null,
        revision: c.expectedRevision + 1,
        updatedBy: '示例人事',
        updatedAt: new Date().toISOString(),
      }
      if (old) Object.assign(old, next)
      else list.push(next)
      const key = `${batch.month}:${c.dimensionType}:${c.code}`
      history.set(key, [
        {
          metric: c.metric,
          value: c.value ?? 0,
          deleted: c.value === null,
          revision: next.revision,
          reason: batch.reason,
          actor: '示例人事',
          occurredAt: next.updatedAt,
        },
        ...(history.get(key) || []),
      ])
    }
  } else if (url.endsWith('/target-settings'))
    body = {
      month: params.month,
      subjects,
      overrides: overrides(params.month),
      defaults,
      defaultsWritable: !readonly,
    }
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
    'analytics:targets:write',
    'analytics:targets:defaults',
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
