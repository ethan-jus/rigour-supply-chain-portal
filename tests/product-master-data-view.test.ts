import { defineComponent, type PropType } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const erpApi = vi.hoisted(() => ({
  getErpProducts: vi.fn(),
  getErpSkus: vi.fn(),
  getErpBrands: vi.fn(),
  getErpCategories: vi.fn(),
  getErpSpecifications: vi.fn(),
  getErpTags: vi.fn(),
  syncErpData: vi.fn(),
}))
const routeMeta = vi.hoisted(() => ({ routeKey: 'supply.erp.master-data.products' }))

vi.mock('@/api', () => erpApi)
vi.mock('@/api/core/business-settings', () => ({
  resolveBizDict: vi.fn().mockResolvedValue({ dictionary: {}, items: [] }),
}))
vi.mock('vue-router', () => ({ useRoute: () => ({ meta: routeMeta }) }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ hasPermission: () => false }),
}))
vi.mock('element-plus', () => ({
  ElMessage: { error: vi.fn(), warning: vi.fn(), success: vi.fn() },
}))

import ProductMasterDataView from '@/views/supply-chain/erp/ProductMasterDataView.vue'

const passthrough = defineComponent({ template: '<div><slot name="header" /><slot /></div>' })
const emptyStub = defineComponent({ template: '<span />' })
const imageStub = defineComponent({
  props: {
    src: { type: String, default: '' },
    previewSrcList: { type: Array as PropType<string[]>, default: () => [] },
    initialIndex: { type: Number, default: undefined },
  },
  template: '<button class="image-stub">{{ src }}</button>',
})

function mountPage() {
  return mount(ProductMasterDataView, {
    global: {
      directives: { loading: () => {} },
      stubs: {
        ElAlert: passthrough,
        ElButton: passthrough,
        ElCard: passthrough,
        ElDrawer: passthrough,
        ElEmpty: passthrough,
        ElForm: passthrough,
        ElFormItem: passthrough,
        ElImage: imageStub,
        ElInput: passthrough,
        ElOption: passthrough,
        ElPagination: passthrough,
        ElSelect: passthrough,
        ElTabPane: passthrough,
        ElTable: passthrough,
        ElTableColumn: emptyStub,
        ElTabs: passthrough,
        ElTag: passthrough,
      },
    },
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function productPage(id: string, name: string) {
  return {
    total: 1,
    begin: 0,
    step: 20,
    items: [{
      id,
      sourceProductId: `source-${id}`,
      spuCode: `SPU-${id}`,
      name,
      brandName: null,
      categoryName: null,
      barcode: null,
      unit: null,
      conversionBarcode: null,
      sourcePutaway: null,
      internalStatus: 'ACTIVE',
      ownershipState: 'EXTERNAL_PRIMARY',
      skuCount: 0,
      syncedAt: null,
    }],
  }
}

describe('ERP 商品/SPU 页面', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    routeMeta.routeKey = 'supply.erp.master-data.products'
    erpApi.getErpProducts.mockResolvedValue({
      total: 1,
      begin: 0,
      step: 20,
      items: [{
        id: 'product-1',
        sourceProductId: 'source-1',
        spuCode: 'SPU-1',
        name: '测试商品',
        brandName: '测试品牌',
        categoryName: '测试分类',
        barcode: 'barcode-1',
        unit: '件',
        conversionBarcode: null,
        sourcePutaway: 'T',
        internalStatus: 'ACTIVE',
        ownershipState: 'EXTERNAL_PRIMARY',
        skuCount: 2,
        syncedAt: null,
        model: null,
        subtitle: null,
        keywords: null,
        goodsAllocation: null,
        sourceMultiId: null,
        sourceCategoryId: null,
        sourceBrandId: null,
        orderPrice: null,
        marketPrice: null,
        purchasePrice: null,
        price4: null,
        middleUnit: null,
        bigUnit: null,
        middleBarcode: null,
        bigBarcode: null,
        baseToMiddleRate: null,
        baseToBigRate: null,
        minimumOrder: null,
        minimumOrderUnit: null,
        inventoryLower: null,
        inventoryUpper: null,
        safetyInventory: null,
        middleOrderPrice: null,
        bigOrderPrice: null,
        images: [
          { id: 'image-1', url: 'https://image.test/1.png', originalName: '一图' },
          { id: 'image-2', url: 'https://image.test/2.png', originalName: '二图' },
        ],
        skus: [],
        customFields: {},
      }],
    })
    erpApi.getErpSkus.mockResolvedValue({ total: 0, begin: 0, step: 1000, items: [] })
  })

  it('点击商品图片缩略图时使用对应图片的预览索引', async () => {
    const wrapper = mountPage()
    await flushPromises()

    const state = wrapper.vm as unknown as {
      data: { items: unknown[] }
      openProductDetail: (row: unknown) => Promise<void>
    }
    await state.openProductDetail(state.data.items[0])
    await flushPromises()

    const previewIndices = wrapper
      .findAllComponents(imageStub)
      .map((image) => image.props('initialIndex'))
      .filter((index): index is number => typeof index === 'number')

    expect(previewIndices).toEqual([0, 1])
  })

  it('并发查询时忽略较早请求的慢响应', async () => {
    const first = deferred<ReturnType<typeof productPage>>()
    const second = deferred<ReturnType<typeof productPage>>()
    erpApi.getErpProducts
      .mockReset()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const wrapper = mountPage()
    await Promise.resolve()
    const state = wrapper.vm as unknown as {
      data: { items: Array<{ name: string }> }
      load: () => Promise<void>
    }
    const secondLoad = state.load()

    second.resolve(productPage('new', '最新查询数据'))
    await secondLoad
    first.resolve(productPage('old', '过期慢响应数据'))
    await flushPromises()

    expect(state.data.items[0]?.name).toBe('最新查询数据')
  })
})
