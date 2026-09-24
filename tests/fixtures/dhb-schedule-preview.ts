/** Isolated preview of the production page; every request is intercepted. No live sync. */
import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory, RouterView } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '@/assets/styles/index.scss'
import ConsoleShell from '@/layouts/ConsoleShell.vue'
import DhbScheduleView from '@/views/supply-chain/dhb/DhbScheduleView.vue'
import { useAuthStore } from '@/stores/auth'
import { useNavigationStore } from '@/stores/navigation'
import { apiClient } from '@/api/core/client'
import type { NavigationNode } from '@/types/management'
import type { ScheduleSettings, ScheduleView } from '@/api/core/sync-schedule'
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
  node('supply.hr.menu', '人事管理', '/supply-chain/hr', 'Avatar'),
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
const connector = '00000000-0000-4000-8000-000000000001'
const draft = (key: string): ScheduleView => ({
  key,
  settings: { enabled: false, mode: 'FIXED_DELAY', intervalMinutes: 60, dailyTime: null },
  version: 0,
  managed: false,
  nextRunAt: null,
  lastStartedAt: null,
  lastFinishedAt: null,
  lastStatus: null,
  lastMessage: null,
  runningJobId: null,
})
function previewNext(settings: ScheduleSettings) {
  if (!settings.enabled) return null
  const now = new Date('2026-09-23T10:00:00Z')
  if (settings.mode === 'FIXED_DELAY')
    return new Date(now.getTime() + settings.intervalMinutes! * 60000).toISOString()
  const next = new Date(`2026-09-23T${settings.dailyTime}:00+08:00`)
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString()
}
const plans: Record<string, ScheduleView> = { dhb: draft(connector), bi: draft('BI_REFRESH') }
apiClient.defaults.adapter = async (config) => {
  let body: unknown
  if (config.url?.endsWith('/sync-tasks')) body = [{ connectorId: connector }]
  else if (config.url?.includes('/schedules/') || config.url?.endsWith('/sync-schedules/bi')) {
    const key = config.url.endsWith('/bi') ? 'bi' : 'dhb'
    if (config.method === 'put') {
      const command = JSON.parse(config.data)
      if (command.expectedVersion !== plans[key]!.version)
        throw new Error('配置已变化，请刷新后再保存')
      plans[key] = {
        ...plans[key]!,
        settings: command.settings,
        version: plans[key]!.version + 1,
        managed: true,
        nextRunAt: previewNext(command.settings),
      }
    }
    body = structuredClone(plans[key])
  } else throw new Error(`Preview blocks live request: ${config.url}`)
  return { config, data: body, status: 200, statusText: 'OK', headers: {} }
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
    'hr:employee:sync',
    'analytics:dashboard:read',
    'analytics:refresh:write',
  ],
  tenantId: 'preview',
  tenantName: '隔离预览 · 不执行真实同步',
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
      meta: { applicationCode: 'SUPPLY_CHAIN', title: '数据同步' },
      children: [
        { path: 'integration/schedules', component: DhbScheduleView, meta: { title: '定时任务' } },
        {
          path: ':rest(.*)*',
          component: { render: () => h('p', '菜单导航预览，请返回数据同步 → 定时任务。') },
          meta: { title: '菜单导航' },
        },
      ],
    },
  ],
})
await router.push('/supply-chain/integration/schedules')
await router.isReady()
createApp({ render: () => h(RouterView) })
  .use(pinia)
  .use(router)
  .use(ElementPlus)
  .mount('#app')
