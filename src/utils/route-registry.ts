import type { NavigationNode } from '@/types/management'
import { SUPPLY_DOMAIN_ROUTE_MAP } from '@/views/supply-chain/domain/catalog'

/** 数据库routeKey到已编译路由的唯一允许映射；未知或路径不一致时失败关闭。 */
const ROUTES: Record<string, string | null> = {
  'platform.dashboard': '/platform-admin', 'platform.tenant.menu': null,
  'platform.tenant.list': '/platform-admin/tenants', 'platform.package.menu': null,
  'platform.package.list': '/platform-admin/packages', 'platform.application.menu': null,
  'platform.application.list': '/platform-admin/applications', 'platform.resource.menu': null,
  'platform.resource.list': '/platform-admin/resources', 'platform.audit.menu': null,
  'platform.audit.list': '/platform-admin/audit', 'platform.dictionary.menu': null,
  'platform.dictionary.list': '/platform-admin/dictionaries',
  'system.dashboard': '/system-admin', 'system.organization.menu': null,
  'system.organization.list': '/system-admin/organizations', 'system.user.menu': null,
  'system.staff.list': '/system-admin/staff', 'system.position.list': '/system-admin/positions',
  'system.user.list': '/system-admin/users', 'system.role.menu': null,
  'system.role.list': '/system-admin/roles', 'system.data-scope.menu': null,
  'system.data-scope.list': '/system-admin/data-scopes', 'system.setting.menu': null,
  'system.setting.list': '/system-admin/settings', 'system.menu-config.list': '/system-admin/menus',
  'system.dictionary.menu': null,
  'system.dictionary.list': '/system-admin/dictionaries', 'system.audit.menu': null,
  'system.audit.list': '/system-admin/audit',
  'supply.dashboard': '/supply-chain', 'supply.city.menu': null, 'supply.city.index': '/supply-chain/city',
  'supply.crm.menu': null, 'supply.crm.index': '/supply-chain/crm', 'supply.order.menu': null,
  'supply.order.sales-orders': '/supply-chain/order/sales-orders',
  'supply.order.shipments': '/supply-chain/order/shipments',
  'supply.order.sales-payments': '/supply-chain/order/sales-payments',
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
  'supply.hr.index': '/supply-chain/hr', 'supply.channel.menu': null, 'supply.channel.index': '/supply-chain/channel',
  'supply.bi.menu': null, 'supply.bi.index': '/supply-chain/bi', 'supply.setting.menu': null,
  'supply.setting.index': '/supply-chain/settings', 'supply.integration.menu': null,
  'supply.integration.overview': '/supply-chain/integration',
  ...SUPPLY_DOMAIN_ROUTE_MAP,
}

export function validateNavigation(nodes: NavigationNode[]): NavigationNode[] {
  return nodes.map((node) => {
    const tenantGroup = node.type === 'MENU'
      && node.routeKey.startsWith('tenant.menu.group.')
      && node.routePath === null
    if (!tenantGroup && (!(node.routeKey in ROUTES) || ROUTES[node.routeKey] !== node.routePath)) {
      throw new Error(`IAM返回未注册或路径不一致的routeKey: ${node.routeKey}`)
    }
    return { ...node, children: validateNavigation(node.children) }
  })
}
