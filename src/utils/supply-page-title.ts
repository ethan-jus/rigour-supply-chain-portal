import type { NavigationNode } from '@/types/management'

/** Hidden pages remain authorized resources and keep their configured names. */
export function supplyPageName(nodes: NavigationNode[], path: string): string | undefined {
  for (const node of nodes) {
    if (node.routePath === path && node.displayName.trim()) return node.displayName
    const name = supplyPageName(node.children, path)
    if (name) return name
  }
  return undefined
}
