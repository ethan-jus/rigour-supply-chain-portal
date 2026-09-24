import type { NavigationNode } from '@/types/management'

export interface ConsoleEntry {
  name: string
  path: string
  iconKey: string | null
  context: string
}

/** Search and shortcuts use the same visible IAM tree, including custom groups. */
export function consoleEntries(nodes: NavigationNode[]): ConsoleEntry[] {
  const seen = new Set<string>()
  const entries: ConsoleEntry[] = []
  function visit(branch: NavigationNode[], parents: string[]) {
    for (const node of branch) {
      if (!node.visible) continue
      if (node.routePath && !seen.has(node.routePath)) {
        seen.add(node.routePath)
        entries.push({
          name: node.displayName,
          path: node.routePath,
          iconKey: node.iconKey,
          context: parents.join(' / '),
        })
      }
      visit(node.children, [...parents, node.displayName])
    }
  }
  visit(nodes, [])
  return entries
}

export const homeShortcutPaths = [
  '/supply-chain/order/sales-orders',
  '/supply-chain/order/sales-payments',
  '/supply-chain/crm/customers/profiles',
  '/supply-chain/erp/inventory/inventory',
]
export const homeAnalysisPaths = [
  '/supply-chain/bi',
  '/supply-chain/bi/city-operating',
  '/supply-chain/bi/sales',
]

export function selectEntries(entries: ConsoleEntry[], paths: string[]) {
  return paths.flatMap((path) => {
    const entry = entries.find((item) => item.path === path)
    return entry ? [entry] : []
  })
}
