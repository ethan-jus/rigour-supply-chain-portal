import { effectScope, reactive } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ categories: vi.fn(), products: vi.fn() }))
vi.mock('@/api/core/erp-internal', () => ({ getErpProductCategories: mocks.categories }))
vi.mock('@/api/core/erp-product', () => ({ getErpManagedProducts: mocks.products }))
import { useOrderProductFilters } from '@/composables/useOrderProductFilters'
beforeEach(() => {
  vi.resetAllMocks()
  mocks.categories.mockResolvedValue({ total: 3, items: [
    { id: 1, parentId: null, categoryName: '快消品' }, { id: 2, parentId: 1, categoryName: '食品' }, { id: 3, parentId: null, categoryName: '台球用品' },
  ] })
  mocks.products.mockImplementation(async (q: { categoryId?: string; productIds?: string[]; withVariants?: boolean }) => {
    if (q.withVariants) return { total: 1, items: [{ id: q.productIds![0], variants: [{ id: `${q.productIds![0]}01`, variantCode: 'SKU', specificationSnapshot: '规格' }] }] }
    const rows = q.categoryId === '1' ? [{ id: '10', productName: '饮料', productCode: 'A' }] : q.categoryId === '2' ? [{ id: '20', productName: '方便面', productCode: 'B' }] : [{ id: '30', productName: '台呢', productCode: 'C' }]
    return { total: rows.length, items: rows }
  })
})
it('父分类仅显示本类及子类商品，换类/清空商品同步清空规格', async () => {
  const scope = effectScope()
  const filters = reactive({ categoryId: '', productId: '', productVariantId: '' })
  const f = scope.run(() => useOrderProductFilters(filters))!
  filters.categoryId = '1'
  await f.searchProductOptions('')
  expect(f.productOptions.value.map(p => p.id)).toEqual(['10', '20'])
  filters.productId = '20'; await flushPromises()
  expect(f.variantOptions.value.map(v => v.id)).toEqual(['2001'])
  filters.productVariantId = '2001'
  filters.productId = '10'; await flushPromises()
  expect(filters.productVariantId).toBe('')
  expect(f.variantOptions.value.map(v => v.id)).toEqual(['1001'])
  filters.productVariantId = '1001'
  filters.categoryId = '3'
  expect(filters.productId).toBe('')
  expect(filters.productVariantId).toBe('')
  expect(f.variantOptions.value).toEqual([])
  await f.searchProductOptions(''); expect(f.productOptions.value.map(p => p.id)).toEqual(['30'])
  scope.stop()
})
it('较慢的旧商品规格响应不能覆盖新商品规格', async () => {
  const scope = effectScope()
  const filters = reactive({ categoryId: '', productId: '', productVariantId: '' })
  const f = scope.run(() => useOrderProductFilters(filters))!
  let finish!: (value: unknown) => void
  mocks.products.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  filters.productId = '10'
  filters.productId = '20'; await flushPromises()
  finish({ total: 1, items: [{ id: '10', variants: [{ id: 'old' }] }] }); await flushPromises()
  expect(f.variantOptions.value.map(v => v.id)).toEqual(['2001'])
  filters.productId = ''
  expect(f.variantOptions.value).toEqual([])
  scope.stop()
})
it('规格失败可重试，分类商品交集为空不扩大查询', async () => {
  const scope = effectScope()
  const filters = reactive({ categoryId: '1', productId: '', productVariantId: '' })
  const f = scope.run(() => useOrderProductFilters(filters))!
  mocks.products.mockRejectedValueOnce(new Error('断网'))
  filters.productId = '20'; await flushPromises()
  expect(f.variantLoadFailed.value).toBe(true)
  await f.loadVariants(); expect(f.variantLoadFailed.value).toBe(false)
  filters.productId = '30'; await flushPromises()
  expect(await f.resolveProductIds()).toEqual([])
  scope.stop()
})
