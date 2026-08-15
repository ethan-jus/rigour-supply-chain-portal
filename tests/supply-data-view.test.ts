import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const erpApi = vi.hoisted(() => ({
  getErpInventoryBalances: vi.fn(),
  getErpPurchaseOrder: vi.fn(),
  getErpPurchaseOrders: vi.fn(),
  getErpPurchaseReturn: vi.fn(),
  getErpPurchaseReturns: vi.fn(),
  getErpSuppliers: vi.fn(),
  getErpWarehouses: vi.fn(),
  getErpWarehousingReceipt: vi.fn(),
  getErpWarehousingReceipts: vi.fn(),
  syncErpData: vi.fn(),
}))
const routeMeta = vi.hoisted(() => ({ routeKey: 'supply.erp.procurement.receipts' }))

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

import SupplyDataView from '@/views/supply-chain/erp/SupplyDataView.vue'
import {
  clearBusinessDictionariesForTest,
  seedBusinessDictionaryForTest,
} from '@/utils/business-dictionary'

const passthrough = defineComponent({ template: '<div><slot name="header" /><slot /></div>' })
const emptyStub = defineComponent({ template: '<span />' })

function mountPage() {
  return mount(SupplyDataView, {
    global: {
      directives: { loading: () => {} },
      stubs: {
        ElAlert: passthrough,
        ElButton: passthrough,
        ElCard: passthrough,
        ElCollapse: passthrough,
        ElCollapseItem: passthrough,
        ElDescriptions: passthrough,
        ElDescriptionsItem: passthrough,
        ElDrawer: passthrough,
        ElEmpty: emptyStub,
        ElForm: passthrough,
        ElFormItem: passthrough,
        ElInput: emptyStub,
        ElOption: emptyStub,
        ElPagination: emptyStub,
        ElSelect: passthrough,
        ElSkeleton: emptyStub,
        ElTable: passthrough,
        ElTableColumn: emptyStub,
        ElTag: passthrough,
      },
    },
  })
}

