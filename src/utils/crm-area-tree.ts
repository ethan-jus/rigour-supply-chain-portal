import type { CrmDictionaryView } from '@/api/core/crm'

export type AreaNode = CrmDictionaryView & { children: AreaNode[]; disabled?: boolean }

/** Keep stable codes as keys; reject cycles instead of silently losing customer regions. */
export function buildAreaTree(rows: (CrmDictionaryView & { disabled?: boolean })[]): AreaNode[] {
  const nodes = new Map<string, AreaNode>()
  for (const row of rows) {
    if (nodes.has(row.code)) throw new Error('地区编码重复，请重新载入')
    nodes.set(row.code, { ...row, children: [] })
  }
  const roots: AreaNode[] = []
  for (const row of nodes.values()) {
    const visited = new Set([row.code])
    let parent = row.parentCode
    while (parent && nodes.has(parent)) {
      if (visited.has(parent)) throw new Error('地区层级存在循环，请核对上级地区')
      visited.add(parent)
      parent = nodes.get(parent)!.parentCode
    }
    const owner = row.parentCode ? nodes.get(row.parentCode) : undefined
    if (owner) owner.children.push(row)
    else roots.push(row)
  }
  function sort(items: AreaNode[]) {
    items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.code.localeCompare(b.code))
    items.forEach(item => sort(item.children))
  }
  sort(roots)
  return roots
}

/** A matching child retains its ancestors; a matching parent retains its whole subtree. */
export function filterAreaTree(tree: AreaNode[], keyword: string): AreaNode[] {
  const q = keyword.trim().toLocaleLowerCase()
  if (!q) return tree
  return tree.flatMap(row => {
    if ([row.name, row.code, row.sourceCode].some(value => value?.toLocaleLowerCase().includes(q))) return [row]
    const children = filterAreaTree(row.children, q)
    return children.length ? [{ ...row, children }] : []
  })
}

export function areaDescendantCodes(rows: CrmDictionaryView[], code: string): Set<string> {
  const result = new Set([code])
  const queue = [code]
  while (queue.length) {
    const parent = queue.shift()!
    for (const row of rows) if (row.parentCode === parent && !result.has(row.code)) {
      result.add(row.code)
      queue.push(row.code)
    }
  }
  return result
}
