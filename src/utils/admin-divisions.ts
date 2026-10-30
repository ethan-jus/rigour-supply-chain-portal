import type { AdminArea } from '@/api/core/admin-divisions'

export const GEO_REGIONS: Record<string, string> = {
  NORTH: '华北',
  NORTHEAST: '东北',
  EAST: '华东',
  CENTRAL: '华中',
  SOUTH: '华南',
  SOUTHWEST: '西南',
  NORTHWEST: '西北',
}
export interface AdminAreaNode extends AdminArea {
  children: AdminAreaNode[]
  label: string
  region: string
  path: string
  parentName: string
}

/** Preserve official parentage, including province-to-county and prefectures without counties. */
export function buildAdminAreaTree(areas: AdminArea[]): AdminAreaNode[] {
  const nodes = new Map<string, AdminAreaNode>(
    areas.map((area) => [
      area.code,
      {
        ...area,
        children: [],
        label: `${area.name} · ${area.code}`,
        region: '',
        path: '',
        parentName: '',
      },
    ]),
  )
  const roots: AdminAreaNode[] = []
  for (const node of nodes.values()) {
    const parent = node.parentCode ? nodes.get(node.parentCode) : null
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  function decorate(branch: AdminAreaNode[], parent?: AdminAreaNode) {
    branch.sort((a, b) => a.code.localeCompare(b.code))
    for (const node of branch) {
      node.region = node.regionCode || parent?.region || ''
      node.parentName = parent?.name || '—'
      node.path = parent ? `${parent.path} / ${node.name}` : node.name
      decorate(node.children, node)
    }
  }
  decorate(roots)
  return roots
}
