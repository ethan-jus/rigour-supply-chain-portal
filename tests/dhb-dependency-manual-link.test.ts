import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ElementPlus from 'element-plus'
import Manual from '@/components/supply/DhbDependencyManualLink.vue'
import type { DhbSyncOpenIssueItem } from '@/api/core/dhb-orchestration'
const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  customers: vi.fn(),
  products: vi.fn(),
  orders: vi.fn(),
  warehouses: vi.fn(),
  push: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('@/api/core/dhb-orchestration', () => ({ linkDhbDependency: mocks.save }))
vi.mock('@/api/core/crm', () => ({ getInternalCrmCustomers: mocks.customers }))
vi.mock('@/api/core/erp-product', () => ({ getErpManagedProducts: mocks.products }))
vi.mock('@/api/core/order-sales', () => ({ getSalesOrders: mocks.orders }))
vi.mock('@/api/core/erp-internal', () => ({ getErpInventoryWarehouses: mocks.warehouses }))
const issue = (more = {}) =>
  ({
    connectorId: 'c1',
    sourceObjectType: 'SALES_SHIPMENT',
    sourceId: 'FH001',
    requiredDataType: 'CUSTOMER',
    requiredSourceId: 'CUS1',
    relatedSalesOrderNo: 'DH001',
    ...more,
  }) as DhbSyncOpenIssueItem
const mountView = () => mount(Manual, { global: { plugins: [ElementPlus] } })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.customers.mockResolvedValue({
    items: [{ id: '3', customerCode: 'C001', customerName: '补录门店', statusCode: 'ACTIVE' }],
  })
  mocks.products.mockResolvedValue({
    items: [
      {
        id: '4',
        productCode: 'P001',
        productName: '面',
        variants: [{ id: '5', variantCode: 'SKU001' }],
      },
    ],
  })
  mocks.save.mockResolvedValue(undefined)
})
describe('人工补录资料后的显式关联', () => {
  it('展示原单和缺失资料编号，目标未选择不能保存，保存不另建运输', async () => {
    const w = mountView()
    await (w.vm as unknown as { open: (v: DhbSyncOpenIssueItem) => Promise<void> }).open(issue())
    await flushPromises()
    expect(w.text()).toContain('FH001')
    expect(w.text()).toContain('DH001')
    expect(w.text()).toContain('CUS1')
    const save = w.findAll('button').find((b) => b.text() === '保存资料关联')!
    expect(save.attributes('disabled')).toBeDefined()
    w.findComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', '3')
    await flushPromises()
    await save.trigger('click')
    await flushPromises()
    expect(mocks.save).toHaveBeenCalledWith({
      connectorId: 'c1',
      sourceObjectType: 'SALES_SHIPMENT',
      sourceId: 'FH001',
      requiredDataType: 'CUSTOMER',
      requiredSourceId: 'CUS1',
      targetId: '3',
    })
    expect(w.emitted('saved')).toHaveLength(1)
    w.unmount()
  })
  it('商品规格需要明确选择所属商品和规格，不自动采用第一个规格', async () => {
    const w = mountView()
    await (w.vm as unknown as { open: (v: DhbSyncOpenIssueItem) => Promise<void> }).open(
      issue({ requiredDataType: 'PRODUCT_SKU', requiredSourceId: 'PROD1::SKU1' }),
    )
    await flushPromises()
    const selectors = w.findAllComponents({ name: 'ElSelect' })
    selectors[0]!.vm.$emit('update:modelValue', '4')
    await flushPromises()
    const save = w.findAll('button').find((b) => b.text() === '保存资料关联')!
    expect(save.attributes('disabled')).toBeDefined()
    selectors[1]!.vm.$emit('update:modelValue', '5')
    await flushPromises()
    await save.trigger('click')
    await flushPromises()
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({ targetId: '5', productId: '4', requiredSourceId: 'PROD1::SKU1' }),
    )
    w.unmount()
  })
  it('补录入口进入对应客户档案，保存失败保留选择和来源信息', async () => {
    mocks.save.mockRejectedValue(new Error('资料无权访问'))
    const w = mountView()
    await (w.vm as unknown as { open: (v: DhbSyncOpenIssueItem) => Promise<void> }).open(issue())
    await flushPromises()
    await w
      .findAll('button')
      .find((b) => b.text() === '去客户档案页面补录')!
      .trigger('click')
    expect(mocks.push).toHaveBeenCalledWith({
      path: '/supply-chain/crm/customers/profiles',
      query: {},
    })
    w.findComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', '3')
    await flushPromises()
    await w
      .findAll('button')
      .find((b) => b.text() === '保存资料关联')!
      .trigger('click')
    await flushPromises()
    expect(w.text()).toContain('资料无权访问')
    expect(w.text()).toContain('CUS1')
    w.unmount()
  })
})
