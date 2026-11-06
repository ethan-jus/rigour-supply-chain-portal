/** 逐页使用原业务的授权导出接口；选中记录失效时拒绝导出，不回退成全部。 */
export async function collectCostExportRows<T>(options: {
  fetchPage: (begin: number, step: number) => Promise<{ total: number; items: T[] }>
  key: (row: T) => string
  selected?: string[]
  current: () => boolean
  limit?: number
}): Promise<T[] | null> {
  const rows: T[] = [],
    seen = new Set<string>()
  const selected = [...new Set(options.selected || [])]
  const limit = options.limit ?? 50000
  let total: number | undefined
  do {
    const page = await options.fetchPage(rows.length, 200)
    if (!options.current()) return null
    if (!Number.isInteger(page.total) || page.total < 0 || page.total > limit)
      throw new Error('导出范围过大，请缩小筛选范围后重试')
    if (total !== undefined && total !== page.total)
      throw new Error('导出期间数据已变化，请刷新后重新导出')
    total = page.total
    for (const row of page.items) {
      const key = options.key(row)
      if (!key || seen.has(key)) throw new Error('导出期间数据已变化，请刷新后重新导出')
      seen.add(key)
      rows.push(row)
    }
    if (rows.length > total) throw new Error('导出期间数据已变化，请重新导出')
    if (!page.items.length && rows.length < total)
      throw new Error('导出数据不完整，请刷新后重新导出')
    if (selected.length && selected.every((key) => seen.has(key))) break
  } while (rows.length < total)
  if (!selected.length) return rows
  const byId = new Map(rows.map((row) => [options.key(row), row]))
  if (selected.some((key) => !byId.has(key))) throw new Error('所选记录已变化，请刷新后重新勾选')
  return selected.map((key) => byId.get(key)!)
}

export function selectedCostColumns<T extends { key: string }>(columns: T[], fields: string[]) {
  const result = columns.filter((column) => fields.includes(column.key))
  if (!result.length) throw new Error('请至少选择一个导出字段')
  return result
}
