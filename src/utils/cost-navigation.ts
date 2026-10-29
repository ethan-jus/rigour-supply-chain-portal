import type { NavigationNode } from '@/types/management'
import { businessNavigationName } from './business-page-labels'

const sections = [
  { title: '商品成本', paths: ['cost/purchases', 'cost/losses'] },
  { title: '物流运输', paths: ['cost/logistics'] },
  { title: '场地租赁', paths: ['cost/warehouse-rentals', 'cost/office-rentals'] },
  { title: '营销推广', paths: ['cost/marketing'] },
]

/** 仅组织成本模块已可见的六项台账，不重复展示其他模块入口。 */
export function costNavigationSections(localNodes: NavigationNode[]) {
  const entries = new Map<string, NavigationNode>()
  function collect(nodes: NavigationNode[]) {
    for (const node of nodes) {
      if (!node.visible) continue
      if (node.routePath) entries.set(node.routePath, node)
      collect(node.children)
    }
  }
  collect(localNodes)
  return sections
    .map((section) => ({
      title: section.title,
      nodes: section.paths.flatMap((path) => {
        const node = entries.get(`/supply-chain/${path}`)
        if (!node) return []
        return [{ ...node, displayName: businessNavigationName(node), children: [] }]
      }),
    }))
    .filter((section) => section.nodes.length)
}
