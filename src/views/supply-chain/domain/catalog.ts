export interface SupplyDomainPage {
  domainKey: string
  domainTitle: string
  groupTitle: string | null
  title: string
  routeKey: string
  path: string
  owner: string
}

interface PageSeed {
  key: string
  title: string
}
interface GroupSeed {
  key: string
  title: string
  pages: PageSeed[]
}

const groupPages = (
  domainKey: string,
  domainTitle: string,
  owner: string,
  groups: GroupSeed[],
): SupplyDomainPage[] =>
  groups.flatMap((group) =>
    group.pages.map((item) => ({
      domainKey,
      domainTitle,
      groupTitle: group.title,
      title: item.title,
      routeKey: `supply.${domainKey}.${group.key}.${item.key}`,
      path: `/supply-chain/${domainKey}/${group.key}/${item.key}`,
      owner,
    })),
  )

const directPages = (
  domainKey: string,
  domainTitle: string,
  owner: string,
  pages: PageSeed[],
): SupplyDomainPage[] =>
  pages.map((item) => ({
    domainKey,
    domainTitle,
    groupTitle: null,
    title: item.title,
    routeKey: `supply.${domainKey}.${item.key}`,
    path: `/supply-chain/${domainKey}/${item.key}`,
    owner,
  }))

const erpProductCenterPages: SupplyDomainPage[] = [
  {
    domainKey: 'erp',
    domainTitle: 'ERP',
    groupTitle: '商品中心',
    title: '商品管理',
    routeKey: 'supply.erp.master-data.products',
    path: '/supply-chain/erp/master-data/products',
    owner: 'erp-core-service',
  },
  {
    domainKey: 'erp',
    domainTitle: 'ERP',
    groupTitle: '商品中心',
    title: '商品分类',
    routeKey: 'supply.erp.master-data.attributes.categories',
    path: '/supply-chain/erp/master-data/attributes/categories',
    owner: 'erp-core-service',
  },
  {
    domainKey: 'erp',
    domainTitle: 'ERP',
    groupTitle: '商品中心',
    title: '商品品牌',
    routeKey: 'supply.erp.master-data.attributes.brands',
    path: '/supply-chain/erp/master-data/attributes/brands',
    owner: 'erp-core-service',
  },
  {
    domainKey: 'erp',
    domainTitle: 'ERP',
    groupTitle: '商品中心',
    title: '商品标签',
    routeKey: 'supply.erp.master-data.attributes.tags',
    path: '/supply-chain/erp/master-data/attributes/tags',
    owner: 'erp-core-service',
  },
  {
    domainKey: 'erp',
    domainTitle: 'ERP',
    groupTitle: '商品中心',
    title: '商品规格',
    routeKey: 'supply.erp.master-data.attributes.specifications',
    path: '/supply-chain/erp/master-data/attributes/specifications',
    owner: 'erp-core-service',
  },
  {
    domainKey: 'erp',
    domainTitle: 'ERP',
    groupTitle: '商品中心',
    title: '商品价格',
    routeKey: 'supply.erp.master-data.prices',
    path: '/supply-chain/erp/master-data/prices',
    owner: 'erp-core-service',
  },
]

export const SUPPLY_DOMAIN_MENU_KEYS: string[] = [
  'supply.erp.master-data.menu',
  'supply.erp.suppliers.menu',
  'supply.erp.procurement.menu',
  'supply.erp.inventory.menu',
  'supply.crm.customers.menu',
  'supply.order.menu',
  'supply.hr.menu',
  'supply.cost.menu',
  'supply.hr.payroll-settings.menu',
  'supply.integration.sync-control.menu',
]

