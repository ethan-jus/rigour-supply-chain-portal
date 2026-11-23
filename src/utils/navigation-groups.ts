import type { NavigationNode } from '@/types/management'

export function isPageGroup(node: NavigationNode) {
  return node.type === 'MENU' && node.routeKey.startsWith('supply.tabs.')
}

export function pageGroupFor(nodes: NavigationNode[], path: string): NavigationNode | undefined {
  for (const node of nodes) {
    if (isPageGroup(node) && node.children.some((child) => child.routePath === path)) return node
    const found = pageGroupFor(node.children, path)
    if (found) return found
  }
}

export function groupedNavigation(nodes: NavigationNode[], moduleName: string) {
  type Link = { id: string; label: string; path: string; paths: string[]; iconKey: string | null }
  const sections: { id: string; name: string; links: Link[] }[] = []
  function add(id: string, name: string, node: NavigationNode, pages: NavigationNode[]) {
    const paths = pages.flatMap((page) => (page.visible && page.routePath ? [page.routePath] : []))
    if (!paths[0]) return
    let group = sections.find((entry) => entry.id === id)
    if (!group) {
      group = { id, name, links: [] }
      sections.push(group)
    }
    group.links.push({ id: node.id, label: node.displayName, path: paths[0], paths, iconKey: node.iconKey })
  }
  function visit(branch: NavigationNode[], id: string, name: string) {
    for (const node of branch) {
      if (!node.visible) continue
      if (isPageGroup(node)) add(id, name, node, node.children)
      else if (node.routePath) add(id, name, node, [node])
      else visit(node.children, node.id, node.displayName)
    }
  }
  visit(nodes, 'module', moduleName)
  return sections
}
