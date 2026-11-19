import type { NavigationNode } from '@/types/management'
import { devWarn } from '@/utils/dev-log'
import { CUSTOM_PAGE_ROUTE_PREFIX, isCustomPage, resolveView } from '@/utils/dynamic-pages'
import { SUPPLY_DOMAIN_ROUTE_MAP } from '@/views/supply-chain/domain/catalog'

/** 数据库 routeKey 到已编译页面的映射；未编译节点不进入导航，已注册页面严格校验路径。 */
const ROUTES: Record<string, string | null> = {
  'supply.dashboard': '/supply-chain',
  'supply.crm.menu': null,
  'supply.order.menu': null,
  'supply.order.sales-orders': '/supply-chain/order/sales-orders',
  'supply.order.shipments': '/supply-chain/order/shipments',
  'supply.order.sales-payments': '/supply-chain/order/sales-payments',
  'supply.order.lines': '/supply-chain/order/lines',
  'supply.order.invoices': '/supply-chain/order/invoices',
  'supply.order.fund-documents': '/supply-chain/order/fund-documents',
  'supply.order.sales-refunds': '/supply-chain/order/sales-refunds',
  'supply.sales.menu': null,
  'supply.sales.dashboard': '/supply-chain/sales',
  'supply.sales.attendance.menu': null,
  'supply.sales.visits.menu': null,
  'supply.sales.visits.plans': '/supply-chain/sales/visits/plans',
  'supply.sales.visits.reviews': '/supply-chain/sales/visits/reviews',
  'supply.sales.organization.menu': null,
  'supply.sales.exceptions.menu': null,
  'supply.sales.exceptions.location': '/supply-chain/sales/exceptions/location',
  'supply.sales.policies.menu': null,
  'supply.sales.policies.visit': '/supply-chain/sales/policies/visit',
  'supply.erp.menu': null,
  'supply.hr.menu': null,
  'supply.bi.menu': null,
  'supply.bi.index': '/supply-chain/bi',
  'supply.bi.hr': '/supply-chain/bi/hr',
  'supply.bi.sales-visits': '/supply-chain/bi/sales-visits',
  'supply.bi.sales': '/supply-chain/bi/sales',
  'supply.bi.city-operating': '/supply-chain/bi/city-operating',
  'supply.bi.product-inventory': '/supply-chain/bi/product-inventory',
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
  'supply.settings.public-reference': null,
  'supply.settings.admin-divisions': '/supply-chain/settings/admin-divisions',
  'supply.settings.store-territories': '/supply-chain/settings/store-territories',
  'supply.setting.menu': null,
  'supply.integration.menu': null,
  'supply.integration.overview': '/supply-chain/integration',
  'supply.integration.huolala': '/supply-chain/integration/huolala',
  ...SUPPLY_DOMAIN_ROUTE_MAP,
}

export function validateNavigation(nodes: NavigationNode[]): NavigationNode[] {
  return nodes.flatMap((node) => {
    // 自定义页面（数据库 componentPath 驱动）走宽松校验：类型、路径前缀、组件是否已编译。
    // 任一条不满足只跳过该节点并告警，绝不抛错打挂整棵菜单树。
    if (isCustomPage(node)) {
      const routePath = node.routePath
      const routePathLength = typeof routePath === 'string' ? routePath.length : 0
      const valid =
        node.type === 'PAGE' &&
        typeof routePath === 'string' &&
        routePath.startsWith(CUSTOM_PAGE_ROUTE_PREFIX) &&
        routePathLength > CUSTOM_PAGE_ROUTE_PREFIX.length &&
        resolveView(node.componentPath) !== null
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
    const tenantGroup = node.type === 'MENU' && customGroupKey && node.routePath === null
    // IAM 保留隐藏的历史资源；未编译的隐藏分支不进入导航和可访问路径集合。
    // 已注册的隐藏页面仍需校验，保留其授权直达能力；隐藏不等于撤销权限。
    if (node.visible === false && !customGroupKey && !(node.routeKey in ROUTES)) return []
    // 共享 DEV 或滚动发布时，IAM 可能先返回新版菜单；未编译分支不可访问，但不阻断登录。
    if (!tenantGroup && !customGroupKey && !(node.routeKey in ROUTES)) {
      devWarn('忽略当前前端未编译的菜单分支', {
        routeKey: node.routeKey,
        routePath: node.routePath,
      })
      return []
    }
    if (!tenantGroup && (!(node.routeKey in ROUTES) || ROUTES[node.routeKey] !== node.routePath)) {
      const expectedPath = node.routeKey in ROUTES ? ROUTES[node.routeKey] : '未注册'
      throw new Error(
        `IAM返回未注册或路径不一致的routeKey: ${node.routeKey}; routePath=${node.routePath}; expected=${expectedPath}`,
      )
    }
    return [
      {
        ...node,
        visible: node.visible,
        children: validateNavigation(node.children),
      },
    ]
  })
}