describe('ERP 入库数据页面', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearBusinessDictionariesForTest()
    seedBusinessDictionaryForTest('ERP', 'DHB_PURCHASE_ORDER_STATUS', [{
      code: 'FINISHED', name: '已完成', value: 'finished', status: 'ACTIVE', sortNo: 10,
    }])
    seedBusinessDictionaryForTest('ERP', 'DHB_PURCHASE_PAYMENT_STATUS', [{
      code: 'PAIDED', name: '已付款', value: 'paided', status: 'ACTIVE', sortNo: 10,
    }])
    const line = {
      sourceLineId: 'line-1', sourceGoodsId: 'goods-1', goodsCode: 'G-1', goodsName: '商品一',
      optionsId: null, optionsGoodsCode: null, optionsSummary: '-', baseQuantity: 1, unitQuantity: 1,
      unitCode: 'piece', unitName: '件', conversionNumber: 1, costPrice: 9, unitCostPrice: 9,
      purchasePrice: 10, wholesalePrice: 10, allocation: null, barcode: null, goodsModel: null,
      sourceRealQuantity: null, sourceAvailableQuantity: null, collaboratorSourceId: null,
      collaboratorName: null, remark: null, sourceFields: { RawLineField: 'must-not-be-rendered' },
    }
    erpApi.getErpWarehousingReceipts.mockResolvedValue({
      total: 1,
      begin: 0,
      step: 20,
      items: [{
        id: 'receipt-1', warehousingNo: 'RK-1', sourceId: 'source-1', sourceWarehousingId: 'source-1',
        warehouseName: '一号仓', supplierName: '供应商一', typeName: '采购入库', sourceStatusName: '已完成',
        staffName: '经办人', collaboratorName: null, totalAmount: 10, costAmount: 9, freightAmount: 1,
        expressNumber: null, lineCount: 1, storageAt: null, sourceCreatedAt: null, sourceUpdatedAt: null,
        syncedAt: null,
      }],
    })
    erpApi.getErpWarehousingReceipt.mockResolvedValue({
      erpId: 'receipt-1', sourceId: 'source-1', number: 'RK-1', warehouseSourceId: 'warehouse-1',
      warehouseName: '一号仓', supplierSourceId: 'supplier-1', supplierName: '供应商一', typeId: 'purchase',
      typeName: '采购入库', sourceStatus: 'completed', sourceStatusName: '已完成', staffName: '经办人',
      clientSourceId: null, accountSourceId: null, collaboratorSourceId: null, collaboratorName: null,
      logisticsSourceId: null, expressNumber: null, storageAt: null, sourceCreatedAt: null,
      sourceUpdatedAt: null, freightAmount: 1, totalAmount: 10, costAmount: 9, apiFlag: true,
      splitType: null, remark: null, sourceFields: { RawField: 'must-not-be-rendered' },
      lines: [line],
      purchaseLinks: [],
    })
    erpApi.getErpPurchaseOrders.mockResolvedValue({
      total: 1, begin: 0, step: 20,
      items: [{ id: 'order-1', purchaseOrderNo: 'PO-1', sourceId: 'source-order', supplierName: '供应商一',
        warehouseName: '一号仓', staffName: '经办人', sourceStatus: 'finished', sourceStatusName: '已完成',
        paymentStatus: 'paided', paymentStatusName: '已付款',
        totalAmount: 10, paidAmount: 10, lineCount: 1, sourceCreatedAt: null, syncedAt: null }],
    })
    erpApi.getErpPurchaseOrder.mockResolvedValue({
      number: 'PO-1', sourceId: 'source-order', supplierCode: 'SUP-1', supplierName: '供应商一',
      warehouseCode: 'WH-1', warehouseName: '一号仓', sourceStatus: 'finished', sourceStatusName: '已完成',
      paymentStatus: 'paided', paymentStatusName: '已付款',
      staffName: '经办人', totalAmount: 10, paidAmount: 10, goodsCount: 1, deliveryAt: null,
      sourceCreatedAt: null, sourceUpdatedAt: null, downloaded: true, remark: null,
      internalCommunication: null, sourceFields: { RawField: 'must-not-be-rendered' }, lines: [line],
    })
    erpApi.getErpPurchaseReturns.mockResolvedValue({
      total: 1, begin: 0, step: 20,
      items: [{ id: 'return-1', purchaseReturnNo: 'PR-1', sourceId: 'source-return', supplierName: '供应商一',
        warehouseName: '一号仓', staffName: '经办人', sourceStatusName: '已完成', returnAmount: 10,
        discountAmount: 0, lineCount: 1, sendAt: null, syncedAt: null }],
    })
    erpApi.getErpPurchaseReturn.mockResolvedValue({
      number: 'PR-1', sourceId: 'source-return', supplierCode: 'SUP-1', supplierName: '供应商一',
      warehouseCode: 'WH-1', warehouseName: '一号仓', sourceStatusName: '已完成', staffName: '经办人',
      contactName: '联系人', contactPhone: '13800000000', returnAmount: 10, discountAmount: 0,
      detailCount: 1, sourceCreatedAt: null, sendAt: null, sourceDevice: null, downloaded: true,
      contactAddress: null, cityNames: [], reason: null, remark: null, internalCommunication: null,
      sourceFields: { RawField: 'must-not-be-rendered' }, lines: [line],
    })
  })

  it.each([
    ['supply.erp.procurement.orders', '采购订单', '采购明细'],
    ['supply.erp.procurement.returns', '采购退货', '退货明细'],
    ['supply.erp.procurement.receipts', '到货与入库', '入库明细'],
    ['supply.erp.inventory.inbound', '入库单', '入库明细'],
  ])('%s 详情只展示业务字段，不展示订货宝原始单据字段', async (routeKey, title, detailTitle) => {
    routeMeta.routeKey = routeKey
    const wrapper = mountPage()
    await flushPromises()

    const state = wrapper.vm as unknown as {
      data: { items: unknown[] }
      openDetail: (row: unknown) => Promise<void>
    }
    await state.openDetail(state.data.items[0])
    await flushPromises()

    expect(wrapper.text()).toContain(title)
    expect(wrapper.text()).toContain(detailTitle)
    expect(wrapper.text()).not.toContain('订货宝原始单据字段')
    expect(wrapper.text()).not.toContain('must-not-be-rendered')
    expect(wrapper.findAll('pre')).toHaveLength(0)
  })

  it('库存按库存状态查询，采购详情明确展示整单付款状态', async () => {
    routeMeta.routeKey = 'supply.erp.inventory.inventory'
    erpApi.getErpInventoryBalances.mockResolvedValue({ total: 0, begin: 0, step: 20, items: [] })
    erpApi.getErpWarehouses.mockResolvedValue({ total: 0, begin: 0, step: 1000, items: [] })
    const wrapper = mountPage()
    await flushPromises()

    const state = wrapper.vm as unknown as {
      filters: { status: string }
      queryData: () => Promise<void>
    }
    state.filters.status = 'AVAILABLE'
    erpApi.getErpInventoryBalances.mockClear()
    await state.queryData()

    expect(erpApi.getErpInventoryBalances).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'AVAILABLE' }),
    )

    routeMeta.routeKey = 'supply.erp.procurement.orders'
    const orderWrapper = mountPage()
    await flushPromises()
    const orderState = orderWrapper.vm as unknown as {
      data: { items: unknown[] }
      businessTimeLabel: string
      openDetail: (row: unknown) => Promise<void>
    }
    expect(orderState.businessTimeLabel).toBe('采购日期')
    await orderState.openDetail(orderState.data.items[0])
    await flushPromises()
    expect(orderWrapper.text()).toContain('单据状态：已完成')
    expect(orderWrapper.text()).toContain('付款状态：已付款')
  })
})
