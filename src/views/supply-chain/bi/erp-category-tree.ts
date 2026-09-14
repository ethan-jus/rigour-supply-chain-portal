export interface ErpCategoryNode {
  id: string | number
  parentId: string | number | null
  categoryName: string
  ordinal?: number | null
}
export interface CategoryTreeOption {
  value: string
  label: string
  children: CategoryTreeOption[]
}

/** 保留ERP全量分类及父节点，不按成交数量删选项，不猜测产品名称所属分类。 */
export function erpCategoryTree(categories: readonly ErpCategoryNode[]): CategoryTreeOption[] {
  const indexed = new Map(categories.map((row) => [String(row.id), row]))
  const options = new Map(
    categories.map((row) => [
      String(row.id),
      { value: String(row.id), label: row.categoryName, children: [] } as CategoryTreeOption,
    ]),
  )
  if (indexed.size !== categories.length) throw new Error('ERP分类目录存在重复标识，请核查')
  const roots: CategoryTreeOption[] = []
  for (const row of [...categories].sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))) {
    const visited = new Set<string>([String(row.id)])
    let parent = row.parentId == null || String(row.parentId) === '0' ? '' : String(row.parentId)
    while (parent) {
      if (visited.has(parent)) throw new Error('ERP分类层级存在循环，请核查')
      visited.add(parent)
      const ancestor = indexed.get(parent)
      if (!ancestor) throw new Error('ERP分类父节点缺失，目录尚未完整加载')
      parent =
        ancestor.parentId == null || String(ancestor.parentId) === '0'
          ? ''
          : String(ancestor.parentId)
    }
    const option = options.get(String(row.id))!
    const parentOption = row.parentId == null ? undefined : options.get(String(row.parentId))
    if (parentOption) parentOption.children.push(option)
    else roots.push(option)
  }
  return roots
}

export function erpCategoryDescendants(
  categories: readonly ErpCategoryNode[],
  selected: string,
): string[] {
  const tree = erpCategoryTree(categories)
  const descendants = (row: CategoryTreeOption): string[] => [
    row.value,
    ...row.children.flatMap(descendants),
  ]
  const find = (nodes: CategoryTreeOption[]): string[] => {
    for (const node of nodes) {
      if (node.value === selected) return descendants(node)
      const found = find(node.children)
      if (found.length) return found
    }
    return []
  }
  return find(tree)
}
