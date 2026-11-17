import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ElementPlus, { ElCheckbox, ElDialog, ElSelect, ElOption } from 'element-plus'
import Picker from '@/views/supply-chain/cost/CostLedgerSourcePicker.vue'
const api = vi.hoisted(() => ({ sources: vi.fn() }))
vi.mock('@/api/core/cost-ledger', () => ({
  getLedgerSources: api.sources,
  getLedgerParties: vi.fn().mockResolvedValue([]),
}))
beforeEach(() => {
  vi.clearAllMocks()
  api.sources.mockImplementation(async (q: { orderTypeCode: string }) => [
    {
      id: 1,
      documentNo:
        q.orderTypeCode === 'SALES_ORDER'
          ? 'SO202611030001'
          : q.orderTypeCode === 'OTHER_OUT'
            ? 'OT202611030001'
            : 'TR202611030001',
      senderName: '武汉城市仓',
      receiverName: '星河门店',
      statusCode: 'CONFIRMED',
      documentDate: '2026-11-03',
    },
  ])
})
describe('物流关联单据选择', () => {
  it('单号与收货仓名称分别筛选，跨类型勾选后一次带回', async () => {
    const w = mount(Picker, {
      props: { modelValue: true, selectedKeys: [] },
      global: {
        plugins: [ElementPlus],
        stubs: {
          CostLedgerPartySelect: true,
          ElDialog: { template: '<div><slot/><slot name="footer"/></div>' },
        },
      },
    })
    // The dialog open event starts a new selection session.
    const dialog = w.findComponent(ElDialog)
    dialog.vm.$emit('open')
    await flushPromises()
    expect(w.findAllComponents(ElOption).map((o) => o.props('label'))).toEqual([
      '调拨单',
      '销售单',
      '其他订单',
    ])
    await w.get('input[aria-label="单据编号"]').setValue('TR20261103')
    await w.get('input[aria-label="客户或收货方"]').setValue('武汉仓')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.sources).toHaveBeenLastCalledWith(
      expect.objectContaining({
        documentNo: 'TR20261103',
        partyName: '武汉仓',
        orderTypeCode: 'TRANSFER_ORDER',
      }),
    )
    w.findAllComponents(ElCheckbox)
      .find((c) => c.attributes('aria-label') === '选择TR202611030001')!
      .vm.$emit('change', true)
    await w.vm.$nextTick()
    const select = w.findComponent(ElSelect)
    select.vm.$emit('update:modelValue', 'OTHER_OUT')
    select.vm.$emit('change', 'OTHER_OUT')
    await flushPromises()
    expect(api.sources).toHaveBeenLastCalledWith(
      expect.objectContaining({ orderTypeCode: 'OTHER_OUT' }),
    )
    w.findAllComponents(ElCheckbox)
      .find((c) => c.attributes('aria-label') === '选择OT202611030001')!
      .vm.$emit('change', true)
    await w.vm.$nextTick()
    select.vm.$emit('update:modelValue', 'SALES_ORDER')
    select.vm.$emit('change', 'SALES_ORDER')
    await flushPromises()
    w.findAllComponents(ElCheckbox)
      .find((c) => c.attributes('aria-label') === '选择SO202611030001')!
      .vm.$emit('change', true)
    await w.vm.$nextTick()
    await w
      .findAll('button')
      .find((b) => b.text().startsWith('确定带回'))!
      .trigger('click')
    expect(w.emitted('selected')?.[0]?.[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ documentNo: 'TR202611030001', orderTypeCode: 'TRANSFER_ORDER' }),
        expect.objectContaining({ documentNo: 'SO202611030001', orderTypeCode: 'SALES_ORDER' }),
        expect.objectContaining({ documentNo: 'OT202611030001', orderTypeCode: 'OTHER_OUT' }),
      ]),
    )
    expect(w.emitted('selected')?.[0]?.[0]).toHaveLength(3)
    w.unmount()
  })
})

describe('销售配送单据选择与校验', () => {
  it('不常驻展示内部检查列，全选和手动勾选仍不能带回资料无效的单据', async () => {
    api.sources.mockResolvedValue([
      { id: 1, documentNo: 'SO_VALID', statusCode: 'CONFIRMED' },
      {
        id: 2,
        documentNo: 'SO_PENDING',
        statusCode: 'CONFIRMED',
        referenceIssue: '销售订单归属城市未配置',
      },
    ])
    const w = mount(Picker, {
      props: { modelValue: true, selectedKeys: [], orderTypeCode: 'SALES_ORDER' },
      global: {
        plugins: [ElementPlus],
        stubs: {
          CostLedgerPartySelect: true,
          ElDialog: { template: '<div><slot/><slot name="footer"/></div>' },
        },
      },
    })
    w.findComponent(ElDialog).vm.$emit('open')
    await flushPromises()
    const pending = w
      .findAllComponents(ElCheckbox)
      .find((c) => c.attributes('aria-label') === '选择SO_PENDING')!
    expect(pending.props('disabled')).toBe(true)
    expect(pending.attributes('title')).toBe('销售订单归属城市未配置')
    expect(w.text()).not.toContain('来源状态')
    expect(w.text()).not.toContain('关联检查')
    expect(w.text()).not.toContain('选择后补充发货仓库')
    pending.vm.$emit('change', true)
    w.findAllComponents(ElCheckbox)
      .find((c) => c.attributes('aria-label') === '勾选本页单据')!
      .vm.$emit('change', true)
    await w.vm.$nextTick()
    await w
      .findAll('button')
      .find((b) => b.text().startsWith('确定带回'))!
      .trigger('click')
    expect(w.emitted('selected')?.[0]?.[0]).toEqual([
      expect.objectContaining({ documentNo: 'SO_VALID' }),
    ])
    w.unmount()
  })

  it('默认只读取销售单，类型不可更改且推荐不会自动勾选', async () => {
    const w = mount(Picker, {
      props: {
        modelValue: true,
        selectedKeys: [],
        orderTypeCode: 'SALES_ORDER',
        suggestedDate: '2026-11-06',
        suggestedReceiver: '星河门店',
      },
      global: {
        plugins: [ElementPlus],
        stubs: {
          CostLedgerPartySelect: true,
          ElDialog: { template: '<div><slot/><slot name="footer"/></div>' },
        },
      },
    })
    w.findComponent(ElDialog).vm.$emit('open')
    await flushPromises()
    expect(w.findComponent(ElSelect).props('disabled')).toBe(true)
    expect(api.sources).toHaveBeenCalledTimes(1)
    expect(api.sources).toHaveBeenLastCalledWith(
      expect.objectContaining({ orderTypeCode: 'SALES_ORDER' }),
    )
    expect(w.text()).toContain('已选 0 张单据')
    expect(w.text()).toContain('业务员')
    expect(w.text()).toContain('订货宝销售单号')
    expect(w.get('input[aria-label="客户或收货方"]').attributes('placeholder')).toBe(
      '客户／收货方名称',
    )
    expect(w.emitted('selected')).toBeUndefined()
    w.unmount()
  })
})
