export interface SupplyDomainPage {
  domainKey: string
  domainTitle: string
  groupTitle: string | null
  title: string
  routeKey: string
  path: string
  owner: string
}

interface PageSeed { key: string; title: string }
interface GroupSeed { key: string; title: string; pages: PageSeed[] }

const groupPages = (
  domainKey: string,
  domainTitle: string,
  owner: string,
  groups: GroupSeed[],
): SupplyDomainPage[] => groups.flatMap((group) => group.pages.map((item) => ({
  domainKey,
  domainTitle,
  groupTitle: group.title,
  title: item.title,
  routeKey: `supply.${domainKey}.${group.key}.${item.key}`,
  path: `/supply-chain/${domainKey}/${group.key}/${item.key}`,
  owner,
})))

const directPages = (
  domainKey: string,
  domainTitle: string,
  owner: string,
  pages: PageSeed[],
): SupplyDomainPage[] => pages.map((item) => ({
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
    domainKey: 'erp', domainTitle: 'ERP', groupTitle: '商品中心', title: '商品管理',
    routeKey: 'supply.erp.master-data.products',
    path: '/supply-chain/erp/master-data/products', owner: 'erp-core-service',
  },
  {
    domainKey: 'erp', domainTitle: 'ERP', groupTitle: '商品中心', title: '商品分类',
    routeKey: 'supply.erp.master-data.attributes.categories',
    path: '/supply-chain/erp/master-data/attributes/categories', owner: 'erp-core-service',
  },
  {
    domainKey: 'erp', domainTitle: 'ERP', groupTitle: '商品中心', title: '商品品牌',
    routeKey: 'supply.erp.master-data.attributes.brands',
    path: '/supply-chain/erp/master-data/attributes/brands', owner: 'erp-core-service',
  },
  {
    domainKey: 'erp', domainTitle: 'ERP', groupTitle: '商品中心', title: '商品标签',
    routeKey: 'supply.erp.master-data.attributes.tags',
    path: '/supply-chain/erp/master-data/attributes/tags', owner: 'erp-core-service',
  },
  {
    domainKey: 'erp', domainTitle: 'ERP', groupTitle: '商品中心', title: '商品规格',
    routeKey: 'supply.erp.master-data.attributes.specifications',
    path: '/supply-chain/erp/master-data/attributes/specifications', owner: 'erp-core-service',
  },
]

export const SUPPLY_DOMAIN_MENU_KEYS: string[] = [
  'supply.erp.master-data.menu',
  'supply.erp.suppliers.menu',
  'supply.erp.procurement.menu',
  'supply.erp.inventory.menu',
  'supply.erp.cost-settlement.menu',
  'supply.crm.customers.menu',
  'supply.crm.assignments.menu',
  'supply.crm.credit-policy.menu',
  'supply.order.menu',
  'supply.city.scope.menu',
  'supply.city.tasks.menu',
  'supply.city.configuration.menu',
  'supply.integration.sync-control.menu',
]

export const SUPPLY_DOMAIN_PAGES: SupplyDomainPage[] = [
  ...erpProductCenterPages,
  ...groupPages('erp', 'ERP', 'erp-core-service', [
    { key: 'suppliers', title: '供应商', pages: [
      { key: 'profiles', title: '供应商档案' }, { key: 'products', title: '供应商商品' },
      { key: 'prices', title: '供应商价格' },
    ] },
    { key: 'procurement', title: '采购管理', pages: [
      { key: 'requests', title: '采购申请' }, { key: 'orders', title: '采购订单' },
      { key: 'receipts', title: '到货与入库' }, { key: 'returns', title: '采购退货' },
      { key: 'payments', title: '采购付款单' },
    ] },
    { key: 'inventory', title: '库存管理', pages: [
      { key: 'dashboard', title: '库存看板' }, { key: 'inventory', title: '库存' },
      { key: 'inbound', title: '入库单' }, { key: 'outbound', title: '出库单' },
      { key: 'movements', title: '出入库流水' }, { key: 'transfers', title: '库存调拨' },
      { key: 'stocktaking', title: '库存盘点' }, { key: 'warehouses', title: '仓库信息' },
    ] },
    { key: 'cost-settlement', title: '成本与采购结算', pages: [
      { key: 'purchase-prices', title: '采购价格' }, { key: 'receipt-costs', title: '入库成本' },
      { key: 'inventory-costs', title: '库存成本' }, { key: 'payable-basis', title: '供应商应付依据' },
    ] },
  ]),
  ...groupPages('crm', 'CRM', 'merchant-crm-service', [
    { key: 'customers', title: '客户管理', pages: [
      { key: 'profiles', title: '客户档案' }, { key: 'shipping-addresses', title: '客户地址' },
      { key: 'stores', title: '门店档案' },
      { key: 'levels-tags', title: '客户类型' }, { key: 'areas', title: '归属地区' },
    ] },
    { key: 'assignments', title: '客户归属', pages: [
      { key: 'sales', title: '销售归属' }, { key: 'city-teams', title: '城市与团队归属' },
      { key: 'history', title: '归属变更记录' },
    ] },
    { key: 'credit-policy', title: '信用与结算政策', pages: [
      { key: 'limits', title: '信用额度' }, { key: 'terms', title: '账期与结算周期' },
      { key: 'payment-methods', title: '付款方式' }, { key: 'invoicing', title: '开票资料' },
      { key: 'approvals', title: '政策审批记录' },
    ] },
  ]),
  ...directPages('order', 'Order', 'order-center-service', [
    { key: 'sales-orders', title: '销售订单' },
    { key: 'shipments', title: '发货单' },
    { key: 'sales-payments', title: '销售回款' },
    { key: 'fund-documents', title: '客户资金流水' },
    { key: 'sales-refunds', title: '销售退款' },
  ]),
  ...groupPages('city', '城市运营', 'city-operations-service', [
    { key: 'scope', title: '城市与服务范围', pages: [
      { key: 'profiles', title: '城市运营档案' }, { key: 'service-areas', title: '服务区域' },
      { key: 'fulfillment-nodes', title: '履约节点' }, { key: 'owners', title: '城市责任人' },
    ] },
    { key: 'tasks', title: '运营任务', pages: [
      { key: 'todos', title: '城市待办' }, { key: 'fulfillment-exceptions', title: '履约异常' },
      { key: 'customer-exceptions', title: '客户经营异常' }, { key: 'activities', title: '城市活动与复盘' },
    ] },
    { key: 'configuration', title: '城市配置', pages: [
      { key: 'targets', title: '城市目标' }, { key: 'budgets', title: '预算与成本配置' },
      { key: 'partners', title: '合作方配置' },
    ] },
  ]),
  ...directPages('bi', '数据看板', 'analytics-bi-service', [
    { key: 'sales-collection', title: '销售与回款看板' },
    { key: 'product-sales', title: '商品销售统计' },
    { key: 'gross-profit', title: '销售毛利分析' },
    { key: 'payment-risk', title: '回款风险看板' },
    { key: 'city-cost', title: '城市成本看板' },
    { key: 'inventory-risk', title: '库存风险看板' },
  ]),
  ...directPages('hr', '人事与绩效', 'hr-payroll-service', [
    { key: 'assignments', title: '任职与调动' }, { key: 'calendar-policies', title: '工作日历与考勤政策' },
    { key: 'attendance-appeals', title: '正式考勤与申诉' }, { key: 'payroll-commission', title: '薪酬与提成' },
    { key: 'performance', title: '绩效核算' }, { key: 'monthly-close', title: '月结与冲回' },
  ]),
  ...directPages('channel', '渠道代理', 'channel-agent-service', [
    { key: 'relationships', title: '代理关系树' }, { key: 'levels', title: '代理等级' },
    { key: 'quotas', title: '额度与占用' }, { key: 'approvals', title: '审批与释放' },
  ]),
  ...directPages('settings', '业务设置', '各领域服务', [
    { key: 'product-inventory', title: '商品与库存参数' }, { key: 'procurement', title: '采购规则' },
    { key: 'customer-levels-tags', title: '客户等级与标签' },
    { key: 'credit-policy-templates', title: '信用与结算政策模板' },
    { key: 'order-after-sales', title: '订单和售后规则' },
    { key: 'fulfillment-allocation', title: '履约分配规则' },
    { key: 'city-service-scope', title: '城市服务范围' },
  ]),
  {
    domainKey: 'settings', domainTitle: '业务设置', groupTitle: null, title: '数据字典',
    routeKey: 'supply.settings.numbering-dictionaries',
    path: '/supply-chain/settings/numbering-dictionaries', owner: 'business-settings-service',
  },
  {
    domainKey: 'integration', domainTitle: '外部同步', groupTitle: '同步控制', title: '订货宝同步中心',
    routeKey: 'supply.integration.overview',
    path: '/supply-chain/integration', owner: 'integration-migration-service',
  },
]

export const SUPPLY_DOMAIN_ROUTE_MAP: Record<string, string | null> = {
  ...Object.fromEntries(SUPPLY_DOMAIN_MENU_KEYS.map((key) => [key, null])),
  ...Object.fromEntries(SUPPLY_DOMAIN_PAGES.map((item) => [item.routeKey, item.path])),
}
