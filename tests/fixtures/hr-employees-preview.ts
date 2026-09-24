/** Isolated preview of the production page; every request is intercepted. No live sync. */
import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory, RouterView } from 'vue-router'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import '@/assets/styles/index.scss'
import ConsoleShell from '@/layouts/ConsoleShell.vue'
import Employees from '@/views/supply-chain/hr/HrEmployeeManagementView.vue'
import type { HrEmployeeRecord, DhbBindingRisk } from '@/api/core/hr'
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
    node('supply.hr.employees', '员工档案', '/supply-chain/hr/employees', 'User'),
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
const departments = [
  {
    id: 1,
    parentId: null,
    departmentName: '瑞盖文化传媒有限公司',
    statusCode: 'ACTIVE',
    sortOrder: 0,
  },
  { id: 2, parentId: 1, departmentName: '运营部', statusCode: 'ACTIVE', sortOrder: 0 },
  { id: 3, parentId: 1, departmentName: '销售部', statusCode: 'ACTIVE', sortOrder: 1 },
  ...[
    '北京市',
    '杭州市',
    '成都市',
    '深圳市',
    '武汉市',
    '石家庄',
    '西安市',
    '苏州市',
    '上海市',
    '金华市',
    '长沙市',
    '重庆市',
    '南京市',
    '洛阳市',
    '广州市',
    '东莞市',
    '沈阳市',
  ].map((name, i) => ({
    id: i + 4,
    parentId: 3,
    departmentName: name,
    statusCode: 'ACTIVE',
    sortOrder: i,
  })),
]
const names = ['林浩', '周言', '许晨', '赵宁', '陈果', '陈曦', '孙莉', '何凯', '高远', '宋阳']
const employees: HrEmployeeRecord[] = names.map((name, i) => ({
  id: String(i + 1),
  employeeCode: `EMP2026091600${String(10 - i).padStart(2, '0')}`,
  employeeName: name,
  mobile: `180000058${18 + i}`,
  email: null,
  employmentStatus: 'ACTIVE',
  positionCode: 'OPS',
  positionName: '数据运营',
  departmentId: 2,
  departmentName: '运营部',
  entryDate: `2025-0${(i % 9) + 1}-01T00:00:00Z`,
  createdTime: `2026-09-${String(24 - i).padStart(2, '0')}T01:20:00Z`,
  dhbStaffIds: i === 3 ? [] : [`source-${i}`],
  dhbAccountNames: i === 3 ? [] : [i === 0 ? 'lh18049975818' : `user180499758${18 + i}`],
  dhbReviewCount: i === 2 ? 1 : 0,
  revision: 0,
  profile: null,
  jobGrade: 'S1',
  jobCategory: null,
  leaderEmployeeCode: null,
  leaderName: null,
  regionName: null,
  cityName: null,
  sourceSystem: null,
  sourceDocumentNo: null,
  sourceCreatedAt: null,
  sourceUpdatedAt: null,
  leaveDate: null,
  remark: null,
  createdBy: null,
  updatedBy: null,
  updatedTime: null,
}))
let risks: DhbBindingRisk[] = [
  {
    bindingId: 1,
    version: 1,
    employeeId: '3',
    employeeCode: employees[2]!.employeeCode,
    employeeName: '许晨',
    mobile: '18000005820',
    departmentName: '运营部',
    sourceStaffId: 'source-2',
    accountName: employees[2]!.dhbAccountNames![0]!,
    sourceEmployeeName: '（测试）许晨',
    sourceMobile: '18000005820',
    reason: '来源姓名与员工档案不一致',
  },
]
apiClient.defaults.adapter = async (config) => {
  let body: unknown
  const url = config.url || ''
  if (url.endsWith('/employee-departments')) body = departments
  else if (url.endsWith('/positions'))
    body = { total: 1, items: [{ id: '1', positionCode: 'OPS', positionName: '数据运营' }] }
  else if (url.endsWith('/dhb-link-risks')) body = risks
  else if (url.endsWith('/confirm')) {
    const command = JSON.parse(String(config.data))
    const risk = risks[0]
    if (!risk || command.expectedVersion !== risk.version) throw new Error('关联已更新，请刷新')
    const old = employees.find((e) => e.id === String(risk.employeeId))!
    const target = employees.find((e) => e.id === String(command.targetEmployeeId))
    if (!target) throw new Error('目标员工不存在')
    if (target !== old) {
      old.dhbStaffIds = old.dhbStaffIds?.filter((id) => id !== risk.sourceStaffId)
      old.dhbAccountNames = old.dhbAccountNames?.filter((name) => name !== risk.accountName)
      target.dhbStaffIds = [...(target.dhbStaffIds || []), risk.sourceStaffId]
      target.dhbAccountNames = [...(target.dhbAccountNames || []), risk.accountName!]
    }
    old.dhbReviewCount = 0
    risks = []
    body = true
  } else if (url.endsWith('/employees')) {
    const q = config.params || {}
    let items = employees.filter(
      (e) =>
        !q.keyword ||
        [e.employeeName, e.employeeCode, e.mobile || '', ...(e.dhbAccountNames || [])].some((s) =>
          s.includes(q.keyword),
        ),
    )
    if (q.departmentId && ![1, 2].includes(Number(q.departmentId))) items = []
    if (q.departmentId === 1 && q.includeSubDepartments === false) items = []
    if (q.positionCode && q.positionCode !== 'OPS') items = []
    if (q.employmentStatus) items = items.filter((e) => e.employmentStatus === q.employmentStatus)
    if (q.jobGrade) items = items.filter((e) => e.jobGrade === q.jobGrade)
    const key = (q.sortBy || 'createdTime') as keyof HrEmployeeRecord
    items = items
      .slice()
      .sort(
        (a, b) =>
          String(a[key] || '').localeCompare(String(b[key] || ''), 'zh-CN') *
          (q.sortDirection === 'asc' ? 1 : -1),
      )
    body = {
      total: items.length,
      begin: q.begin || 0,
      step: q.step || 20,
      items: items.slice(q.begin || 0, (q.begin || 0) + (q.step || 20)),
    }
  } else if (/employees\/[^/]+\/assignments$/.test(url)) body = []
  else if (/employees\/[^/]+$/.test(url)) body = employees.find((e) => url.endsWith('/' + e.id))
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
    'hr:employee:sync',
    'hr:employee:read',
    'hr:employee:update',
    'hr:employee:create',
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
      meta: { applicationCode: 'SUPPLY_CHAIN', title: '人事管理' },
      children: [
        { path: 'hr/employees', component: Employees, meta: { title: '员工档案' } },
        {
          path: ':rest(.*)*',
          component: { render: () => h('p', '菜单导航预览，请返回人事管理 → 员工档案。') },
          meta: { title: '菜单导航' },
        },
      ],
    },
  ],
})
await router.push('/supply-chain/hr/employees')
await router.isReady()
createApp({ render: () => h(RouterView) })
  .use(pinia)
  .use(router)
  .use(ElementPlus, { locale: zhCn })
  .mount('#app')
