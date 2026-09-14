import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProductView from '@/views/supply-chain/erp/ErpProductManagementView.vue'

const mocks = vi.hoisted(() => ({
  route: { query: { brandId: '123', brandName: '测试品牌' } as Record<string, string> },
  products: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRoute: () => mocks.route }))
vi.mock('@/api/core/erp-product', () => ({
  getErpManagedProducts: mocks.products,
  getErpManagedProduct: vi.fn(),
  createErpManagedProduct: vi.fn(),
  updateErpManagedProduct: vi.fn(),
  deleteErpManagedProduct: vi.fn(),
}))
vi.mock('@/api/core/erp-internal', () => ({
  getErpProductBrands: async () => ({ items: [{ id: '456', brandName: '另一品牌' }] }),
  getErpProductTags: async () => ({ items: [] }),
  getErpInventoryWarehouses: async () => ({ items: [] }),
}))
vi.mock('@/utils/product-categories', () => ({ loadAllErpProductCategories: async () => [] }))
vi.mock('@/utils/business-dictionary', () => ({
  loadBusinessDictionaries: async () => {},
  businessDictionaryOptions: () => [],
  businessDictionaryLabel: (_module: string, _dictionary: string, code: string) => code,
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.products.mockResolvedValue({ items: [], total: 0, begin: 0, step: 20 })
})

describe('BI 品牌下钻到 ERP', () => {
  it('首次请求使用品牌 ID，选中名称不受品牌列表前 50 条限制，换品牌从第一页查，重置清除范围', async () => {
    const wrapper = mount(ProductView, {
      global: { plugins: [ElementPlus], stubs: { ProductCategorySelect: true } },
    })
    await flushPromises()
    expect(mocks.products).toHaveBeenLastCalledWith(
      expect.objectContaining({ brandId: '123', begin: 0 }),
    )
    const select = wrapper
      .findAllComponents({ name: 'ElSelect' })
      .find((item) => item.props('placeholder') === '全部品牌')!
    expect(select.props('modelValue')).toBe('123')
    expect(
      select
        .findAllComponents({ name: 'ElOption' })
        .some((item) => item.props('label') === '测试品牌'),
    ).toBe(true)
    const pagination = wrapper.findComponent({ name: 'ElPagination' })
    pagination.vm.$emit('update:current-page', 3)
    await flushPromises()
    select.vm.$emit('update:modelValue', '456')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.products).toHaveBeenLastCalledWith(
      expect.objectContaining({ brandId: '456', begin: 0 }),
    )
    await wrapper
      .findAll('button')
      .find((item) => item.text() === '重置')!
      .trigger('click')
    await flushPromises()
    expect(mocks.products).toHaveBeenLastCalledWith(
      expect.objectContaining({ brandId: undefined, begin: 0 }),
    )
    expect(select.props('modelValue')).toBe('')
    wrapper.unmount()
  })
})
