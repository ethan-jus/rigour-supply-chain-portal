import type { PayrollCategory, PayrollProduct } from '@/api/core/payroll'

export interface CommissionCategoryScope {
  categoryIds: number[]
  excludedCategoryIds: number[]
}

export function commissionCategoryScope(categories: PayrollCategory[]) {
  const index = new Map(categories.map((category) => [category.id, category]))
  function within(id: number | null, roots: number[]) {
    const visited = new Set<number>()
    while (id != null && !visited.has(id)) {
      if (roots.includes(id)) return true
      visited.add(id)
      id = index.get(id)?.parentId ?? null
    }
    return false
  }
  function compact(ids: number[]) {
    return [...new Set(ids)].filter((id) => !within(index.get(id)?.parentId ?? null, ids))
  }
  function checked(scope: CommissionCategoryScope) {
    return compact([
      ...categories
        .filter(
          (category) =>
            within(category.id, scope.categoryIds) &&
            !within(category.id, scope.excludedCategoryIds) &&
            !scope.excludedCategoryIds.some((excluded) => within(excluded, [category.id])),
        )
        .map((category) => category.id),
      ...scope.categoryIds.filter((id) => !index.has(id)),
    ])
  }
  function remove(scope: CommissionCategoryScope, id: number): CommissionCategoryScope {
    return {
      categoryIds: scope.categoryIds.filter((key) => key !== id && !within(key, [id])),
      excludedCategoryIds: scope.excludedCategoryIds.filter((key) => !within(key, [id])),
    }
  }
  function update(
    previous: CommissionCategoryScope,
    checkedKeys: number[],
    halfCheckedKeys: number[],
  ): CommissionCategoryScope {
    const full = new Set(checkedKeys)
    const partial = new Set(halfCheckedKeys)
    // 部分取消时保留原父分类，明确排除未选子类；父分类直属商品和分类匹配优先级不变。
    const categoryIds = compact([
      ...previous.categoryIds.filter((id) => !index.has(id) || full.has(id) || partial.has(id)),
      ...checkedKeys,
    ])
    const excludedCategoryIds = previous.excludedCategoryIds.filter((id) => !index.has(id))
    function excludeUnchecked(id: number) {
      if (!index.has(id) || full.has(id)) return
      if (!partial.has(id)) {
        excludedCategoryIds.push(id)
        return
      }
      categories
        .filter((category) => category.parentId === id)
        .forEach((child) => excludeUnchecked(child.id))
    }
    categoryIds.forEach(excludeUnchecked)
    return { categoryIds, excludedCategoryIds: compact(excludedCategoryIds) }
  }
  function includes(product: PayrollProduct, scope: CommissionCategoryScope) {
    return (
      (!scope.categoryIds.length || within(product.categoryId, scope.categoryIds)) &&
      !within(product.categoryId, scope.excludedCategoryIds)
    )
  }
  return { checked, update, remove, includes, compact }
}
