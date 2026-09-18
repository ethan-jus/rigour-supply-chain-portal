import type { SupplyMenuNode } from '@/api/core/supply-settings'
export interface SupplyMenuTreeNode extends SupplyMenuNode { children: SupplyMenuTreeNode[] }

export function supplyMenuTree(nodes: SupplyMenuNode[]): SupplyMenuTreeNode[] {
  const index = new Map(nodes.map(node => [node.id, { ...node, children: [] as SupplyMenuTreeNode[] }]))
  const roots: SupplyMenuTreeNode[] = []
  for (const node of index.values()) {
    if (node.parentId === null) roots.push(node)
    else {
      const parent = index.get(node.parentId)
      if (!parent) throw new Error('菜单上级不存在，请刷新后重试')
      const seen = new Set([node.id])
      let current: SupplyMenuTreeNode | undefined = parent
      while (current) {
        if (seen.has(current.id)) throw new Error('菜单层级存在循环')
        seen.add(current.id)
        current = current.parentId ? index.get(current.parentId) : undefined
      }
      parent.children.push(node)
    }
  }
  return roots
}
export function menuParentOptions(nodes: SupplyMenuNode[], editingId: string | null, type: SupplyMenuNode['type']) {
  const banned = new Set(editingId ? [editingId] : [])
  let changed = true
  while (changed) {
    changed = false
    for (const node of nodes) if (node.parentId && banned.has(node.parentId) && !banned.has(node.id)) {
      banned.add(node.id); changed = true
    }
  }
  return nodes.filter(node => !banned.has(node.id) && node.type === (type === 'BUTTON' ? 'PAGE' : 'MENU'))
}
