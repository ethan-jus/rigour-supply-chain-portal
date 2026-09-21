import type { NavigationNode } from '@/types/management'
import { devWarn } from '@/utils/dev-log'
import { CUSTOM_PAGE_ROUTE_PREFIX, isCustomPage, resolveView } from '@/utils/dynamic-pages'
import { SUPPLY_DOMAIN_ROUTE_MAP } from '@/views/supply-chain/domain/catalog'

/** 数据库 routeKey 到已编译页面的映射；可见未知节点及路径不一致时失败关闭。 */
const ROUTES: Record<string, string | null> = {
  'supply.dashboard': '/supply-chain',
  'supply.crm.menu': null, 'supply.crm.index': '/supply-chain/crm', 'supply.order.menu': null,
  'supply.order.sales-orders': '/supply-chain/order/sales-orders',
  'supply.order.shipments': '/supply-chain/order/shipments',
  'supply.order.sales-payments': '/supply-chain/order/sales-payments',
  'supply.order.lines': '/supply-chain/order/lines',
  'supply.order.statistics': '/supply-chain/order/statistics',
  'supply.order.invoices': '/supply-chain/order/invoices',
  'supply.order.fund-documents': '/supply-chain/order/fund-documents',
  'supply.order.sales-refunds': '/supply-chain/order/sales-refunds',
  'supply.sales.menu': null, 'supply.sales.dashboard': '/supply-chain/sales',
  'supply.sales.attendance.menu': null,
  'supply.sales.attendance.today': '/supply-chain/sales/attendance/today',
  'supply.sales.attendance.punches': '/supply-chain/sales/attendance/punches',
  'supply.sales.attendance.days': '/supply-chain/sales/attendance/days',
  'supply.sales.attendance.interruptions': '/supply-chain/sales/attendance/interruptions',
  'supply.sales.attendance.adjustments': '/supply-chain/sales/attendance/adjustments',
  'supply.sales.visits.menu': null,
  'supply.sales.visits.plans': '/supply-chain/sales/visits/plans',
  'supply.sales.visits.records': '/supply-chain/sales/visits/records',
  'supply.sales.visits.reviews': '/supply-chain/sales/visits/reviews',
  'supply.sales.visits.appeals': '/supply-chain/sales/visits/appeals',
  'supply.sales.stores.menu': null,
  'supply.sales.stores.assigned': '/supply-chain/sales/stores/assigned',
  'supply.sales.stores.uncovered': '/supply-chain/sales/stores/uncovered',
  'supply.sales.stores.visited': '/supply-chain/sales/stores/visited',
  'supply.sales.stores.effective': '/supply-chain/sales/stores/effective',
  'supply.sales.stores.candidates': '/supply-chain/sales/stores/candidates',
  'supply.sales.organization.menu': null,
  'supply.sales.organization.profiles': '/supply-chain/sales/organization/profiles',
  'supply.sales.organization.teams': '/supply-chain/sales/organization/teams',
  'supply.sales.organization.scopes': '/supply-chain/sales/organization/scopes',
  'supply.sales.tasks.menu': null,
  'supply.sales.tasks.visits': '/supply-chain/sales/tasks/visits',
  'supply.sales.tasks.targets': '/supply-chain/sales/tasks/targets',
  'supply.sales.tasks.exemptions': '/supply-chain/sales/tasks/exemptions',
  'supply.sales.exceptions.menu': null,
  'supply.sales.exceptions.punch': '/supply-chain/sales/exceptions/punch',
  'supply.sales.exceptions.location': '/supply-chain/sales/exceptions/location',
  'supply.sales.exceptions.evidence': '/supply-chain/sales/exceptions/evidence',
  'supply.sales.exceptions.recording': '/supply-chain/sales/exceptions/recording',
  'supply.sales.exceptions.reviews': '/supply-chain/sales/exceptions/reviews',
  'supply.sales.policies.menu': null,
  'supply.sales.policies.field': '/supply-chain/sales/policies/field',
  'supply.sales.policies.visit': '/supply-chain/sales/policies/visit',
  'supply.sales.policies.recording-ai': '/supply-chain/sales/policies/recording-ai',
  'supply.sales.policies.scopes': '/supply-chain/sales/policies/scopes',
  'supply.sales.policies.releases': '/supply-chain/sales/policies/releases',
  'supply.erp.menu': null, 'supply.erp.index': '/supply-chain/erp', 'supply.hr.menu': null,
  'supply.bi.menu': null, 'supply.bi.index': '/supply-chain/bi',
  'supply.bi.hr': '/supply-chain/bi/hr',
  'supply.bi.sales-visits': '/supply-chain/bi/sales-visits',
  'supply.bi.sales': '/supply-chain/bi/sales',
  'supply.bi.city-operating': '/supply-chain/bi/city-operating',
  'supply.bi.activity': '/supply-chain/bi/activity',
  'supply.bi.product-inventory': '/supply-chain/bi/product-inventory',
  'supply.bi.sales-collection': '/supply-chain/bi/sales-collection',
  'supply.bi.product-sales': '/supply-chain/bi/product-sales',
  'supply.bi.gross-profit': '/supply-chain/bi/gross-profit',
  'supply.bi.payment-risk': '/supply-chain/bi/payment-risk',
  'supply.bi.city-cost': '/supply-chain/bi/city-cost',
  'supply.bi.inventory-risk': '/supply-chain/bi/inventory-risk',
  'supply.settings.users': '/supply-chain/settings/users',
  'supply.settings.roles': '/supply-chain/settings/roles',
  'supply.settings.menus': '/supply-chain/settings/menus',
  'supply.settings.parameters': '/supply-chain/settings/parameters',
  'supply.settings.audits': '/supply-chain/settings/audits',
  'supply.setting.menu': null,
  'supply.setting.index': '/supply-chain/settings', 'supply.integration.menu': null,
  'supply.integration.overview': '/supply-chain/integration',
  ...SUPPLY_DOMAIN_ROUTE_MAP,
}

