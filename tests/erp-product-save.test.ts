import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProductView from '@/views/supply-chain/erp/ErpProductManagementView.vue'

const mocks = vi.hoisted(() => ({
  route: { query: {} as Record<string, string> },
  products: vi.fn(),
  detail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  shelfStatus: vi.fn(),
}))

vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRoute: () => mocks.route,
}))
vi.mock('@/api/core/erp-product', () => ({
  getErpManagedProducts: mocks.products,
  getErpManagedProduct: mocks.detail,
  createErpManagedProduct: mocks.create,
  updateErpManagedProduct: mocks.update,
  updateErpProductShelfStatus: mocks.shelfStatus,
  updateErpProductOrdinal: vi.fn(),
  deleteErpManagedProduct: vi.fn(),
}))
vi.mock('@/api/core/erp-internal', () => ({
  getErpProductBrands: async () => ({ items: [] }),
  getErpProductTags: async () => ({ items: [] }),
  getErpInventoryWarehouses: async () => ({ items: [] }),
  getErpProductSpecifications: async () => ({
    items: [
      {
        id: 's1',
        specificationCode: 'SPEC',
        specificationName: '规格',
        statusCode: 'ACTIVE',
        valueCount: 1,
        values: [
          {
            id: 'v1',
            valueCode: 'V1',
            valueName: '默认规格',
            ordinal: 1,
            statusCode: 'ACTIVE',
            revision: 1,
          },
        ],
        revision: 1,
      },
    ],
    total: 1,
    begin: 0,
    step: 200,
  }),
}))
vi.mock('@/utils/product-categories', () => ({ loadAllErpProductCategories: async () => [] }))
vi.mock('@/utils/business-dictionary', () => ({
  loadBusinessDictionaries: async () => {},
  businessDictionaryOptions: (_module: string, dictionaryCode: string) =>
    dictionaryCode === 'PRODUCT_SHELF_STATUS'
      ? [
          { label: '上架', value: 'ON_SHELF' },
          { label: '下架', value: 'OFF_SHELF' },
        ]
      : [],
  businessDictionaryLabel: (_module: string, _dictionary: string, code: string) => code,
}))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
}))

function product(
  id: string,
  code: string,
  name: string,
  variants: Array<Record<string, unknown>>,
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
    middleUnitCode: null,
    bigUnitCode: null,
    baseToMiddleRate: null,
    baseToBigRate: null,
    statisticsUnitLevel: null,
    saleTypeCode: 'SPOT',
    shelfStatusCode: 'ON_SHELF',
    ordinal: 0,
    submitStatusCode: 'DRAFT',
    sourceSystemCode: null,
    sourceDocumentNo: null,
    sourceCreatedAt: null,
    sourceUpdatedAt: null,
    defaultWarehouseId: '1',
    defaultWarehouseName: '主仓',
    defaultSalePrice: variants[0]?.salePrice ?? null,
    mainImageKey: null,
    mainImageUrl: null,
    variantCount: variants.length,
    variants,
    images: [],
    revision: 3,
    createdBy: 'u-1',
    createdTime: '2026-09-01T02:00:00Z',
    updatedBy: 'u-2',
    updatedTime: '2026-09-18T02:00:00Z',
  }
}

function variant(id: string, code: string, spec: string, price: number) {
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
    defaultFlag: true,
    remark: null,
    revision: 1,
    updatedTime: '2026-09-18T02:00:00Z',
  }
}

function bodyButton(text: string) {
  const button = Array.from(document.body.querySelectorAll('button')).find(
    (node) => node.textContent?.trim() === text,
  )
  if (!button) throw new Error(`button not found: ${text}`)
  return button
}

async function openEditor(wrapper: ReturnType<typeof mount>) {
  const editButton = wrapper.findAll('button').find((node) => node.text() === '编辑')
  expect(editButton).toBeTruthy()
  await editButton!.trigger('click')
  await flushPromises()
}

