import type { NavigationNode } from '@/types/management'

import { isPageGroup } from './navigation-groups'

/** Hidden pages remain authorized resources and keep their configured names. */
export function supplyPageName(nodes: NavigationNode[], path: string): string | undefined {
  for (const node of nodes) {
    if (isPageGroup(node) && node.children.some(child => child.routePath === path)) return node.displayName
    if (node.routePath === path && node.displayName.trim()) return node.displayName
    const name = supplyPageName(node.children, path)
    if (name) return name
  }
  return undefined
}
