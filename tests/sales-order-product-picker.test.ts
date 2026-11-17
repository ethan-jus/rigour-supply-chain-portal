import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Picker from '@/views/supply-chain/order/components/SalesOrderProductPicker.vue'
const api = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('@/api/core/erp-product', () => ({ getErpManagedProducts: api.list }))
vi.mock('@/utils/business-dictionary', () => ({
  businessDictionaryLabel: (_m: string, _c: string, v: string) => v,
}))
const product = (id: string, variants = ['v1', 'v2']) => ({
  id,
  productCode: `P-${id}`,
  productName: `商品${id}`,
  unitCode: 'CASE',
  variants: variants.map((v, index) => ({
    id: v,
    variantCode: `${id}-${v}`,
    specificationSnapshot: `规格${v}`,
    unitCode: 'CASE',
    salePrice: index ? null : 96,
  })),
})
const setup = (excludedKeys: string[] = []) =>
  mount(Picker, {
    props: { modelValue: true, excludedKeys },
    global: {
      plugins: [ElementPlus],
      stubs: {
        teleport: true,
        CompactPagination: { name: 'CompactPagination', template: '<div />' },
      },
    },
  })
beforeEach(() => {
  vi.clearAllMocks()
  api.list.mockResolvedValue({ total: 40, items: [product('p1')] })
})
describe('销售商品弹窗选择后带回订单', () => {
  it('按商品批量带规格，区分同商品的不同规格并阻止订单已有规格重复添加', async () => {
    const w = setup(['p1:v1'])
    await flushPromises()
    expect(api.list).toHaveBeenCalledWith(
      expect.objectContaining({
        withVariants: true,
        submitStatusCode: 'SUBMITTED',
        shelfStatusCode: 'ON_SHELF',
        begin: 0,
        step: 20,
      }),
    )
    const table = w.findComponent({ name: 'ElTable' })
    const rows = table.props('data')
    expect(rows).toHaveLength(2)
    table.vm.$emit('select-all', rows)
    await flushPromises()
    await w
      .findAll('button')
      .find((b) => b.text() === '添加已选商品（1）')!
      .trigger('click')
    expect(w.emitted('selected')![0]![0]).toEqual([
      expect.objectContaining({ key: 'p1:v2', salePrice: null }),
    ])
    w.unmount()
  })
  it('跨页保留选择，确认一次返回所有规格，取消不回写订单', async () => {
    const w = setup()
    await flushPromises()
    const table = w.findComponent({ name: 'ElTable' })
    const first = table.props('data')[0]
    table.vm.$emit('select', [first], first)
    api.list.mockResolvedValueOnce({ total: 40, items: [product('p2', ['v3'])] })
    w.findComponent({ name: 'CompactPagination' }).vm.$emit('update:currentPage', 2)
    w.findComponent({ name: 'CompactPagination' }).vm.$emit('current-change', 2)
    await flushPromises()
    const second = table.props('data')[0]
    table.vm.$emit('select', [second], second)
    await flushPromises()
    await w
      .findAll('button')
      .find((b) => b.text() === '添加已选商品（2）')!
      .trigger('click')
    expect((w.emitted('selected')![0]![0] as Array<{ key: string }>).map((r) => r.key)).toEqual([
      'p1:v1',
      'p2:v3',
    ])
    w.unmount()
    const cancelled = setup()
    await flushPromises()
    await cancelled
      .findAll('button')
      .find((b) => b.text() === '取消')!
      .trigger('click')
    expect(cancelled.emitted('selected')).toBeUndefined()
    cancelled.unmount()
  })
  it('查询失败可重试，关闭后旧响应不能带回数据', async () => {
    api.list.mockRejectedValueOnce(new Error('暂时不可用'))
    const w = setup()
    await flushPromises()
    expect(w.text()).toContain('暂时不可用')
    api.list.mockResolvedValueOnce({ total: 1, items: [product('p1')] })
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.findComponent({ name: 'ElTable' }).props('data')).toHaveLength(2)
    let finish!: (v: unknown) => void
    api.list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    await w.find('form').trigger('submit')
    await w.setProps({ modelValue: false })
    finish({ total: 1, items: [product('late')] })
    await flushPromises()
    expect(w.emitted('selected')).toBeUndefined()
    w.unmount()
  })
})
