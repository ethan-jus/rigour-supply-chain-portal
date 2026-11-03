import type { NavigationNode } from '@/types/management'

const defaultIcons: Record<string, string> = {
  'stores/mine': 'User',
  'stores/public': 'Shop',
  'stores/cooperated': 'Connection',
  'stores/leads': 'Document',
  'stores/library': 'OfficeBuilding',
  'stores/analysis': 'TrendCharts',
  'customers/profiles': 'FolderOpened',
  'customers/shipping-addresses': 'Location',
  'customers/levels-tags': 'Tickets',
  'customers/areas': 'OfficeBuilding',
}

/** 仅整理 IAM 已授权且可见的入口，保留菜单名称、顺序与自定义图标。 */
export function crmNavigationSections(nodes: NavigationNode[]) {
  const groups: { title: string; nodes: NavigationNode[] }[] = [
    { title: '客户经营', nodes: [] },
    { title: '基础资料', nodes: [] },
    { title: '其他功能', nodes: [] },
  ]
  const seen = new Set<string>()
  function visit(branch: NavigationNode[]) {
    for (const node of branch) {
      if (!node.visible) continue
      if (node.routePath && !seen.has(node.routePath)) {
        seen.add(node.routePath)
        const path = node.routePath.replace(/^\/supply-chain\/crm\//, '')
        const group =
          groups[path.startsWith('stores/') ? 0 : path.startsWith('customers/') ? 1 : 2]!
        group.nodes.push({
          ...node,
          iconKey: node.iconKey || defaultIcons[path] || null,
          children: [],
        })
      }
      visit(node.children)
    }
  }
  visit(nodes)
  return groups.filter((group) => group.nodes.length)
}