export const SUPPLY_DOMAIN_PAGES: SupplyDomainPage[] = [
  ...directPages('cost', '成本管理', 'order-center-service', [{ key: 'logistics', title: '运费' }]),
  ...directPages('cost', '成本管理', 'erp-core-service', [
    { key: 'marketing', title: '营销费用' },
    { key: 'warehouse-rentals', title: '仓储费用' },
    { key: 'office-rentals', title: '办公室费用' },
    { key: 'purchases', title: '进货记录' },
    { key: 'losses', title: '损耗记录' },
  ]),
  ...erpProductCenterPages,
  ...groupPages('erp', 'ERP', 'erp-core-service', [
    {
      key: 'suppliers',
      title: '供应商',
      pages: [
        { key: 'profiles', title: '供应商档案' },
      ],
    },
    {
      key: 'procurement',
      title: '采购管理',
      pages: [
        { key: 'orders', title: '采购订单' },
      ],
    },
    {
      key: 'inventory',
      title: '库存管理',
      pages: [
        { key: 'inventory', title: '库存' },
        { key: 'inbound', title: '入库单' },
        { key: 'outbound', title: '出库单' },
        { key: 'transfers', title: '库存调拨' },
        { key: 'warehouses', title: '仓库信息' },
      ],
    },
  ]),
  ...groupPages('crm', 'CRM', 'merchant-crm-service', [
    {
      key: 'stores',
      title: '客户管理',
      pages: [
        { key: 'mine', title: '我的客户' },
        { key: 'public', title: '公海' },
        { key: 'cooperated', title: '合作客户' },
        { key: 'leads', title: '门店提报' },
        { key: 'library', title: '商家库管理' },
        { key: 'analysis', title: '客户经营分析' },
      ],
    },
    {
      key: 'customers',
      title: '客户管理',
      pages: [
        { key: 'profiles', title: '客户档案' },
        { key: 'shipping-addresses', title: '客户地址' },
        { key: 'levels-tags', title: '客户类型' },
        { key: 'areas', title: '归属地区' },
      ],
    },
  ]),
  ...directPages('order', 'Order', 'order-center-service', [
    { key: 'sales-orders', title: '销售订单' },
    { key: 'fulfillments', title: '订单出库' },
    { key: 'shipments', title: '发货单' },
    { key: 'sales-payments', title: '订单回款' },
    { key: 'fund-documents', title: '客户资金流水' },
    { key: 'sales-refunds', title: '销售退款' },
  ]),
  ...directPages('bi', '数据看板', 'analytics-bi-service', [
    { key: 'sales', title: '销售看板' },
    { key: 'city-operating', title: '城市经营看板' },
    { key: 'customer', title: '客户看板' },
    { key: 'product-inventory', title: '商品/库存看板' },
    { key: 'product-sales', title: '商品销售统计' },
    { key: 'gross-profit', title: '销售毛利分析' },
    { key: 'payment-risk', title: '回款风险看板' },
    { key: 'city-cost', title: '成本数据看板' },
    { key: 'inventory-risk', title: '库存风险看板' },
  ]),
  ...directPages('hr', '人事与绩效', 'hr-payroll-service', [
    { key: 'city-managers', title: '城市总管理' },
    { key: 'commission-rules', title: '提成设置' },
    { key: 'performance-rules', title: '绩效规则设置' },
    { key: 'allowance-rules', title: '补贴规则' },
    { key: 'payroll', title: '月度薪酬' },
    { key: 'expenses', title: '报销费用' },
    { key: 'departments', title: '部门管理' },
    { key: 'employees', title: '员工档案' },
    { key: 'positions', title: '岗位职位' },
    { key: 'target-settings', title: '指标设置' },
    { key: 'attendance-rules', title: '考勤规则设置' },
    { key: 'attendance', title: '员工考勤' },
  ]),
  {
    domainKey: 'settings',
    domainTitle: '业务设置',
    groupTitle: null,
    title: '数据字典',
    routeKey: 'supply.settings.numbering-dictionaries',
    path: '/supply-chain/settings/numbering-dictionaries',
    owner: 'business-settings-service',
  },
  {
    domainKey: 'integration',
    domainTitle: '外部同步',
    groupTitle: '同步控制',
    title: '订货宝同步中心',
    routeKey: 'supply.integration.overview',
    path: '/supply-chain/integration',
    owner: 'integration-migration-service',
  },
  {
    domainKey: 'integration',
    domainTitle: '外部同步',
    groupTitle: '同步控制',
    title: '货拉拉接入',
    routeKey: 'supply.integration.huolala',
    path: '/supply-chain/integration/huolala',
    owner: 'integration-migration-service',
  },
  {
    domainKey: 'integration',
    domainTitle: '外部同步',
    groupTitle: '同步控制',
    title: '定时任务',
    routeKey: 'supply.integration.schedules',
    path: '/supply-chain/integration/schedules',
    owner: 'integration-migration-service',
  },
]

export const SUPPLY_DOMAIN_ROUTE_MAP: Record<string, string | null> = {
  ...Object.fromEntries(SUPPLY_DOMAIN_MENU_KEYS.map((key) => [key, null])),
  ...Object.fromEntries(SUPPLY_DOMAIN_PAGES.map((item) => [item.routeKey, item.path])),
}
