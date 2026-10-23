/** 独立测试入口：正式 Shell / 成本组件，所有 API 在本地拦截；录入仅存内存，看板读取后端回归输出。 */
import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '@/assets/styles/index.scss'
import ConsoleShell from '@/layouts/ConsoleShell.vue'
import CostManagementView from '@/views/supply-chain/cost/CostManagementView.vue'
import CostDashboardView from '@/views/supply-chain/bi/CostDashboardView.vue'
import market from './cost-business-market.json'
import dashboardContracts from './cost-business-contracts.json'
import type { CostQuery } from '@/api/core/bi-cost-dashboard'
import { apiClient } from '@/api/core/client'
import { useAuthStore } from '@/stores/auth'
import { useNavigationStore } from '@/stores/navigation'
import { useSupplyAuthorizationStore } from '@/stores/supply-authorization'
import type { NavigationNode } from '@/types/management'
import type { CostCommand, CostRecord } from '@/api/core/cost'

const categories = [
  ['purchases', '进货记录', 'erp:cost:purchase'],
  ['losses', '损耗记录', 'erp:cost:loss'],
  ['logistics', '运费', 'order:logistics-cost'],
  ['warehouse-rentals', '仓储费用', 'erp:cost:rental'],
  ['office-rentals', '办公室费用', 'erp:cost:rental'],
  ['marketing', '营销费用', 'erp:cost:marketing'],
] as const
function node(
  key: string,
  title: string,
  path: string | null,
  children: NavigationNode[] = [],
): NavigationNode {
  return {
    id: key,
    code: key,
    routeKey: key,
    displayName: title,
    routePath: path,
    children,
    visible: true,
    keepAlive: true,
    parentId: null,
    type: path ? 'PAGE' : 'MENU',
    iconKey: 'Document',
    sortOrder: 0,
    permissionCode: null,
  }
}
const costNodes = categories.map(([path, title]) =>
  node(`supply.cost.${path}`, title, `/supply-chain/cost/${path}`),
)
const hrNodes = [
  node('supply.hr.payroll', '月度薪酬', '/supply-chain/hr/payroll'),
  node('supply.hr.expenses', '报销费用', '/supply-chain/hr/expenses'),
]
const biNode = node('supply.bi.city-cost', '成本数据看板', '/supply-chain/bi/city-cost')
const dictionaries: Record<string, Record<string, string>> = {
  COST_STATUS: { DRAFT: '待确认', CONFIRMED: '已确认', VOID: '已作废' },
  COST_PAYMENT_STATUS: { UNPAID: '未付款', PAID: '已付款' },
  COST_LOGISTICS_LEG: {
    PURCHASE: '厂家 → 中心仓',
    TRANSFER: '中心仓 → 城市仓',
    DELIVERY: '城市仓 → 客户',
  },
  COST_PAYER: { COMPANY: '公司承担', SUPPLIER: '供应商承担', CUSTOMER: '客户承担' },
  COST_TRANSPORT_METHOD: { EXPRESS: '快递', ROAD: '公路运输' },
  MARKETING_EXPENSE_TYPE: { PROMOTION: '推广', ADVERTISING: '广告', ENDORSEMENT: '代言' },
  REIMBURSEMENT_EXPENSE_TYPE: {
    OFFICE_SUPPLIES: '办公用品',
    TRAVEL: '差旅报销',
    ACCOMMODATION: '住宿',
    TAXI: '打车报销',
    FREIGHT: '货物运输',
    OFFICE_RENT: '办公室租赁',
    FIXED_ASSET: '办公固定资产',
  },
  PRODUCT_UNIT: { BOX: '箱' },
  COST_PREMISES_TYPE: { OFFICE: '办公室', WAREHOUSE: '仓库' },
}
const state = market.records
  .filter((r) => r.dataset !== 'HR_PAYROLL_COST')
  .map((record) => {
    const f = record.fields
    const data = JSON.parse(f.data_json)
    const category =
      record.source === 'HR'
        ? 'expenses'
        : record.source === 'ORDER'
          ? 'logistics'
          : f.category_code === 'RENTAL'
            ? f.premises_type === 'OFFICE'
              ? 'office-rentals'
              : 'warehouse-rentals'
            : f.category_code === 'PURCHASE'
              ? 'purchases'
              : f.category_code === 'LOSS'
                ? 'losses'
                : 'marketing'
    const form: CostCommand = {
      requestId: f.id,
      revision: 1,
      title: f.title,
      typeCode: f.type_code || data.logistics?.legCode || data.rental?.premisesType || 'PROMOTION',
      cityCode: f.city_code,
      cityName: '武汉测试归属',
      departmentId: 10,
      ownerEmployeeCode: 'E1',
      costDate: f.cost_date,
      costMonth: data.costMonth || f.cost_date.slice(0, 7),
      amount: Number(f.amount),
      paymentStatusCode: 'UNPAID',
      logistics: null,
      rental: null,
      remark: '虚构测试业务',
      reason: '',
      ...data,
    }
    form.amount = Number(f.amount)
    for (const part of [form.goods, form.expense, form.rental])
      if (part)
        for (const key of ['quantity', 'unitPrice', 'area', 'deposit'])
          if (key in part && (part as Record<string, unknown>)[key] != null)
            (part as Record<string, unknown>)[key] = Number((part as Record<string, unknown>)[key])
    return {
      category,
      row: {
        id: f.id,
        documentNo: f.document_no,
        categoryCode: category === 'expenses' ? 'EXPENSE' : f.category_code,
        statusCode: f.status_code,
        revision: 1,
        data: form,
        sources: [],
        warehouseName: data.rental?.premisesName || null,
        ownerEmployeeName: '测试员工甲',
        createdBy: '测试录入员工',
        updatedBy: '测试财务',
        createdTime: '2026-10-21T01:00:00Z',
        updatedTime: '2026-10-21T01:00:00Z',
      } as CostRecord,
    }
  })
