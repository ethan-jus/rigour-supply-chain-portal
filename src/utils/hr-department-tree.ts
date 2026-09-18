import type { HrDepartment } from '@/api/core/hr'

export interface DepartmentNode extends HrDepartment {
  children: DepartmentNode[]
}

/** 部门树只使用 HR 保存的父子关系；搜索保留祖先链和命中部门的下级。 */
export function departmentTree(rows: HrDepartment[]): DepartmentNode[] {
  const index = new Map(rows.map((row) => [row.id, { ...row, children: [] as DepartmentNode[] }]))
  const roots: DepartmentNode[] = []
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
  const sort = (nodes: DepartmentNode[]) => {
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
