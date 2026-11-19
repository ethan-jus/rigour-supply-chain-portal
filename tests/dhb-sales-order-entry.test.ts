import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ElementPlus, { ElMessage } from 'element-plus'
import Entry from '@/components/supply/DhbSalesOrderEntry.vue'
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  orders: vi.fn(),
  totals: vi.fn(),
  allowed: true,
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => mocks.allowed }),
}))
vi.mock('@/api/core/order-sales', async (original) => ({
  ...(await original<typeof import('@/api/core/order-sales')>()),
  createSalesOrder: mocks.create,
  getSalesOrders: mocks.orders,
  getSalesOrderTotals: mocks.totals,
}))
vi.mock('@/api/core/crm', async (original) => ({
  ...(await original<typeof import('@/api/core/crm')>()),
  getAllCrmCustomerAreas: vi.fn().mockResolvedValue([]),
  getInternalCrmCustomers: vi
    .fn()
    .mockResolvedValue({
      items: [{ id: '3', customerCode: 'C3', customerName: '补录客户', statusCode: 'ACTIVE' }],
    }),
}))
vi.mock('@/api/core/hr', async (original) => ({
  ...(await original<typeof import('@/api/core/hr')>()),
  getHrEmployees: vi.fn().mockResolvedValue({ items: [] }),
}))
vi.mock('@/api/core/erp-product', async (original) => ({
  ...(await original<typeof import('@/api/core/erp-product')>()),
  getErpManagedProducts: vi.fn().mockResolvedValue({ items: [] }),
}))
vi.mock('@/utils/business-dictionary', () => ({
  businessDictionaryLabel: (_a: string, _b: string, v: string) => v,
  businessDictionaryOptions: () => [],
  loadBusinessDictionaries: vi.fn().mockResolvedValue(undefined),
}))
type State = {
  form: {
    customerId: string
    customerNameSnapshot: string
    orderDate: Date | null
    lines: Array<Record<string, unknown>>
  }
  selectCustomer: (id: string) => void
  saveOrder: () => Promise<void>
}
const setup = () =>
  mount(Entry, {
    props: { sourceOrderNo: 'DH-ORIGINAL' },
    global: { plugins: [ElementPlus], stubs: { teleport: true, ElSelect: {template: '<div><slot /></div>'}, ElOption: true, ElDatePicker: true } },
  })
function complete(w: ReturnType<typeof setup>) {
  const state = w.vm as unknown as State
  state.form.orderDate = new Date('2026-11-13T03:16:28Z')
  state.form.customerId = '3'
  state.selectCustomer('3')
  state.form.lines.push({
    localId: 'line-1',
    productId: '4',
    productVariantId: '5',
    productNameSnapshot: '原单商品',
    unitCode: 'CASE',
    quantity: 10,
    unitPrice: 96,
  })
  return state
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.allowed = true
  mocks.create.mockResolvedValue({
    id: '16',
    orderNo: 'XS16',
    customerNameSnapshot: '补录客户',
    orderStatusCode: 'SUBMITTED',
  })
})
describe('发货关联窗口复用销售单补录表单', () => {
  it('仅打开补录表单，不加载销售单列表或统计，不使用当前时间代填原单日期', async () => {
    const warning = vi.spyOn(ElMessage, 'warning')
    const w = setup()
    await flushPromises()
    expect(w.text()).toContain('补录销售订单')
    expect(w.text()).toContain('DH-ORIGINAL')
    expect(w.text()).not.toContain('保存草稿')
    expect((w.vm as unknown as State).form.orderDate).toBeNull()
    await (w.vm as unknown as State).saveOrder()
    expect(warning).toHaveBeenCalledWith('请选择原销售单的下单时间')
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.orders).not.toHaveBeenCalled()
    expect(mocks.totals).not.toHaveBeenCalled()
    warning.mockRestore()
    w.unmount()
  })
  it('复用必填校验、提交接口并回传实际新单，连续提交只创建一次', async () => {
    let done!: (v: unknown) => void
    mocks.create.mockImplementation(
      () =>
        new Promise((resolve) => {
          done = resolve
        }),
    )
    const w = setup()
    await flushPromises()
    const state = complete(w)
    const first = state.saveOrder()
    await flushPromises()
    await state.saveOrder()
    expect(mocks.create).toHaveBeenCalledTimes(1)
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: '3',
        orderDate: '2026-11-13T03:16:28.000Z',
        submit: true,
        lines: [
          expect.objectContaining({
            productId: '4',
            productVariantId: '5',
            quantity: 10,
            unitPrice: 96,
          }),
        ],
      }),
    )
    const created = {
      id: '16',
      orderNo: 'XS16',
      customerNameSnapshot: '补录客户',
      orderStatusCode: 'SUBMITTED',
    }
    done(created)
    await first
    await flushPromises()
    expect(w.emitted('created')).toEqual([[created]])
    expect(mocks.orders).not.toHaveBeenCalled()
    w.unmount()
  })
  it('失败后保留录入资料，可重新提交；没有新增提交权限时不打开表单', async () => {
    mocks.create.mockRejectedValueOnce(new Error('暂时不可用'))
    const w = setup()
    await flushPromises()
    const state = complete(w)
    await state.saveOrder()
    expect(state.form.customerId).toBe('3')
    expect(state.form.lines[0]!.quantity).toBe(10)
    await state.saveOrder()
    expect(w.emitted('created')).toHaveLength(1)
    w.unmount()
    mocks.allowed = false
    const noPermission = setup()
    await flushPromises()
    expect(noPermission.emitted('closed')).toHaveLength(1)
    expect(noPermission.findComponent({ name: 'ElDialog' }).props('modelValue')).toBe(false)
    noPermission.unmount()
  })
})
