import { computed, ref, watch } from 'vue'
import { getErpProductCategories, type ErpProductCategoryView } from '@/api/core/erp-internal'
import { getErpManagedProducts, type ErpManagedProductSummary, type ErpManagedProductVariant } from '@/api/core/erp-product'

interface Filters { categoryId?: string | null; productId?: string | null; productVariantId?: string | null }
interface CategoryNode { id: string; categoryName: string; children: CategoryNode[] }
const PRODUCT_LIMIT = 500

/** 明细与回款共用三级筛选；分类范围包含子分类，异步返回不得覆盖新选择。 */
export function useOrderProductFilters(filters: Filters) {
  const categoryOptions = ref<ErpProductCategoryView[]>([])
  const categoryLoading = ref(false)
  const categoryLoadFailed = ref(false)
  const productOptions = ref<ErpManagedProductSummary[]>([])
  const productSearching = ref(false)
  const productLoadFailed = ref(false)
  const variantOptions = ref<ErpManagedProductVariant[]>([])
  const variantLoading = ref(false)
  const variantLoadFailed = ref(false)
  const categoryTreeProps = { label: 'categoryName', children: 'children' }
  let categoryRequest: Promise<void> | undefined
  let productRequest = 0
  let variantRequest = 0
  const categoryTree = computed(() => {
    const nodes = new Map<string, CategoryNode>()
    categoryOptions.value.forEach(row => nodes.set(String(row.id), { id: String(row.id), categoryName: row.categoryName, children: [] }))
    const roots: CategoryNode[] = []
    categoryOptions.value.forEach(row => {
      const node = nodes.get(String(row.id))!
      const parent = row.parentId == null ? undefined : nodes.get(String(row.parentId))
      if (parent && parent !== node) parent.children.push(node)
      else roots.push(node)
    })
    return roots
  })

  async function loadCategoryOptions() {
    if (categoryRequest) return categoryRequest
    categoryLoading.value = true
    categoryLoadFailed.value = false
    categoryRequest = (async () => {
      try {
        const rows: ErpProductCategoryView[] = []
        for (let begin = 0; ; begin += 200) {
          const page = await getErpProductCategories({ begin, step: 200 })
          rows.push(...page.items)
          if (rows.length >= page.total || !page.items.length) break
          if (begin >= 9800) throw new Error('分类数量过多')
        }
        categoryOptions.value = rows
      } catch { categoryLoadFailed.value = true }
      finally { categoryLoading.value = false; categoryRequest = undefined }
    })()
    return categoryRequest
  }

  async function categoryProducts(categoryId: string) {
    if (!categoryOptions.value.length || categoryLoadFailed.value) await loadCategoryOptions()
    if (categoryLoadFailed.value) throw new Error('商品分类加载失败，请重试')
    const categories = new Set([categoryId])
    for (const id of categories) {
      categoryOptions.value.forEach(row => {
        if (row.parentId != null && String(row.parentId) === id) categories.add(String(row.id))
      })
    }
    const products = new Map<string, ErpManagedProductSummary>()
    for (const id of categories) {
      for (let begin = 0; ; begin += 200) {
        const page = await getErpManagedProducts({ begin, step: 200, categoryId: id })
        page.items.forEach(row => products.set(String(row.id), row))
        if (page.total > PRODUCT_LIMIT || products.size > PRODUCT_LIMIT) throw new Error(`分类下商品超过 ${PRODUCT_LIMIT} 个，请缩小分类范围后查询，避免统计不完整`)
        if (begin + page.items.length >= page.total || !page.items.length) break
      }
    }
    return [...products.values()]
  }

  async function resolveProductIds(): Promise<number[] | undefined> {
    const category = filters.categoryId
    const product = filters.productId
    if (!category) return product ? [Number(product)] : undefined
    const ids = (await categoryProducts(category)).map(row => Number(row.id))
    return product ? ids.filter(id => id === Number(product)) : ids
  }

  async function searchProductOptions(keyword: string) {
    const request = ++productRequest
    const category = filters.categoryId
    productSearching.value = true
    productLoadFailed.value = false
    try {
      const query = keyword?.trim() || ''
      const rows = category
        ? (await categoryProducts(category)).filter(row => `${row.productName} ${row.productCode}`.toLowerCase().includes(query.toLowerCase()))
        : (await getErpManagedProducts({ begin: 0, step: 50,
            productName: /[\u4e00-\u9fa5]/.test(query) ? query : undefined,
            productCode: query && !/[\u4e00-\u9fa5]/.test(query) ? query : undefined,
          })).items
      if (request === productRequest) productOptions.value = rows
    } catch {
      if (request === productRequest) { productOptions.value = []; productLoadFailed.value = true }
    } finally { if (request === productRequest) productSearching.value = false }
  }

  async function loadVariants() {
    const request = ++variantRequest
    const product = filters.productId
    variantOptions.value = []
    variantLoadFailed.value = false
    variantLoading.value = !!product
    if (!product) return
    try {
      const page = await getErpManagedProducts({ begin: 0, step: 1, productIds: [product], withVariants: true })
      if (request === variantRequest) variantOptions.value = page.items.find(row => String(row.id) === product)?.variants ?? []
    } catch { if (request === variantRequest) variantLoadFailed.value = true }
    finally { if (request === variantRequest) variantLoading.value = false }
  }

  watch(() => filters.categoryId, () => {
    ++productRequest
    filters.productId = ''
    filters.productVariantId = ''
    productOptions.value = []
    productSearching.value = false
  }, { flush: 'sync' })
  watch(() => filters.productId, () => {
    filters.productVariantId = ''
    void loadVariants()
  }, { flush: 'sync' })

  return { categoryTree, categoryTreeProps, categoryLoading, categoryLoadFailed,
    productOptions, productSearching, productLoadFailed, variantOptions, variantLoading, variantLoadFailed,
    loadCategoryOptions, resolveProductIds, searchProductOptions, loadVariants,
    onCategoryChange: () => { void searchProductOptions('') },
    onCategoryVisibleChange: (visible: boolean) => {
      if (visible && (categoryLoadFailed.value || !categoryOptions.value.length)) void loadCategoryOptions()
    },
  }
}
