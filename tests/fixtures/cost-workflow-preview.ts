/** 独立测试入口：正式 Shell / 成本组件，所有 API 在本地拦截，禁止真实写入。 */
import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '@/assets/styles/index.scss'
import ConsoleShell from '@/layouts/ConsoleShell.vue'
import CostManagementView from '@/views/supply-chain/cost/CostManagementView.vue'
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
  REIMBURSEMENT_EXPENSE_TYPE: { OFFICE: '办公用品', TRAVEL: '差旅报销', TAXI: '打车报销' },
  PRODUCT_UNIT: { BOX: '箱' },
  COST_PREMISES_TYPE: { OFFICE: '办公室', WAREHOUSE: '仓库' },
}
function records(category: string): CostRecord[] {
  return ['DRAFT', 'CONFIRMED', 'VOID'].map((statusCode, index) => ({
    id: `fixture-${category}-${index}`,
    documentNo: `TEST-CST-202610-${index + 1}`,
    categoryCode: category.toUpperCase(),
    statusCode,
    revision: 1,
    createdBy: '测试录入员工',
    updatedBy: '测试核对员工',
    createdTime: '2026-10-19T03:52:49.014886Z',
    updatedTime: '2026-10-19T06:02:28.392666Z',
    ownerEmployeeName: '测试经办员工',
    warehouseName: '测试城市仓',
    sources: [],
    data: {
      requestId: `fixture-${index}`,
      revision: 1,
      title:
        category === 'expenses'
          ? ['测试办公用品报销', '测试差旅报销', '重复打车报销已作废'][index]
          : category === 'marketing'
            ? ['测试活动费用待补', '十月测试广告投放', '重复登记已作废'][index]
            : ['测试费用待补金额', '测试费用已核对', '重复登记已作废'][index],
      cityCode: 'TEST-CITY',
      cityName: '测试城市',
      costDate: '2026-10-19',
      costMonth: '2026-10',
      typeCode:
        category === 'expenses'
          ? ['OFFICE', 'TRAVEL', 'TAXI'][index]
          : category === 'marketing'
            ? 'ADVERTISING'
            : category === 'office-rentals'
              ? 'OFFICE'
              : category === 'warehouse-rentals'
                ? 'WAREHOUSE'
                : null,
      amount: category === 'expenses' ? 120 : [null, 1200, 99][index],
      paymentStatusCode: 'UNPAID',
      ownerEmployeeCode: 'EMPTEST',
      ownerName: '测试经办员工',
      departmentId: 1,
      payeeName: '测试合作机构',
      remark: '仅用于隔离验证',
      reason: '',
      logistics:
        category === 'logistics'
          ? {
              legCode: ['PURCHASE', 'TRANSFER', 'DELIVERY'][index],
              entryMode: 'NONE',
              senderName: ['测试厂家', '测试中心仓', '测试城市仓'][index],
              receiverName: ['测试中心仓', '测试城市仓', '测试客户'][index],
              sourceIds: [],
              voucherIds: [],
              carrierName: '测试承运公司',
              trackingNo: 'TEST-WAYBILL',
              transportMethodCode: 'ROAD',
              payerCode: 'COMPANY',
            }
          : null,
      rental: category.includes('rentals')
        ? {
            premisesType: category === 'office-rentals' ? 'OFFICE' : 'WAREHOUSE',
            premisesName: '测试租赁场地',
            warehouseId: null,
            area: 120,
            contractNo: '',
            leaseFrom: '',
            leaseTo: '',
            deposit: null,
          }
        : null,
      marketing:
        category === 'marketing'
          ? { channelName: '测试广告平台', serviceFrom: '2026-10-01', serviceTo: '2026-10-31' }
          : null,
      goods: ['purchases', 'losses'].includes(category)
        ? {
            productName: '测试商品',
            specification: '测试规格',
            unit: 'BOX',
            unitPrice: 120,
            quantity: 10,
            supplierName: '测试厂家',
            location: '测试仓库',
            lossReason: '测试破损',
          }
        : null,
    } as CostCommand,
  }))
}
// Adapter 拦截全部请求，未实现的请求立即报错，绝不回退到真实后端。
apiClient.defaults.adapter = async (config) => {
  const url = config.url || '',
    q = config.params || {}
  if (config.method !== 'get') throw new Error('隔离页面不执行写入；保存、确认等由组件测试验证')
  let data: unknown
  if (url.includes('/business-settings/')) {
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
  } else if (url.endsWith('/cost-city-references')) data = [{ code: 'TEST-CITY', name: '测试城市' }]
  else if (url.endsWith('/employees'))
    data = [
      {
        employeeCode: 'EMPTEST',
        employeeName: '测试经办员工',
        departmentId: 1,
        departmentName: '测试部门',
      },
    ]
  else if (/\/(warehouses|references|attachments|sources|customers|purchase-orders)$/.test(url))
    data = []
  else if (url.endsWith('/history')) {
    const row = records('logistics')[1]!
    data = [
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
        (!q.cityCode || row.data.cityCode === q.cityCode),
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
      pendingCount: rows.filter((row) => row.statusCode === 'DRAFT').length,
      items: rows.map((row) =>
        category === 'expenses'
          ? {
              ...row,
              employeeName: row.ownerEmployeeName,
              data: { ...row.data, employeeCode: 'EMPTEST' },
            }
          : row,
      ),
    }
    // HR 实际分页契约没有金额汇总字段，隔离样例不能假装接口已具备该能力。
    if (category === 'expenses') {
      const page = data as { total: number; begin: number; step: number; items: unknown[] }
      data = { total: page.total, begin: page.begin, step: page.step, items: page.items }
    }
  } else throw new Error(`隔离数据未覆盖：${url}`)
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
        { path: 'bi/city-cost', component: handoff, meta: { title: '成本数据看板' } },
      ],
    },
  ],
})
setRole('operator')
await router.push('/supply-chain/cost/logistics')
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