function records(category: string) {
  return state.filter((r) => r.category === category).map((r) => r.row)
}
function expenseWire(row: CostRecord) {
  return {
    ...row,
    employeeName: row.ownerEmployeeName,
    data: { ...row.data, employeeCode: row.data.ownerEmployeeCode },
  }
}
const mutations: Record<string, unknown[]> = {}
// Adapter 拦截全部请求，未实现的请求立即报错，绝不回退到真实后端。
apiClient.defaults.adapter = async (config) => {
  const url = config.url || '',
    q = config.params || {}

  let data: unknown
  if (url.includes('/analytics/supply/cost-dashboard')) {
    const query = q as CostQuery
    if (
      (query.year && query.year !== 2026) ||
      (query.month != null && query.month !== 10) ||
      query.city ||
      query.dimensionKey ||
      query.search ||
      (query.page && query.page !== 1) ||
      (query.status && query.status !== 'CONFIRMED') ||
      (query.payment && query.payment !== 'ALL')
    )
      throw new Error('此隔离页面仅提供2026年10月后端回归计算快照；其他筛选请在联调环境验收')
    const key = `${query.scope || 'opex'}:${query.category || '_'}:${query.dimension || '_'}`
    const contract = (dashboardContracts as Record<string, { report: unknown; records: unknown }>)[
      key
    ]
    if (!contract) throw new Error('该基准快照未提供此场景')
    if (url.endsWith('/overview')) data = contract.report
    else if (url.endsWith('/records')) data = contract.records
    else throw new Error('此隔离快照不连接原业务服务')
  } else if (config.method !== 'get') {
    if (!['post', 'put'].includes(config.method || '')) throw new Error('隔离页面不支持此操作')
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
    if (url.includes('/attachments'))
      throw new Error('隔离页面不连接附件存储；请用凭据编号验证表单')
    const parts = url.split('/'),
      action = parts.at(-1),
      id =
        action === 'confirm' || action === 'void'
          ? parts.at(-2)
          : config.method === 'put'
            ? action
            : null
    const found = id ? state.find((r) => r.row.id === id) : null
    if (id && !found) throw new Error('测试单据不存在')
    if (found && found.row.revision !== body.revision) throw new Error('记录已修改，请刷新')
    if (found && (action === 'confirm' || action === 'void')) {
      if (action === 'confirm' && found.category === 'expenses' && !found.row.data.expense?.purpose)
        throw new Error('请先补充费用用途及凭据')
      found.row.statusCode = action === 'confirm' ? 'CONFIRMED' : 'VOID'
      found.row.revision++
      data = found.category === 'expenses' ? expenseWire(found.row) : found.row
    } else {
      const category = url.includes('/hr/expenses')
        ? 'expenses'
        : url.includes('logistics-costs')
          ? 'logistics'
          : url.includes('warehouse-rentals')
            ? body.rental?.premisesType === 'OFFICE'
              ? 'office-rentals'
              : 'warehouse-rentals'
            : parts.at(config.method === 'put' ? -2 : -1)!
      const row: CostRecord = {
        ...(found?.row || {}),
        id: id || crypto.randomUUID(),
        documentNo: found?.row.documentNo || `TEST-NEW-${state.length + 1}`,
        categoryCode: category === 'expenses' ? 'EXPENSE' : category.toUpperCase(),
        statusCode: 'DRAFT',
        revision: (found?.row.revision || 0) + 1,
        data: { ...body, ownerEmployeeCode: body.employeeCode || body.ownerEmployeeCode },
        sources: [],
        warehouseName: null,
        ownerEmployeeName: '测试员工甲',
        createdBy: '测试录入员工',
        updatedBy: '测试财务',
        createdTime: found?.row.createdTime || new Date().toISOString(),
        updatedTime: new Date().toISOString(),
      }
      if (found) found.row = row
      else state.push({ category, row })
      mutations[row.id] ||= []
      mutations[row.id]!.push({
        action: 'EXPENSE_SAVE',
        actorId: '测试财务',
        occurredTime: row.updatedTime,
        snapshot: structuredClone(row),
      })
      data = category === 'expenses' ? expenseWire(row) : row
    }
  } else if (url.includes('/business-settings/')) {
    const code = q.dictionaryCode
    data = {
      dictionary: {
        id: code,
        dictionaryCode: code,
        dictionaryName: code,
        dictionaryType: null,
        remark: null,
        revision: 1,
      },
      items: Object.entries(dictionaries[code] || {}).map(([value, label], ordinal) => ({
        id: value,
        dictionaryCode: code,
        dictionaryItemCode: value,
        dictionaryItemName: label,
        dictionaryItemLevel: 1,
        parentDictionaryItemCode: null,
        ordinal,
        remark: null,
        revision: 1,
      })),
    }
  } else if (url.endsWith('/cost-city-references')) data = [{ code: '4201', name: '武汉测试归属' }]
  else if (url.endsWith('/employees'))
    data = [
      {
        employeeCode: 'E1',
        employeeName: '测试员工甲',
        departmentId: 1,
        departmentName: '测试部门',
      },
    ]
  else if (/\/(warehouses|references|attachments|sources|customers|purchase-orders)$/.test(url))
    data = []
  else if (url.endsWith('/history')) {
    const row = state.find((r) => url.includes(r.row.id))?.row || records('logistics')[1]!
    data = mutations[row.id] || [
      {
        action: 'CONFIRM',
        actorId: '测试核对员工',
        reason: '核对运输凭据',
        occurredTime: row.updatedTime,
        snapshot: row,
      },
    ]
  } else if (
    /\/(logistics-costs|purchases|losses|warehouse-rentals|marketing|expenses)$/.test(url)
  ) {
    const category = url.endsWith('logistics-costs')
      ? 'logistics'
      : url.endsWith('warehouse-rentals') && q.typeCode === 'OFFICE'
        ? 'office-rentals'
        : url.split('/').at(-1)!
    const rows = records(category).filter(
      (row) =>
        (!q.statusCode || row.statusCode === q.statusCode) &&
        (!q.missingAmount || (row.data.amount == null && row.statusCode !== 'VOID')) &&
        (!q.typeCode || category !== 'logistics' || row.data.logistics?.legCode === q.typeCode) &&
        (!q.cityCode || row.data.cityCode === q.cityCode) &&
        (!q.costMonth || row.data.costMonth === q.costMonth) &&
        (!q.documentNo || row.documentNo.includes(q.documentNo)),
    )
    data = {
      total: rows.length,
      begin: q.begin || 0,
      step: q.step || 20,
      registeredAmount: rows.reduce(
        (sum, row) => sum + (row.statusCode === 'VOID' ? 0 : row.data.amount || 0),
        0,
      ),
      confirmedAmount: rows
        .filter((row) => row.statusCode === 'CONFIRMED')
        .reduce((sum, row) => sum + (row.data.amount || 0), 0),
      missingAmountCount: rows.filter((row) => row.statusCode !== 'VOID' && row.data.amount == null)
        .length,
      paidAmount: rows
        .filter((r) => r.statusCode === 'CONFIRMED' && r.data.paymentStatusCode === 'PAID')
        .reduce((sum, r) => sum + (r.data.amount || 0), 0),
      pendingCount: rows.filter((row) => row.statusCode === 'DRAFT').length,
      items: rows.map((row) =>
        category === 'expenses'
          ? {
              ...row,
              employeeName: row.ownerEmployeeName,
              data: { ...row.data, employeeCode: 'E1' },
            }
          : row,
      ),
    }
  } else {
    const found = state.find((r) => url.endsWith('/' + r.row.id))
    if (!found) throw new Error(`隔离数据未覆盖：${url}`)
    data = found.category === 'expenses' ? expenseWire(found.row) : found.row
  }
  return { config, data, status: 200, statusText: 'OK', headers: {} }
}
const pinia = createPinia()
const auth = useAuthStore(pinia),
  navigation = useNavigationStore(pinia),
  access = useSupplyAuthorizationStore(pinia)
