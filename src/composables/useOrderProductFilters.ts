import { computed, ref, watch } from 'vue'
import { getErpProductCategories, type ErpProductCategoryView } from '@/api/core/erp-internal'
import { getErpManagedProducts, type ErpManagedProductSummary, type ErpManagedProductVariant } from '@/api/core/erp-product'

interface Filters { categoryIds: string[]; productIds: string[]; productVariantIds: string[] }
interface CategoryNode { id: string; categoryName: string; children: CategoryNode[] }
const PRODUCT_LIMIT = 500

/** 订单明细与订单回款共用三级多选筛选；分类范围包含子分类，异步返回不得覆盖新选择。 */
export function useOrderProductFilters(filters: Filters) {
  const categoryOptions = ref<ErpProductCategoryView[]>([])
  const categoryLoading = ref(false)
  const categoryLoadFailed = ref(false)
  const productOptions = ref<ErpManagedProductSummary[]>([])
  const productSearching = ref(false)
  const productLoadFailed = ref(false)
  const variantOptions = ref<Array<ErpManagedProductVariant & { productId: string; productName: string }>>([])
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

  const variantGroups = computed(() => {
    const groups = new Map<string, { productId: string; productName: string; variants: ErpManagedProductVariant[] }>()
    for (const variant of variantOptions.value) {
      let group = groups.get(variant.productId)
      if (!group) {
        group = { productId: variant.productId, productName: variant.productName, variants: [] }
        groups.set(variant.productId, group)
      }
      group.variants.push(variant)
    }
    return [...groups.values()]
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

  async function categoryProducts(categoryIds: string[]) {
    if (!categoryOptions.value.length || categoryLoadFailed.value) await loadCategoryOptions()
    if (categoryLoadFailed.value) throw new Error('商品分类加载失败，请重试')
    const categories = new Set(categoryIds)
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
    const products = filters.productIds.map(Number)
    if (!filters.categoryIds.length) return products.length ? products : undefined
    const ids = (await categoryProducts([...filters.categoryIds])).map(row => Number(row.id))
    return products.length ? ids.filter(id => products.includes(id)) : ids
  }

  async function searchProductOptions(keyword: string) {
    const request = ++productRequest
    const categories = [...filters.categoryIds]
    productSearching.value = true
    productLoadFailed.value = false
    try {
      const query = keyword?.trim() || ''
      const rows = categories.length
        ? (await categoryProducts(categories)).filter(row => `${row.productName} ${row.productCode}`.toLowerCase().includes(query.toLowerCase()))
        : (await getErpManagedProducts({ begin: 0, step: 50,
            productName: /[\u4e00-\u9fa5]/.test(query) ? query : undefined,
            productCode: query && !/[\u4e00-\u9fa5]/.test(query) ? query : undefined,
          })).items
      if (request === productRequest) {
        const selected = productOptions.value.filter(row => filters.productIds.includes(String(row.id)))
        productOptions.value = [...new Map([...selected, ...rows].map(row => [String(row.id), row])).values()]
      }
    } catch {
      if (request === productRequest) { productOptions.value = []; productLoadFailed.value = true }
    } finally { if (request === productRequest) productSearching.value = false }
  }

  async function loadVariants() {
    const request = ++variantRequest
    const products = [...filters.productIds]
    variantOptions.value = variantOptions.value.filter(row => products.includes(row.productId))
    filters.productVariantIds = filters.productVariantIds.filter(id => variantOptions.value.some(row => String(row.id) === id))
    variantLoadFailed.value = false
    variantLoading.value = products.length > 0
    if (!products.length) return
    try {
      const variants: Array<ErpManagedProductVariant & { productId: string; productName: string }> = []
      for (let begin = 0; begin < products.length; begin += 200) {
        const page = await getErpManagedProducts({ begin: 0, step: 200, productIds: products.slice(begin, begin + 200), withVariants: true })
        for (const product of page.items) {
          variants.push(...(product.variants ?? []).map(variant => ({ ...variant, productId: String(product.id), productName: product.productName })))
        }
      }
      if (request === variantRequest) variantOptions.value = variants
    } catch { if (request === variantRequest) variantLoadFailed.value = true }
    finally { if (request === variantRequest) variantLoading.value = false }
  }

  watch(() => [...filters.categoryIds], () => {
    ++productRequest
    filters.productIds = []
    filters.productVariantIds = []
    productOptions.value = []
    productSearching.value = false
  }, { flush: 'sync' })
  watch(() => [...filters.productIds], () => { void loadVariants() }, { flush: 'sync' })

  return { categoryTree, categoryTreeProps, categoryLoading, categoryLoadFailed,
    productOptions, productSearching, productLoadFailed, variantOptions, variantGroups, variantLoading, variantLoadFailed,
    loadCategoryOptions, resolveProductIds, searchProductOptions, loadVariants,
    onCategoryChange: () => { void searchProductOptions('') },
    onCategoryVisibleChange: (visible: boolean) => {
      if (visible && (categoryLoadFailed.value || !categoryOptions.value.length)) void loadCategoryOptions()
    },
  }
}
