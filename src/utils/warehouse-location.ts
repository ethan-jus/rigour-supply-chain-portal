import type { WarehouseLocationCatalog } from '@/api/core/erp-internal'

/** 只使用行政目录的父子关系，不从仓库名或地址文本推断省市区。 */
export function warehouseLocationOptions(catalog: WarehouseLocationCatalog) {
  const index = new Map(catalog.nodes.map((node) => [node.code, node]))
  return catalog.nodes
    .filter((node) => node.level === 'COUNTY')
    .flatMap((node) => {
      const path: string[] = []
      const seen = new Set<string>()
      let current: typeof node | undefined = node
      while (current) {
        if (seen.has(current.code)) return []
        seen.add(current.code)
        path.unshift(current.name)
        if (!current.parentCode) break
        current = index.get(current.parentCode)
        if (!current) return []
      }
      return [{ value: node.code, label: `${path.join(' / ')}（${node.code}）` }]
    })
}
