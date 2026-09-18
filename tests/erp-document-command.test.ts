import { defineComponent } from 'vue'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ErpDocumentManagementView from '@/views/supply-chain/erp/ErpDocumentManagementView.vue'

const mocks = vi.hoisted(() => ({
  routeKey: 'supply.procurement.orders',
  createProcurementOrder: vi.fn(), createTransferOrder: vi.fn(),
  warning: vi.fn(), error: vi.fn(),
}))
vi.mock('@/composables/useSupplyPermissions', () => ({ useSupplyPermissions: () => ({ can: () => true }) }))
vi.mock('vue-router', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue-router')>(), useRoute: () => ({ meta: { routeKey: mocks.routeKey } }) }))
vi.mock('element-plus', () => ({ ElMessage: { success: vi.fn(), warning: mocks.warning, error: mocks.error }, ElMessageBox: { confirm: vi.fn() } }))
vi.mock('@/api/core/erp-documents', () => ({
  getProcurementOrders: vi.fn(async () => ({ total: 0, items: [] })),
  getTransferOrders: vi.fn(async () => ({ total: 0, items: [] })),
  createProcurementOrder: mocks.createProcurementOrder,
  createTransferOrder: mocks.createTransferOrder,
}))
vi.mock('@/api/core/erp-internal', () => ({
  getErpSupplierProfiles: vi.fn(async () => ({ items: [] })),
  getErpInventoryWarehouses: vi.fn(async () => ({ items: [] })),
}))
vi.mock('@/api/core/erp-product', () => ({
  getErpManagedProducts: vi.fn(async () => ({ items: [] })),
  getErpManagedProduct: vi.fn(async () => ({
    productName: '商品', unitCode: 'UNIT',
    variants: [{ id: 'variant-1', defaultFlag: true, unitCode: 'UNIT', purchasePrice: 12.34 }],
  })),
}))
vi.mock('@/utils/business-dictionary', () => ({
  loadBusinessDictionaries: vi.fn(async () => undefined),
  businessDictionaryOptions: () => [],
  businessDictionaryLabel: (_module: string, _code: string, value: string) => value,
}))

const Field = defineComponent({ props: ['label'], template: '<div :data-label="label"><slot /></div>' })
const Input = defineComponent({
  props: ['modelValue'], emits: ['update:modelValue', 'change'],
  template: `<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" @change="$emit('change')">`,
})
const NumberInput = defineComponent({
  props: ['modelValue'], emits: ['update:modelValue'],
  template: `<input type="number" :value="modelValue" @input="$emit('update:modelValue', Number($event.target.value))">`,
})
const Dialog = defineComponent({
  props: ['modelValue'], template: '<section v-if="modelValue" class="dialog"><slot /><slot name="footer" /></section>',
})
const Button = defineComponent({ template: '<button><slot /></button>' })

function renderEditor() {
  return shallowMount(ErpDocumentManagementView, {
    global: {
      renderStubDefaultSlot: true,
      directives: { loading: () => undefined },
      stubs: {
        ElFormItem: Field, ElInput: Input, ElSelect: Input, ElInputNumber: NumberInput, ElDialog: Dialog, ElButton: Button,
        ElTable: defineComponent({ template: '<div />' }),
        ElForm: true, ElOption: true, ElDatePicker: true, ElTag: true, ElEmpty: true, ElPagination: true,
        ElAlert: true, ElRow: true, ElCol: true, ElDescriptions: true, ElDescriptionsItem: true,
      },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.routeKey = 'supply.procurement.orders'
})

describe('ERP document command discrimination', () => {
  it.each([false, true])('采购保留价格、数量、供应商及submit=%s', async (submit) => {
    const wrapper = renderEditor()
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text().includes('新增'))!.trigger('click')
    await wrapper.get('.dialog [data-label="供应商"] input').setValue('supplier-1')
    await wrapper.get('.dialog [data-label="入库仓库"] input').setValue('warehouse-1')
    await wrapper.get('.dialog [data-label="商品1"] input').setValue('product-1')
    await flushPromises()
    await wrapper.get('.dialog [data-label="数量"] input').setValue('2.5')
    await wrapper.findAll('.dialog button').find((button) => button.text() === (submit ? '保存并提交' : '保存草稿'))!.trigger('click')
    await flushPromises()
    expect(mocks.createProcurementOrder).toHaveBeenCalledWith({
      submit, supplierId: 'supplier-1', targetWarehouseId: 'warehouse-1',
      expectedArrivalTime: null, remark: undefined, revision: null,
      lines: [{ productId: 'product-1', productVariantId: 'variant-1', quantity: 2.5, unitPrice: 12.34 }],
    })
    expect(mocks.createTransferOrder).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('调拨不传采购价格和供应商，仍阻止同仓调拨', async () => {
    mocks.routeKey = 'supply.inventory.transfers'
    const wrapper = renderEditor()
    await flushPromises()
    await wrapper.findAll('button').find((button) => button.text().includes('新增'))!.trigger('click')
    await wrapper.get('.dialog [data-label="来源仓库"] input').setValue('warehouse-1')
    await wrapper.get('.dialog [data-label="目标仓库"] input').setValue('warehouse-1')
    await wrapper.get('.dialog [data-label="商品1"] input').setValue('product-1')
    await flushPromises()
    const save = wrapper.findAll('.dialog button').find((button) => button.text() === '保存')!
    await save.trigger('click')
    expect(mocks.warning).toHaveBeenCalledWith('来源仓库和目标仓库不能相同')
    expect(mocks.createTransferOrder).not.toHaveBeenCalled()
    await wrapper.get('.dialog [data-label="目标仓库"] input').setValue('warehouse-2')
    await save.trigger('click')
    await flushPromises()
    const command = mocks.createTransferOrder.mock.calls[0]?.[0]
    expect(command).toEqual({
      sourceWarehouseId: 'warehouse-1', targetWarehouseId: 'warehouse-2', remark: undefined, revision: null,
      lines: [{ productId: 'product-1', productVariantId: 'variant-1', quantity: 1, unitPrice: undefined }],
    })
    expect(JSON.stringify(command)).not.toMatch(/unitPrice|supplierId|submit/)
    expect(mocks.createProcurementOrder).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
