import type { HrDepartment } from '@/api/core/hr'

export type DepartmentTreeNode<T> = T & { children: DepartmentTreeNode<T>[] }
export type DepartmentNode = DepartmentTreeNode<HrDepartment>

export interface DepartmentScopeRow {
  id: number
  parentId: number | null
  name: string
  sortOrder: number
}

/** 只保留选中部门及其真实祖先；祖先不会因此被计入适用范围。 */
export function departmentScopeTree(rows: DepartmentScopeRow[], selectedIds: number[]) {
  const selected = new Set(selectedIds)
  const index = new Map(rows.map((row) => [row.id, row]))
  const included = new Set<number>()
  for (const id of selected) {
    const seen = new Set<number>()
    let current: number | null = id
    while (current != null) {
      if (seen.has(current)) throw new Error('部门层级存在循环，请联系管理员处理')
      seen.add(current)
      included.add(current)
      current = index.get(current)?.parentId ?? null
    }
  }
  return departmentTree(
    [...included].map((id) => ({
      ...(index.get(id) ?? {
        id,
        parentId: null,
        name: `未匹配部门（${id}）`,
        sortOrder: Number.MAX_SAFE_INTEGER,
      }),
      selected: selected.has(id),
    })),
  )
}

/** 部门树只使用 HR 保存的父子关系；搜索保留祖先链和命中部门的下级。 */
export function departmentTree<T extends Pick<HrDepartment, 'id' | 'parentId' | 'sortOrder'>>(
  rows: T[],
): DepartmentTreeNode<T>[] {
  const index = new Map(
    rows.map((row) => [row.id, { ...row, children: [] as DepartmentTreeNode<T>[] }]),
  )
  const roots: DepartmentTreeNode<T>[] = []
  for (const node of index.values()) {
    const seen = new Set<number>([node.id])
    let parentId = node.parentId
    while (parentId != null && index.has(parentId)) {
      if (seen.has(parentId)) throw new Error('部门层级存在循环，请联系管理员处理')
      seen.add(parentId)
      parentId = index.get(parentId)!.parentId
    }
    const parent = node.parentId == null ? undefined : index.get(node.parentId)
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const sort = (nodes: DepartmentTreeNode<T>[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    nodes.forEach((node) => sort(node.children))
  }
  sort(roots)
  return roots
}

export function filterDepartmentTree(nodes: DepartmentNode[], keyword: string): DepartmentNode[] {
  const key = keyword.trim().toLocaleLowerCase()
  if (!key) return nodes
  return nodes.flatMap((node) => {
    if (`${node.departmentName} ${node.departmentCode}`.toLocaleLowerCase().includes(key))
      return [node]
    const children = filterDepartmentTree(node.children, key)
    return children.length ? [{ ...node, children }] : []
  })
}

export function filterDepartmentTreeFields(
  nodes: DepartmentNode[],
  name: string,
  code: string,
): DepartmentNode[] {
  const nameKey = name.trim().toLocaleLowerCase(),
    codeKey = code.trim().toLocaleLowerCase()
  if (!nameKey && !codeKey) return nodes
  return nodes.flatMap((node) => {
    if (
      node.departmentName.toLocaleLowerCase().includes(nameKey) &&
      node.departmentCode.toLocaleLowerCase().includes(codeKey)
    )
      return [node]
    const children = filterDepartmentTreeFields(node.children, nameKey, codeKey)
    return children.length ? [{ ...node, children }] : []
  })
}
export function departmentParentTree(
  nodes: DepartmentNode[],
  editingId: number | null,
  blocked = false,
): (DepartmentNode & { disabled: boolean })[] {
  return nodes.map((node) => {
    const disabled = blocked || node.id === editingId || node.statusCode !== 'ACTIVE'
    return { ...node, disabled, children: departmentParentTree(node.children, editingId, disabled) }
  })
}
