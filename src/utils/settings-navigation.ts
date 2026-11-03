import type { NavigationNode } from '@/types/management'

export function settingsNavigationSections(nodes: NavigationNode[]) {
  const visible = nodes.filter((node) => node.visible)
  const reference = visible.find((node) => node.routeKey === 'supply.settings.public-reference')
  return [
    { title: '系统管理', nodes: visible.filter((node) => node !== reference) },
    {
      title: reference?.displayName || '公共资料',
      nodes: reference?.children.filter((node) => node.visible) || [],
    },
  ].filter((group) => group.nodes.length)
}