export function validateNavigation(nodes: NavigationNode[]): NavigationNode[] {
  return nodes.flatMap((node) => {
    // 自定义页面（数据库 componentPath 驱动）走宽松校验：类型、路径前缀、组件是否已编译。
    // 任一条不满足只跳过该节点并告警，绝不抛错打挂整棵菜单树。
    if (isCustomPage(node)) {
      const routePath = node.routePath
      const routePathLength = typeof routePath === 'string' ? routePath.length : 0
      const valid = node.type === 'PAGE'
        && typeof routePath === 'string'
        && routePath.startsWith(CUSTOM_PAGE_ROUTE_PREFIX)
        && routePathLength > CUSTOM_PAGE_ROUTE_PREFIX.length
        && resolveView(node.componentPath) !== null
      if (!valid) {
        devWarn('忽略无效的自定义页面菜单节点', {
          id: node.id,
          displayName: node.displayName,
          type: node.type,
          routeKey: node.routeKey,
          routePath,
          componentPath: node.componentPath,
        })
        return []
      }
      return [{ ...node, children: validateNavigation(node.children) }]
    }
    const customGroupKey = node.routeKey.startsWith('tenant.menu.group.')
    const tenantGroup = node.type === 'MENU'
      && customGroupKey
      && node.routePath === null
    // IAM 保留隐藏的历史资源；未编译的隐藏分支不进入导航和可访问路径集合。
    // 已注册的隐藏页面仍需校验，保留其授权直达能力；隐藏不等于撤销权限。
    if (node.visible === false && !customGroupKey && !(node.routeKey in ROUTES)) return []
    if (!tenantGroup && (!(node.routeKey in ROUTES) || ROUTES[node.routeKey] !== node.routePath)) {
      const expectedPath = node.routeKey in ROUTES ? ROUTES[node.routeKey] : '未注册'
      throw new Error(`IAM返回未注册或路径不一致的routeKey: ${node.routeKey}; routePath=${node.routePath}; expected=${expectedPath}`)
    }
    return [{ ...node, children: validateNavigation(node.children) }]
  })
}
