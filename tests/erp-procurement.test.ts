import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProcurementView from '@/views/supply-chain/erp/ErpProcurementManagementView.vue'
import ProductPicker from '@/components/erp/ErpProcurementProductPicker.vue'
import ProcurementDetail from '@/components/erp/ErpProcurementDetail.vue'
import ProcurementEditor from '@/components/erp/ErpProcurementEditor.vue'
import { appendProcurementProducts, roundProcurementInput } from '@/utils/procurement'
import type { ProcurementOrderSummary, ProcurementProduct } from '@/api/core/erp-documents'
const api = vi.hoisted(() => ({
  orders: vi.fn(),
  products: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  upload: vi.fn(),
  contractUrl: vi.fn(),
}))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
}))
vi.mock('@/api/core/erp-documents', () => ({
  getProcurementOrders: api.orders,
  getProcurementProducts: api.products,
  createProcurementOrder: api.create,
  getProcurementOrder: api.get,
  confirmProcurementOrder: vi.fn(),
  deleteProcurementOrder: vi.fn(),
  updateProcurementOrder: vi.fn(),
  uploadProcurementContract: api.upload,
  getProcurementContractUrl: api.contractUrl,
}))
vi.mock('@/api/core/erp-internal', () => ({
  getErpSupplierProfiles: async () => ({
    items: [{ id: '1', supplierCode: 'SUP-1', supplierName: '供应商' }],
  }),
  getErpInventoryWarehouses: async () => ({
    items: [
      {
        id: '2',
        warehouseCode: 'WH-1',
        warehouseName: '仓库',
        contactName: '张三',
        contactPhone: '13800000000',
        address: '收货地址',
      },
    ],
  }),
}))
vi.mock('@/utils/business-dictionary', () => ({
  loadBusinessDictionaries: async () => {},
  businessDictionaryLabel: (_m: string, _d: string, v: string) => v,
}))
const product = (code: string): ProcurementProduct => ({
  productCode: 'P1',
  variantCode: code,
  productName: '商品',
  specification: '500ml',
  defaultUnitCode: 'BOTTLE',
  baseUnitCode: 'BOTTLE',
  middleUnitCode: null,
  baseToMiddleRate: null,
  bigUnitCode: 'BOX',
  baseToBigRate: 24,
  purchasePrice: 2,
})
const row = (id: string, confirmed: boolean): ProcurementOrderSummary => ({
  id,
  procurementNo: `PO-${id}`,
  sourceSystemCode: null,
  sourceDocumentNo: null,
  supplierId: '1',
  supplierCode: 'SUP-1',
  supplierName: '供应商',
  targetWarehouseId: '2',
  targetWarehouseName: '仓库',
  statusCode: confirmed ? 'SUBMITTED' : 'DRAFT',
  confirmationStatusCode: confirmed ? 'CONFIRMED' : 'UNCONFIRMED',
  expectedArrivalTime: null,
  totalQuantity: 0,
  totalAmount: 10,
  lineCount: 1,
  revision: 1,
  updatedTime: '2026-11-02T02:00:00Z',
})
beforeEach(() => {
  vi.clearAllMocks()
  api.orders.mockResolvedValue({ total: 2, items: [row('1', false), row('2', true)] })
  api.products.mockImplementation(({ begin }: { begin: number }) =>
    Promise.resolve({ total: 40, items: [product(begin === 0 ? 'SKU1' : 'SKU2')] }),
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
})
const global = {
  plugins: [ElementPlus],
  stubs: { DhbPageSyncButton: true },
}

describe('采购订单列表', () => {
  it('订货宝原单号独立展示与筛选，不与本系统采购单号混用', async () => {
    api.orders.mockResolvedValue({
      total: 1,
      items: [
        { ...row('1', true), sourceSystemCode: 'DINGHUOBAO', sourceDocumentNo: 'JH.20260901.0000' },
      ],
    })
    const wrapper = mount(ProcurementView, {
      global: { ...global, stubs: { ...global.stubs, ErpProcurementEditor: true } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('订货宝单号')
    expect(wrapper.text()).toContain('JH.20260901.0000')
    await wrapper.get('input[placeholder="输入订货宝原单号"]').setValue('JH.20260901.0000')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.orders).toHaveBeenLastCalledWith(
      expect.objectContaining({ sourceDocumentNo: 'JH.20260901.0000', procurementNo: undefined }),
    )
    wrapper.unmount()
  })
  it('合计使用服务器筛选全集的结果，不从本页明细推算，也不把缺失合计显示为0', async () => {
    api.orders.mockResolvedValue({
      total: 38,
      items: [row('1', false)],
      totals: { quantityByUnit: { BOX: 500, BOTTLE: 200 }, purchaseAmount: 12345.67 },
    })
    const wrapper = mount(ProcurementView, {
      global: { ...global, stubs: { ...global.stubs, ErpProcurementEditor: true } },
    })
    await flushPromises()
    const summary = wrapper.get('.purchase-totals')
    expect(summary.text()).toContain('采购数量合计')
    expect(summary.text()).toContain('采购金额合计（元）')
    expect(summary.get('.totals-quantities b').text()).toBe('700')
    expect(summary.text()).toContain('12,345.67')
    api.orders.mockResolvedValue({ total: 0, items: [] })
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(summary.text()).not.toContain('12,345.67')
    expect(summary.text()).toContain('—')
    wrapper.unmount()
  })
  it('采购数量显示各行数量相加的总数，不展示单位，创建人显示姓名', async () => {
    api.orders.mockResolvedValue({
      total: 1,
      items: [
        {
          ...row('1', false),
          lineCount: 2,
          totalQuantity: 0,
          quantityByUnit: { BOX: 2, BOTTLE: 10 },
          createdBy: '张三',
        },
      ],
    })
    const wrapper = mount(ProcurementView, {
      global: { ...global, stubs: { ...global.stubs, ErpProcurementEditor: true } },
    })
    await flushPromises()
    const cells = wrapper
      .findAll('tr.el-table__row')[0]!
      .findAll('td')
      .map((t) => t.text())
    const quantityColumn = wrapper.findAll('th').findIndex((h) => h.text() === '采购数量')
    expect(cells[quantityColumn]).toBe('12')
    expect(cells).toContain('待确认')
    expect(cells).toContain('张三')
    wrapper.unmount()
  })
  it('去掉标题和流程卡片，已确认单只有查看；筛选按编码与采购日期发送并可重置', async () => {
    const wrapper = mount(ProcurementView, {
      global: { ...global, stubs: { ...global.stubs, ErpProcurementEditor: true } },
    })
    await flushPromises()
    expect(wrapper.find('.page-heading').exists()).toBe(false)
    expect(wrapper.find('.workflow-strip').exists()).toBe(false)
    const headings = wrapper.findAll('th').map((t) => t.text())
    expect(headings).toContain('采购单号')
    expect(headings).toContain('采购日期')
    expect(headings).toContain('预计到货时间')
    expect(headings).toContain('采购数量')
    expect(headings).toContain('采购金额（元）')
    expect(headings).toContain('单据状态')
    expect(headings).toContain('创建人')
    expect(headings).not.toContain('确认状态')
    expect(headings).toContain('收货仓库')
    expect(headings).not.toContain('收货信息')
    expect(headings).not.toContain('入库进度')
    expect(wrapper.find('.cell-secondary').exists()).toBe(false)
    const tableRows = wrapper.findAll('tr.el-table__row')
    expect(tableRows).toHaveLength(2)
    expect(tableRows[0]!.text()).toContain('编辑')
    expect(tableRows[0]!.text()).toContain('删除')
    expect(tableRows[0]!.text()).toContain('确认')
    const buttons = tableRows[1]!.findAll('button').map((b) => b.text())
    expect(buttons.filter((text) => ['查看', '编辑', '确认', '删除'].includes(text))).toEqual([
      '查看',
    ])
    const selects = wrapper.findAllComponents({ name: 'ElSelect' })
    selects[0]!.vm.$emit('update:modelValue', 'SUP-1')
    selects[1]!.vm.$emit('update:modelValue', 'UNCONFIRMED')
    wrapper
      .findComponent({ name: 'ElDatePicker' })
      .vm.$emit('update:modelValue', ['2026-11-01', '2026-11-02'])
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.orders).toHaveBeenLastCalledWith(
      expect.objectContaining({
        supplierCode: 'SUP-1',
        confirmationStatusCode: 'UNCONFIRMED',
        purchaseDateFrom: '2026-11-01',
        purchaseDateTo: '2026-11-02',
        begin: 0,
      }),
    )
    await wrapper
      .findAll('button')
      .find((b) => b.text() === '重置')!
      .trigger('click')
    await flushPromises()
    expect(api.orders).toHaveBeenLastCalledWith(
      expect.objectContaining({
        supplierCode: undefined,
        confirmationStatusCode: undefined,
        purchaseDateFrom: undefined,
        begin: 0,
      }),
    )
    wrapper.unmount()
  })
})
describe('采购详情', () => {
  it('附件签名地址获取后展示原生安全链接，避免异步新窗口留下空白页', async () => {
    api.get.mockResolvedValue({ ...row('1', false), lines: [], contractFileKey: 'saved.pdf' })
    api.contractUrl.mockResolvedValue('https://example.com/procurement.pdf')
    const wrapper = mount(ProcurementDetail, { props: { modelValue: false, orderId: '1' }, global })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    expect(api.contractUrl).toHaveBeenCalledWith('1')
    const link = wrapper.findAll('a').find((a) => a.text() === '查看合同附件')!
    expect(link.attributes('href')).toBe('https://example.com/procurement.pdf')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
    wrapper.unmount()
  })
  it('独立只读展示采购、收货、合同和费用，不复用禁用编辑表单', async () => {
    api.get.mockResolvedValue({
      ...row('1', true),
      purchaseDate: '2026-11-02',
      receiverName: '收货人',
      receiverPhone: '027-12345678',
      receivingAddress: '详细收货地址',
      freightAmount: 18,
      freightBearerCode: 'BUYER',
      lines: [
        {
          id: 'l1',
          productName: '商品',
          variantCode: 'SKU1',
          unitCode: 'BOTTLE',
          quantity: 3,
          unitPrice: 2,
          lineAmount: 6,
        },
      ],
      remark: '按约送货',
      createdTime: '2026-11-02T00:00:00Z',
    })
    const wrapper = mount(ProcurementDetail, { props: { modelValue: false, orderId: '1' }, global })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    expect(wrapper.text()).toContain('详细收货地址')
    expect(wrapper.text()).toContain('合同与费用')
    expect(wrapper.text()).toContain('已确认')
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('保存')
    wrapper.unmount()
  })
})
describe('采购商品选择', () => {
  it('数量与采购价按两位小数四舍五入，空值及零价保持原有含义', () => {
    expect(roundProcurementInput(1.005)).toBe(1.01)
    expect(roundProcurementInput(10.075)).toBe(10.08)
    expect(roundProcurementInput(5.9)).toBe(5.9)
    expect(roundProcurementInput(0)).toBe(0)
    expect(roundProcurementInput(undefined)).toBeUndefined()
    const products = appendProcurementProducts([], [{ ...product('SKU1'), purchasePrice: 2.675 }])
    expect(products[0]!.unitPrice).toBe(2.68)
    expect(products[0]!.quantity).toBeUndefined()
  })
  it('商品名称、商品编码与SKU编码独立传参，查询和重置保留已选商品', async () => {
    const wrapper = mount(ProductPicker, {
      props: { modelValue: false, excludedCodes: [] },
      global,
    })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    const table = wrapper.findComponent({ name: 'ElTable' })
    table.vm.$emit('select', [product('SKU1')], product('SKU1'))
    const inputs = wrapper.findAllComponents({ name: 'ElInput' })
    inputs[0]!.vm.$emit('update:modelValue', '商品')
    inputs[1]!.vm.$emit('update:modelValue', 'P1')
    inputs[2]!.vm.$emit('update:modelValue', 'SKU1')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.products).toHaveBeenLastCalledWith({
      begin: 0,
      step: 20,
      productName: '商品',
      productCode: 'P1',
      variantCode: 'SKU1',
    })
    await wrapper
      .findAll('button')
      .find((b) => b.text() === '重置')!
      .trigger('click')
    await flushPromises()
    expect(api.products).toHaveBeenLastCalledWith({
      begin: 0,
      step: 20,
      productName: undefined,
      productCode: undefined,
      variantCode: undefined,
    })
    expect(wrapper.text()).toContain('已选 1 个商品')
    wrapper.unmount()
  })

  it('跨页保留选择，确认追加时不覆盖已填写数量、单价', async () => {
    const wrapper = mount(ProductPicker, {
      props: { modelValue: false, excludedCodes: ['EXISTING'] },
      global,
    })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    const table = wrapper.findComponent({ name: 'ElTable' })
    table.vm.$emit('select', [product('SKU1')], product('SKU1'))
    await flushPromises()
    const pagination = wrapper.findComponent({ name: 'ElPagination' })
    pagination.vm.$emit('update:current-page', 2)
    pagination.vm.$emit('current-change', 2)
    await flushPromises()
    table.vm.$emit('select', [product('SKU2')], product('SKU2'))
    await flushPromises()
    const dialog = wrapper.findComponent({ name: 'ElDialog' })
    const add = dialog.findAll('button').find((b) => b.text().includes('添加已选商品'))!
    await add.trigger('click')
    const selected = wrapper.emitted('selected')![0]![0] as ProcurementProduct[]
    expect(selected.map((p) => p.variantCode)).toEqual(['SKU1', 'SKU2'])
    const prior = appendProcurementProducts([], [product('SKU1')])
    prior[0]!.quantity = 10
    prior[0]!.unitPrice = 0
    const merged = appendProcurementProducts(prior, selected)
    expect(merged).toHaveLength(2)
    expect(merged[0]!.quantity).toBe(10)
    expect(merged[0]!.unitPrice).toBe(0)
    expect(merged[1]!.quantity).toBeUndefined()
    wrapper.unmount()
  })
  it('新增页收货信息带入，空数量不保存，手填数量和零价按编码保存', async () => {
    const wrapper = mount(ProcurementEditor, {
      props: { modelValue: false },
      global: { ...global, stubs: { ...global.stubs, ErpProcurementProductPicker: true } },
    })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    expect(wrapper.text()).not.toContain('保存后自动生成')
    expect(wrapper.findAll('button').some((b) => b.text() === '新增')).toBe(false)
    expect(wrapper.findComponent({ name: 'ErpSupplierProfileEditor' }).exists()).toBe(false)
    const selects = wrapper.findAllComponents({ name: 'ElSelect' })
    selects[0]!.vm.$emit('update:modelValue', 'SUP-1')
    selects[1]!.vm.$emit('update:modelValue', 'WH-1')
    selects[1]!.vm.$emit('change', 'WH-1')
    wrapper
      .findComponent({ name: 'ErpProcurementProductPicker' })
      .vm.$emit('selected', [product('SKU1')])
    await flushPromises()
    const save = wrapper.findAll('button').find((b) => b.text() === '保存')!
    await save.trigger('click')
    await flushPromises()
    expect(api.create).not.toHaveBeenCalled()
    const numbers = wrapper.findAllComponents({ name: 'ElInputNumber' })
    expect(numbers[0]!.props('precision')).toBe(2)
    expect(numbers[1]!.props('precision')).toBe(2)
    numbers[0]!.vm.$emit('update:modelValue', 3)
    numbers[1]!.vm.$emit('update:modelValue', 0)
    await flushPromises()
    await save.trigger('click')
    await flushPromises()
    expect(api.create).not.toHaveBeenCalled()
    numbers[2]!.vm.$emit('update:modelValue', 0)
    await flushPromises()
    await save.trigger('click')
    await flushPromises()
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierCode: 'SUP-1',
        targetWarehouseCode: 'WH-1',
        receiverName: '张三',
        receiverPhone: '13800000000',
        receivingAddress: '收货地址',
        freightAmount: 0,
        freightBearerCode: 'BUYER',
        lines: [
          expect.objectContaining({
            productCode: 'P1',
            variantCode: 'SKU1',
            unitCode: 'BOTTLE',
            quantity: 3,
            unitPrice: 0,
          }),
        ],
      }),
    )
    const command = api.create.mock.calls[0]![0]
    expect(command.supplierId).toBeUndefined()
    expect(command.lines[0].productId).toBeUndefined()
    expect(wrapper.emitted('saved')).toHaveLength(1)
    wrapper.unmount()
  })
  it('编辑资料加载完成后，数量与单价可直接录入且不残留禁用状态', async () => {
    let resolveCatalog!: (value: { items: ProcurementProduct[]; total: number }) => void
    api.products.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCatalog = resolve
        }),
    )
    api.get.mockResolvedValue({
      ...row('1', false),
      targetWarehouseCode: 'WH-1',
      purchaseDate: '2026-11-02',
      lines: [{ ...product('SKU1'), unitCode: 'BOTTLE', quantity: 10, unitPrice: 24 }],
    })
    const wrapper = mount(ProcurementEditor, {
      props: { modelValue: false, orderId: '1' },
      global: { ...global, stubs: { ...global.stubs, ErpProcurementProductPicker: true } },
    })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    resolveCatalog({ items: [product('SKU1')], total: 1 })
    await flushPromises()
    const numbers = wrapper.findAllComponents({ name: 'ElInputNumber' })
    const quantity = numbers[0]!.get('input')
    const price = numbers[1]!.get('input')
    expect(quantity.attributes('aria-disabled')).toBe('false')
    expect(price.attributes('aria-disabled')).toBe('false')
    await quantity.setValue('12')
    await quantity.trigger('change')
    await price.setValue('26')
    await price.trigger('change')
    await flushPromises()
    expect(numbers[0]!.props('modelValue')).toBe(12)
    expect(numbers[1]!.props('modelValue')).toBe(26)
    expect(wrapper.text()).toContain('312.00')
    wrapper.unmount()
  })
  it('新增页面展示上传入口，上传中不可保存，成功后可移除并重新上传', async () => {
    let completeUpload!: (key: string) => void
    api.upload.mockImplementation(
      () =>
        new Promise((resolve) => {
          completeUpload = resolve
        }),
    )
    const wrapper = mount(ProcurementEditor, { props: { modelValue: false }, global })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    expect(wrapper.findAll('button').some((b) => b.text() === '上传附件')).toBe(true)
    const file = new File(['%PDF-1.7\n'], '采购说明.pdf', { type: 'application/pdf' })
    const input = wrapper.get('input[type="file"]')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
    await input.trigger('change')
    await flushPromises()
    expect(api.upload).toHaveBeenCalledWith(file, undefined)
    const save = wrapper.findAll('button').find((b) => b.text() === '保存')!
    expect(save.attributes('disabled')).toBeDefined()
    completeUpload('procurement/contracts/new.pdf')
    await flushPromises()
    expect(wrapper.text()).toContain('采购说明.pdf')
    expect(wrapper.findAll('button').some((b) => b.text() === '更换附件')).toBe(true)
    const remove = wrapper.findAll('button').find((b) => b.text() === '移除')!
    await remove.trigger('click')
    expect(wrapper.text()).not.toContain('采购说明.pdf')
    expect(wrapper.findAll('button').some((b) => b.text() === '上传附件')).toBe(true)
    wrapper.unmount()
  })
})
