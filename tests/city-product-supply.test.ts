import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { CityProductSupplyView } from '@/api/core/bi-city-product-report'
import { reportRow } from './fixtures/city-product-report'

const { supply, warehouses } = vi.hoisted(() => ({ supply: vi.fn(), warehouses: vi.fn() }))
vi.mock('@/api/core/bi-city-product-report', () => ({ getCityProductSupply: supply }))
vi.mock('@/api/core/erp-internal', () => ({ getErpInventoryWarehouses: warehouses }))
vi.mock('@/views/supply-chain/bi/components/EchartsChart.vue', () => ({
  default: { name: 'EchartsChart', props: ['option'], template: '<div />' },
}))
import CityProductSupplyInvestigation from '@/views/supply-chain/bi/components/CityProductSupplyInvestigation.vue'
const query = {
  from: '2026-08-01T00:00:00+08:00',
  to: '2026-09-12T23:59:59+08:00',
  regionCode: 'BJ',
  productId: '100',
  skuId: '1000',
}
const fresh = { status: 'FRESH' as const, lastSuccessAt: '2026-09-12T10:00:00Z' }
const snapshot = (): CityProductSupplyView => ({
  from: query.from,
  to: query.to,
  generatedAt: '2026-09-12T11:00:00Z',
  inventoryStatus: fresh,
  operationStatus: fresh,
  truncated: false,
  stocks: [
    {
      warehouseId: '9',
      warehouseName: '广州中心仓',
      warehouseRegionCode: 'GZ',
      productId: '100',
      productName: '商品甲',
      skuId: '1000',
      specification: '12桶/箱',
      unitCode: 'BUCKET',
      availableQuantity: '12',
      lockedQuantity: '0',
      inTransitQuantity: '5',
      syncedAt: fresh.lastSuccessAt,
    },
  ],
  operations: [
    {
      productId: '100',
      skuId: '1000',
      unitCode: 'BOX',
      month: '2026-08',
      procurementQuantity: '10',
      shippedQuantity: '2',
      syncedAt: fresh.lastSuccessAt,
    },
  ],
})
const stubs = {
  ElSelect: {
    name: 'ElSelect',
    props: ['modelValue', 'remoteMethod'],
    emits: ['update:modelValue', 'change'],
    template: '<div><slot /></div>',
  },
  ElOption: true,
  ElButton: {
    props: ['disabled', 'loading'],
    template: '<button :disabled="disabled"><slot /></button>',
  },
  ElAlert: { props: ['title'], template: '<p role="alert">{{ title }}</p>' },
  ElEmpty: { props: ['description'], template: '<p>{{ description }}</p>' },
  ElSkeleton: true,
  ElCollapse: { template: '<div><slot /></div>' },
  ElCollapseItem: { template: '<div><slot /></div>' },
  ElTable: { props: ['data'], template: '<div><slot /></div>' },
  ElTableColumn: true,
}
const wrappers: ReturnType<typeof mount>[] = []
function render() {
  const wrapper = mount(CityProductSupplyInvestigation, {
    props: { query, salesRows: [reportRow({ productId: '100', skuId: '1000', unitCode: 'BOX' })] },
    global: { stubs },
  })
  wrappers.push(wrapper)
  return wrapper
}
async function choose(wrapper: ReturnType<typeof mount>) {
  const select = wrapper
    .findAllComponents({ name: 'ElSelect' })
    .find((row) => row.attributes('aria-label') === '供货仓库')!
  select.vm.$emit('update:modelValue', '9')
  await nextTick()
  select.vm.$emit('change')
  await flushPromises()
}
beforeEach(() => {
  vi.clearAllMocks()
  warehouses.mockResolvedValue({
    items: [{ id: '9', warehouseName: '广州中心仓', regionCode: 'GZ' }],
    total: 1,
  })
  supply.mockResolvedValue(snapshot())
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})

describe('independent supply investigation', () => {
  it('retains server failure reasons and invalidates the parent export evidence', async () => {
    supply.mockRejectedValueOnce({ message: '当前账号没有采购库存查询权限' })
    const wrapper = render()
    await choose(wrapper)
    expect(wrapper.text()).toContain('当前账号没有采购库存查询权限')
    expect(wrapper.emitted('evidence-change')?.at(-1)?.[0]).toMatchObject({
      loading: false,
      snapshot: null,
      error: '当前账号没有采购库存查询权限',
      warehouseId: '9',
    })
  })
  it('rejects supply facts outside the selected SKU or warehouse', async () => {
    const result = snapshot()
    result.stocks[0].warehouseId = 'other'
    supply.mockResolvedValueOnce(result)
    const wrapper = render()
    await choose(wrapper)
    expect(wrapper.text()).toContain('范围外数据')
    expect(wrapper.findAllComponents({ name: 'EchartsChart' })).toHaveLength(0)
  })
  it('keeps warehouse search errors independent from successful supply query state', async () => {
    const wrapper = render()
    await flushPromises()
    warehouses.mockRejectedValueOnce({ message: '仓库目录暂不可用' })
    const field = wrapper
      .findAllComponents({ name: 'ElSelect' })
      .find((row) => row.attributes('aria-label') === '供货仓库')!
    await field.props('remoteMethod')('新仓')
    await flushPromises()
    expect(wrapper.text()).toContain('仓库目录暂不可用')
    await choose(wrapper)
    expect(wrapper.emitted('evidence-change')?.at(-1)?.[0]).toMatchObject({
      warehouseName: '广州中心仓',
      loading: false,
    })
    expect(wrapper.text()).toContain('仓库目录暂不可用')
  })
  it('never infers a warehouse from city and sends only explicit product/warehouse IDs', async () => {
    const wrapper = render()
    await flushPromises()
    expect(supply).not.toHaveBeenCalled()
    expect(warehouses.mock.lastCall?.[0]).not.toHaveProperty('regionCode')
    await choose(wrapper)
    expect(supply).toHaveBeenCalledWith({
      from: query.from,
      to: query.to,
      productId: '100',
      skuId: '1000',
      warehouseId: '9',
    })
    expect(wrapper.text()).toContain('原始单位不同')
    expect(wrapper.text()).toContain('全仓采购与发货')
  })
  it('keeps stale or failed inventory visibly distinct from zero and does not fabricate missing facts', async () => {
    supply.mockResolvedValue({
      ...snapshot(),
      stocks: [],
      operations: [],
      inventoryStatus: { status: 'STALE', lastSuccessAt: fresh.lastSuccessAt },
      operationStatus: { status: 'FAILED', lastSuccessAt: fresh.lastSuccessAt },
    })
    const wrapper = render()
    await choose(wrapper)
    expect(wrapper.text()).toContain('快照已过期')
    expect(wrapper.text()).toContain('同步失败')
    expect(wrapper.text()).toContain('不能视为零库存')
    expect(wrapper.findAllComponents({ name: 'EchartsChart' })).toHaveLength(0)
  })
  it('drops late supply responses after the product scope changes', async () => {
    let complete!: (value: CityProductSupplyView) => void
    supply.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    const wrapper = render()
    await choose(wrapper)
    await wrapper.setProps({ query: { ...query, productId: '200' } })
    await flushPromises()
    complete({ ...snapshot(), inventoryStatus: { status: 'FAILED', lastSuccessAt: null } })
    await flushPromises()
    expect(wrapper.text()).not.toContain('最近同步失败')
    expect(supply.mock.lastCall?.[0].productId).toBe('200')
  })
})