auth.user = {
  id: 'fixture',
  principalScope: 'TENANT',
  tenantId: 'fixture',
  tenantName: '虚构数据验证',
  username: 'fixture',
  displayName: '测试用户',
  roles: [],
  permissions: [],
}
function setRole(role: string) {
  const cost =
    role === 'marketing'
      ? costNodes.filter((node) => node.routePath?.endsWith('/marketing'))
      : role === 'hr'
        ? []
        : costNodes
  navigation.navigationByApplication.SUPPLY_CHAIN = [
    ...(cost.length ? [node('supply.cost.menu', '成本管理', null, cost)] : []),
    ...(role !== 'marketing' ? [node('supply.hr.menu', '人事管理', null, hrNodes)] : []),
    ...(role === 'operator' || role === 'boss'
      ? [node('supply.bi.menu', '数据看板', null, [biNode])]
      : []),
  ]
  navigation.loadedApplications = ['SUPPLY_CHAIN']
  const domains =
    role === 'marketing'
      ? ['erp:cost:marketing']
      : role === 'hr'
        ? ['hr:expense', 'hr:payroll']
        : [
            ...categories.map((item) => item[2]),
            'hr:expense',
            'hr:payroll',
            'analytics:cost-dashboard',
          ]
  access.context = {
    mode: 'ACTIVE',
    initialized: true,
    canInitialize: false,
    version: 1,
    permissions: domains.flatMap((domain) =>
      (role === 'boss' ? ['read', 'export'] : ['read', 'write', 'confirm', 'void', 'export']).map(
        (action) => `${domain}:${action}`,
      ),
    ),
  }
}
const handoff = {
  setup: () => () =>
    h('section', [
      h('h1', '原业务入口'),
      h('p', '此隔离页只验证成本流程与入口授权；薪酬和看板请在真实登录环境核验。'),
    ]),
}
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    {
      path: '/supply-chain',
      component: ConsoleShell,
      meta: { applicationCode: 'SUPPLY_CHAIN', title: '成本流程验证' },
      children: [
        ...categories.map(([key, title]) => ({
          path: `cost/${key}`,
          component: CostManagementView,
          meta: { title },
        })),
        { path: 'hr/expenses', component: CostManagementView, meta: { title: '报销费用' } },
        { path: 'hr/payroll', component: handoff, meta: { title: '月度薪酬' } },
        { path: 'bi/city-cost', component: CostDashboardView, meta: { title: '成本数据看板' } },
      ],
    },
  ],
})
setRole('operator')
await router.push('/supply-chain/hr/expenses')
await router.isReady()
createApp({ render: () => h(RouterView) })
  .use(pinia)
  .use(router)
  .use(ElementPlus)
  .mount('#app')
document
  .querySelector<HTMLSelectElement>('#preview-role')!
  .addEventListener('change', async (event) => {
    const role = (event.target as HTMLSelectElement).value
    setRole(role)
    await router.push(
      role === 'marketing'
        ? '/supply-chain/cost/marketing'
        : role === 'hr'
          ? '/supply-chain/hr/expenses'
          : '/supply-chain/cost/logistics',
    )
  })
