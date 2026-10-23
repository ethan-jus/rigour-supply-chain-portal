import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import ElementPlus from 'element-plus'
import Parties from '@/views/supply-chain/cost/CostLogisticsParties.vue'
import EntryMode from '@/views/supply-chain/cost/CostEntryMode.vue'
import ReferenceSelect from '@/views/supply-chain/cost/CostReferenceSelect.vue'
import type { CostCommand } from '@/api/core/cost'

const wrappers: VueWrapper[] = []
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()))
function render(legCode = 'PURCHASE') {
  const logistics = reactive<NonNullable<CostCommand['logistics']>>({
    legCode,
    entryMode: 'NONE',
    sourceIds: [],
    voucherIds: [],
    carrierName: '',
    trackingNo: '',
    transportMethodCode: '',
    payerCode: 'COMPANY',
    senderName: '',
    receiverName: '',
    supplierId: null,
    customerId: null,
    sourceWarehouseId: null,
    targetWarehouseId: null,
  })
  const warehouses = vi.fn().mockResolvedValue([
    {
      id: 'CENTER',
      name: '中心仓甲',
      label: '中心仓甲',
      warehouseTypeCode: 'CENTER',
      regionCode: 'C2',
    },
    {
      id: 'CITY',
      name: '城市仓甲',
      label: '城市仓甲',
      warehouseTypeCode: 'CITY',
      regionCode: 'C1',
    },
    {
      id: 'OTHER_CITY',
      name: '其他城市仓',
      label: '其他城市仓',
      warehouseTypeCode: 'CITY',
      regionCode: 'C2',
    },
    { id: 'UNKNOWN', name: '待核对仓', label: '待核对仓', regionCode: 'C1' },
  ])
  const wrapper = mount(Parties, {
    props: {
      modelValue: logistics,
      cityCode: 'C1',
      suppliers: vi.fn().mockResolvedValue([{ id: 'S1', name: '供应商甲', label: '供应商甲' }]),
      customers: vi.fn().mockResolvedValue([]),
      warehouses,
    },
    global: { plugins: [ElementPlus] },
  })
  wrappers.push(wrapper)
  return { wrapper, logistics }
}
function field(wrapper: VueWrapper, label: string) {
  return wrapper
    .findAllComponents({ name: 'ElFormItem' })
    .find((item) => item.props('label') === label)!
}

describe('freight transport parties', () => {
  it('offers supplier and central warehouse selection, with each manual draft isolated from linked IDs', async () => {
    const { wrapper, logistics } = render()
    for (const [label, id, name, key, nameKey] of [
      ['供应商（厂家）', 'S1', '供应商甲', 'supplierId', 'senderName'],
      ['中心仓', 'CENTER', '中心仓甲', 'targetWarehouseId', 'receiverName'],
    ] as const) {
      const item = field(wrapper, label)
      const mode = item.getComponent(EntryMode)
      const select = item.getComponent(ReferenceSelect).getComponent({ name: 'ElSelect' })
      expect(mode.props('modelValue')).toBe('LINKED')
      select.vm.$emit('visible-change', true)
      await flushPromises()
      select.vm.$emit('update:modelValue', id)
      select.vm.$emit('change', id)
      await flushPromises()
      expect(logistics[key]).toBe(id)
      expect(logistics[nameKey]).toBe(name)
      mode.vm.$emit('update:modelValue', 'MANUAL')
      await flushPromises()
      expect(logistics[key]).toBeNull()
      await item
        .getComponent({ name: 'ElInput' })
        .get('input')
        .setValue('手填' + name)
      mode.vm.$emit('update:modelValue', 'LINKED')
      await flushPromises()
      expect(logistics[key]).toBe(id)
      expect(logistics[nameKey]).toBe(name)
      mode.vm.$emit('update:modelValue', 'MANUAL')
      await flushPromises()
      expect(logistics[key]).toBeNull()
      expect(logistics[nameKey]).toBe('手填' + name)
    }
  })

  it.each([
    ['PURCHASE', '中心仓', ['中心仓甲', '待核对仓']],
    ['TRANSFER', '中心仓', ['中心仓甲', '待核对仓']],
    ['TRANSFER', '城市仓', ['城市仓甲', '待核对仓']],
    ['DELIVERY', '城市仓', ['城市仓甲', '待核对仓']],
  ] as const)(
    'limits %s %s choices to the applicable role and city',
    async (leg, label, expected) => {
      const { wrapper } = render(leg)
      const select = field(wrapper, label).getComponent({ name: 'ElSelect' })
      select.vm.$emit('visible-change', true)
      await flushPromises()
      expect(
        select.findAllComponents({ name: 'ElOption' }).map((option) => option.props('label')),
      ).toEqual(expected)
    },
  )

  it('removes the warehouse name with its cleared selection and preserves a historical manual name on reopen', async () => {
    const { wrapper, logistics } = render()
    const selector = field(wrapper, '中心仓').getComponent(ReferenceSelect)
    selector.vm.$emit('update:modelValue', 'CENTER')
    selector.vm.$emit('change', { id: 'CENTER', name: '中心仓甲' })
    await flushPromises()
    selector.vm.$emit('update:modelValue', null)
    selector.vm.$emit('change', null)
    await flushPromises()
    expect(logistics).toMatchObject({ targetWarehouseId: null, receiverName: '' })
    await wrapper.setProps({
      modelValue: reactive({
        ...logistics,
        supplierId: null,
        senderName: '历史供应商',
        receiverName: '外部中心仓',
      }),
    })
    expect(field(wrapper, '供应商（厂家）').getComponent(EntryMode).props('modelValue')).toBe(
      'MANUAL',
    )
    expect(field(wrapper, '中心仓').getComponent(EntryMode).props('modelValue')).toBe('MANUAL')
    expect(
      field(wrapper, '中心仓').getComponent({ name: 'ElInput' }).get('input').element.value,
    ).toBe('外部中心仓')
  })
})
