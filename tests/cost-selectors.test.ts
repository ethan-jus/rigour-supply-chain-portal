import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import CitySelect from '@/views/supply-chain/cost/CostCitySelect.vue'
import DocumentSelect from '@/views/supply-chain/cost/CostDocumentSelect.vue'
import RentalFields from '@/views/supply-chain/cost/CostRentalFields.vue'
import { getCostCities, type CostSource } from '@/api/core/cost'
vi.mock('@/api/core/cost', () => ({ getCostCities: vi.fn() }))
const wrappers: VueWrapper[] = []
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
function source(id: string): CostSource {
  return {
    id,
    documentNo: '000' + id,
    sourceType: 'DELIVERY',
    cityCode: 'C1',
    warehouseId: '7',
    targetWarehouseId: null,
    senderCode: 'W7',
    senderName: '城市仓',
    receiverCode: id,
    receiverName: '客户' + id,
    statusCode: 'APPROVED',
    sourceSystem: 'SYSTEM',
  }
}
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount())
  vi.clearAllMocks()
  document.body.innerHTML = ''
})
describe('cost dropdown loading and selection', () => {
  it('shows city load failure with an existing selection and retries without losing input', async () => {
    vi.mocked(getCostCities)
      .mockRejectedValueOnce(new Error('城市服务不可用'))
      .mockResolvedValueOnce([{ code: 'C1', name: '武汉' }])
    const w = mount(CitySelect, {
      props: { modelValue: 'C1', snapshot: '武汉', action: 'order:logistics-cost:write' },
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(w)
    await flushPromises()
    expect(w.get('[role="alert"]').text()).toContain('城市服务不可用')
    expect(w.props('modelValue')).toBe('C1')
    await w.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(w.find('[role="alert"]').exists()).toBe(false)
    expect(w.emitted('loaded')?.at(-1)?.[0]).toEqual([{ code: 'C1', name: '武汉' }])
  })
  it('loads sources on first opening and uses emitted selection before parent model refresh', async () => {
    const loader = vi.fn().mockResolvedValue([source('1')])
    const w = mount(DocumentSelect, {
      props: { modelValue: [], sources: [], loader },
      global: { plugins: [ElementPlus], stubs: { ElDialog: true } },
    })
    wrappers.push(w)
    expect(loader).not.toHaveBeenCalled()
    const select = w.getComponent({ name: 'ElSelect' })
    select.vm.$emit('visible-change', true)
    await flushPromises()
    expect(loader).toHaveBeenCalledWith('', 0)
    select.vm.$emit('update:modelValue', ['1'])
    select.vm.$emit('change', ['1'])
    await flushPromises()
    expect(w.emitted('sources')?.at(-1)?.[0]).toEqual([source('1')])
    expect(w.emitted('change')).toHaveLength(1)
  })
  it('discards an old city response and preserves chosen records across source pages', async () => {
    const old = deferred<CostSource[]>()
    const page = Array.from({ length: 50 }, (_, i) => source(String(i + 1)))
    const loader = vi
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(page)
      .mockResolvedValueOnce([source('51')])
    const w = mount(DocumentSelect, {
      props: { modelValue: ['saved'], sources: [source('saved')], loader, resetKey: 'C1' },
      global: { plugins: [ElementPlus], stubs: { ElDialog: { template: '<div><slot/></div>' } } },
    })
    wrappers.push(w)
    w.getComponent({ name: 'ElSelect' }).vm.$emit('visible-change', true)
    await w.setProps({ resetKey: 'C2' })
    old.resolve([source('stale')])
    await flushPromises()
    expect(w.findAllComponents({ name: 'ElOption' }).map((o) => o.props('value'))).not.toContain(
      'stale',
    )
    await w
      .findAll('button')
      .find((b) => b.text() === '更多查询')!
      .trigger('click')
    await flushPromises()
    await w
      .findAll('button')
      .find((b) => b.text() === '下一页')!
      .trigger('click')
    await flushPromises()
    expect(loader).toHaveBeenLastCalledWith('', 50)
    expect(w.findAllComponents({ name: 'ElOption' }).map((o) => o.props('value'))).toEqual([
      'saved',
      '51',
    ])
  })
  it('office entry has no inventory selector and historical unknown type requires classification', () => {
    const w = mount(RentalFields, {
      props: {
        modelValue: {
          premisesType: 'OFFICE',
          premisesName: '办公室',
          area: 80,
          warehouseId: null,
          contractNo: '',
          leaseFrom: '',
          leaseTo: '',
          deposit: null,
        },
        office: true,
        warehouseSnapshot: '',
        warehouses: vi.fn(),
      },
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(w)
    expect(w.text()).toContain('办公室名称')
    expect(w.text()).not.toContain('关联仓库')
    const unknown = mount(RentalFields, {
      props: {
        modelValue: {
          premisesType: 'UNKNOWN',
          area: null,
          warehouseId: null,
          contractNo: '',
          leaseFrom: '',
          leaseTo: '',
          deposit: null,
        },
        office: false,
        warehouseSnapshot: '',
        warehouses: vi.fn(),
      },
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(unknown)
    expect(unknown.text()).toContain('历史场地类型')
    expect(unknown.props('modelValue').premisesType).toBe('UNKNOWN')
  })
})
