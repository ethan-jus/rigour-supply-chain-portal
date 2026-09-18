import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProductView from '@/views/supply-chain/erp/ErpProductManagementView.vue'

const mocks = vi.hoisted(() => ({
  route: { query: {} as Record<string, string> },
  products: vi.fn(),
  shelfStatus: vi.fn(),
  shelfDict: [
    { label: '上架', value: 'ON_SHELF' },
    { label: '下架', value: 'OFF_SHELF' },
  ] as Array<{ label: string; value: string }>,
}))

vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRoute: () => mocks.route,
}))
vi.mock('@/api/core/erp-product', () => ({
  getErpManagedProducts: mocks.products,
  getErpManagedProduct: vi.fn(),
  createErpManagedProduct: vi.fn(),
  updateErpManagedProduct: vi.fn(),
  updateErpProductShelfStatus: mocks.shelfStatus,
  updateErpProductOrdinal: vi.fn(),
  deleteErpManagedProduct: vi.fn(),
}))
vi.mock('@/api/core/erp-internal', () => ({
  getErpProductBrands: async () => ({ items: [] }),
  getErpProductTags: async () => ({ items: [] }),
  getErpInventoryWarehouses: async () => ({ items: [] }),
}))
vi.mock('@/utils/product-categories', () => ({ loadAllErpProductCategories: async () => [] }))
vi.mock('@/utils/business-dictionary', () => ({
  loadBusinessDictionaries: async () => {},
  businessDictionaryOptions: (_module: string, dictionaryCode: string) =>
    dictionaryCode === 'PRODUCT_SHELF_STATUS' ? mocks.shelfDict : [],
  businessDictionaryLabel: (_module: string, _dictionary: string, code: string) => code,
}))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
}))

function variant(id: string, code: string, spec: string, price: number, isDefault = false) {
  return {
    id,
    variantCode: code,
    specificationSnapshot: spec,
    unitCode: 'BOX',
    salePrice: price,
    marketPrice: null,
    purchasePrice: null,
    minOrderQuantity: null,
    orderMultipleQuantity: null,
    limitQuantity: null,
    defaultFlag: isDefault,
    remark: null,
    revision: 1,
    updatedTime: '2026-09-18T02:00:00Z',
  }
}

function product(
  id: string,
  code: string,
  name: string,
  variants: ReturnType<typeof variant>[],
  shelfStatusCode = 'ON_SHELF',
) {
  return {
    id,
    productCode: code,
    productName: name,
    businessLineName: null,
    categoryId: null,
    categoryName: '台球用品',
    categoryNameSnapshot: null,
    brandId: null,
    brandName: '三利',
    brandNameSnapshot: null,
    industryName: null,
    productSpecification: null,
    unitCode: 'BOX',
    saleTypeCode: 'SPOT',
    shelfStatusCode,
    ordinal: 0,
    submitStatusCode: 'SUBMITTED',
    sourceSystemCode: null,
    sourceDocumentNo: null,
    sourceCreatedAt: null,
    sourceUpdatedAt: null,
    defaultWarehouseId: null,
    defaultWarehouseName: null,
    defaultSalePrice: variants[0]?.salePrice ?? null,
    mainImageKey: null,
    mainImageUrl: null,
    variantCount: variants.length,
    variants,
    revision: 3,
    createdBy: 'u-1',
    createdTime: '2026-09-01T02:00:00Z',
    updatedBy: 'u-2',
    updatedTime: '2026-09-18T02:00:00Z',
  }
}

async function mountView() {
  const wrapper = mount(ProductView, {
    global: {
      plugins: [ElementPlus],
      stubs: { ProductCategorySelect: true, DhbPageSyncButton: true },
    },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.shelfDict = [
    { label: '上架', value: 'ON_SHELF' },
    { label: '下架', value: 'OFF_SHELF' },
  ]
  mocks.products.mockResolvedValue({
    items: [
      product('1', 'PRD001', '多规格商品', [
        variant('v1', 'SKU001', '蓝色', 12, true),
        variant('v2', 'SKU002', '红色', 13),
        variant('v3', 'SKU003', '绿色', 13.5),
      ]),
      product('2', 'PRD002', '单规格商品', [variant('v4', 'SKU004', '标准', 28, true)]),
    ],
    total: 2,
    begin: 0,
    step: 20,
  })
  mocks.shelfStatus.mockResolvedValue({ revision: 4, updatedBy: 'u-2', updatedTime: 'now' })
})

describe('商品列表按规格就地展开', () => {
  it('列表请求携带 withVariants，默认不展开，多规格给展开按钮、单规格不给', async () => {
    const wrapper = await mountView()

    expect(mocks.products).toHaveBeenLastCalledWith(expect.objectContaining({ withVariants: true }))
    expect(wrapper.findAll('.product-variant-row')).toHaveLength(0)

    const toggles = wrapper.findAll('.spec-toggle')
    expect(toggles).toHaveLength(1)
    expect(toggles[0]!.text()).toContain('3 种')
    // 单规格商品只显示静态数量，不给无意义的展开入口
    expect(wrapper.findAll('.spec-static').map((node) => node.text())).toContain('1 种')

    wrapper.unmount()
  })

  it('点击展开后铺出该商品全部规格子行，再点收起', async () => {
    const wrapper = await mountView()
    const toggle = wrapper.find('.spec-toggle')

    await toggle.trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.product-variant-row')).toHaveLength(3)

    await toggle.trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.product-variant-row')).toHaveLength(0)

    wrapper.unmount()
  })

  it('多规格价格不一致时列表订货价显示区间', async () => {
    const wrapper = await mountView()

    expect(wrapper.find('.order-price').text()).toBe('¥12.00 ~ ¥13.50')

    wrapper.unmount()
  })

  it('切换上架状态调用就地接口并带上乐观锁 revision', async () => {
    const wrapper = await mountView()

    await wrapper.find('.shelf-switch').trigger('click')
    await flushPromises()

    expect(mocks.shelfStatus).toHaveBeenCalledWith('1', 'OFF_SHELF', 3)

    wrapper.unmount()
  })

  it('上架状态字典不是上架/下架两态时，开关退回字典下拉', async () => {
    mocks.shelfDict = [
      { label: '上架', value: 'ON_SHELF' },
      { label: '下架', value: 'OFF_SHELF' },
      { label: '待上架', value: 'PENDING_SHELF' },
    ]
    const wrapper = await mountView()

    expect(wrapper.findAll('.shelf-switch')).toHaveLength(0)

    wrapper.unmount()
  })
})

describe('商品详情入口', () => {
  it('详情由图片和商品名称触发，不再挂在整行点击上', async () => {
    const wrapper = await mountView()

    const table = wrapper.findComponent({ name: 'ElTable' })
    expect(table.props('onRowClick')).toBeUndefined()
    expect(wrapper.find('.product-name-link').exists()).toBe(true)
    expect(wrapper.find('.product-thumb-wrap--list').element.tagName).toBe('BUTTON')

    wrapper.unmount()
  })
})
