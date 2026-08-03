import type { NavigationNode } from '@/types/management'

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
  'system.user.list': '/system-admin/users', 'system.role.menu': null,
  'system.role.list': '/system-admin/roles', 'system.data-scope.menu': null,
  'system.data-scope.list': '/system-admin/data-scopes', 'system.setting.menu': null,
  'system.setting.list': '/system-admin/settings', 'system.dictionary.menu': null,
  'system.dictionary.list': '/system-admin/dictionaries', 'system.audit.menu': null,
  'system.audit.list': '/system-admin/audit',
  'supply.dashboard': '/supply-chain', 'supply.city.menu': null, 'supply.city.index': '/supply-chain/city',
  'supply.crm.menu': null, 'supply.crm.index': '/supply-chain/crm', 'supply.order.menu': null,
  'supply.order.index': '/supply-chain/order', 'supply.sales.menu': null, 'supply.sales.index': '/supply-chain/sales',
  'supply.erp.menu': null, 'supply.erp.index': '/supply-chain/erp', 'supply.hr.menu': null,
  'supply.hr.index': '/supply-chain/hr', 'supply.channel.menu': null, 'supply.channel.index': '/supply-chain/channel',
  'supply.bi.menu': null, 'supply.bi.index': '/supply-chain/bi', 'supply.setting.menu': null,
  'supply.setting.index': '/supply-chain/settings', 'supply.dinghuobao.menu': null,
  'supply.dinghuobao.overview': '/supply-chain/dinghuobao',
  'supply.dinghuobao.order-mirror': '/supply-chain/dinghuobao/order-mirror',
  'supply.dinghuobao.sync-tasks': '/supply-chain/dinghuobao/sync-tasks',
  'supply.dinghuobao.sync-logs': '/supply-chain/dinghuobao/sync-logs',
  'supply.dinghuobao.connections': '/supply-chain/dinghuobao/connections',
  'supply.dinghuobao.field-mappings': '/supply-chain/dinghuobao/field-mappings',
  'supply.dinghuobao.data-quality': '/supply-chain/dinghuobao/data-quality',
  'supply.dinghuobao.bi-prep': '/supply-chain/dinghuobao/bi-prep',
}

export function validateNavigation(nodes: NavigationNode[]): NavigationNode[] {
  return nodes.map((node) => {
    if (!(node.routeKey in ROUTES) || ROUTES[node.routeKey] !== node.routePath) {
      throw new Error(`IAM返回未注册或路径不一致的routeKey: ${node.routeKey}`)
    }
    return { ...node, children: validateNavigation(node.children) }
  })
}
