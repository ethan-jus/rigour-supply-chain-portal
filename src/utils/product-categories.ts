import { getErpProductCategories, type ErpProductCategoryView } from '@/api/core/erp-internal'

const CATEGORY_PAGE_SIZE = 100

export async function loadAllErpProductCategories(): Promise<ErpProductCategoryView[]> {
  const items: ErpProductCategoryView[] = []
  let begin = 0
  let total = Number.POSITIVE_INFINITY

  while (begin < total) {
    const page = await getErpProductCategories({ begin, step: CATEGORY_PAGE_SIZE })
    items.push(...page.items)
    total = Number(page.total || 0)
    if (!page.items.length) break
    begin += page.items.length
  }

  return items
}