describe('商品编辑保存链路', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.products.mockResolvedValue({
      items: [product('1', 'PRD001', '多规格商品', [variant('v1', 'SKU001', '蓝色', 12)])],
      total: 1,
      begin: 0,
      step: 20,
    })
    mocks.update.mockResolvedValue({})
    mocks.create.mockResolvedValue({})
    mocks.shelfStatus.mockResolvedValue({})
  })

  it('点击保存草稿会真实发出更新请求', async () => {
    mocks.detail.mockResolvedValue(
      product('1', 'PRD001', '多规格商品', [variant('v1', 'SKU001', '蓝色', 12)]),
    )
    const wrapper = mount(ProductView, {
      global: { plugins: [ElementPlus], stubs: { ProductCategorySelect: true, DhbPageSyncButton: true } },
      attachTo: document.body,
    })
    await flushPromises()

    await openEditor(wrapper)
    expect(document.body.textContent).toContain('编辑商品')

    bodyButton('保存草稿').click()
    await flushPromises()

    expect(mocks.update).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({ submit: false, revision: 3 }),
    )
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('没有规格价格时点保存并提交：不发请求并在规格价格区内联提示', async () => {
    mocks.detail.mockResolvedValue(product('1', 'PRD001', '无规格商品', []))
    const wrapper = mount(ProductView, {
      global: { plugins: [ElementPlus], stubs: { ProductCategorySelect: true, DhbPageSyncButton: true } },
      attachTo: document.body,
    })
    await flushPromises()

    await openEditor(wrapper)
    bodyButton('保存并提交').click()
    await flushPromises()

    expect(mocks.update).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('规格价格至少一条')
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('缺少归属仓库时提交被拦截并明确提示', async () => {
    mocks.detail.mockResolvedValue({
      ...product('1', 'PRD001', '无仓库商品', [variant('v1', 'SKU001', '默认规格', 12)]),
      defaultWarehouseId: null,
    })
    const wrapper = mount(ProductView, {
      global: { plugins: [ElementPlus], stubs: { ProductCategorySelect: true, DhbPageSyncButton: true } },
      attachTo: document.body,
    })
    await flushPromises()

    await openEditor(wrapper)
    bodyButton('保存并提交').click()
    await flushPromises()

    expect(mocks.update).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('归属仓库（提交必填）')
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('从规格主档选择规格值后保存并提交发出请求', async () => {
    mocks.detail.mockResolvedValue(product('1', 'PRD001', '无规格商品', []))
    const wrapper = mount(ProductView, {
      global: { plugins: [ElementPlus], stubs: { ProductCategorySelect: true, DhbPageSyncButton: true } },
      attachTo: document.body,
    })
    await flushPromises()

    await openEditor(wrapper)

    const specSelect = document.body.querySelector(
      '.variant-editor__form .el-select__wrapper',
    ) as HTMLElement | null
    expect(specSelect).toBeTruthy()
    specSelect!.click()
    await flushPromises()
    const option = Array.from(
      document.body.querySelectorAll('.el-select-dropdown__item'),
    ).find((node) => node.textContent?.includes('默认规格'))
    expect(option).toBeTruthy()
    ;(option as HTMLElement).click()
    await flushPromises()

    // 提交要求售价大于 0，填入售价
    const priceInput = document.body.querySelector<HTMLInputElement>(
      '.variant-editor__form .el-input-number input',
    )
    expect(priceInput).toBeTruthy()
    priceInput!.value = '10'
    priceInput!.dispatchEvent(new Event('input'))
    await flushPromises()

    bodyButton('保存并提交').click()
    await flushPromises()

    expect(mocks.update).toHaveBeenCalledWith(
      '1',
      expect.objectContaining({
        submit: true,
        variants: expect.arrayContaining([
          expect.objectContaining({ specificationSnapshot: '默认规格' }),
        ]),
      }),
    )
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('保存失败时在弹窗页脚显示失败原因', async () => {
    mocks.detail.mockResolvedValue(
      product('1', 'PRD001', '多规格商品', [variant('v1', 'SKU001', '蓝色', 12)]),
    )
    mocks.update.mockRejectedValue({ code: 'BAD_REQUEST', message: '提交商品至少需要一个规格价格' })
    const wrapper = mount(ProductView, {
      global: { plugins: [ElementPlus], stubs: { ProductCategorySelect: true, DhbPageSyncButton: true } },
      attachTo: document.body,
    })
    await flushPromises()

    await openEditor(wrapper)
    bodyButton('保存并提交').click()
    await flushPromises()

    expect(document.body.textContent).toContain('提交商品至少需要一个规格价格')
    wrapper.unmount()
    document.body.innerHTML = ''
  })
})
