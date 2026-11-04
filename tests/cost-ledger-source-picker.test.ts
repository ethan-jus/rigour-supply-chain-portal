import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ElementPlus, { ElCheckbox, ElDialog, ElSelect } from 'element-plus'
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
      documentNo: q.orderTypeCode === 'SALES_ORDER' ? 'SO202611030001' : 'PO202611030001',
      senderName: '武汉城市仓',
      receiverName: '星河门店',
      statusCode: 'CONFIRMED',
      documentDate: '2026-11-03',
    },
  ])
})
describe('物流关联单据选择', () => {
  it('单号与供应商名称分别筛选，跨类型勾选后一次带回', async () => {
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
    const fields = w.findAll('.el-form-item')
    await fields[1]!.get('input').setValue('PO20261103')
    await fields[2]!.get('input').setValue('华东食品')
    await w
      .findAll('button')
      .find((b) => b.text() === '查询')!
      .trigger('click')
    await flushPromises()
    expect(api.sources).toHaveBeenLastCalledWith(
      expect.objectContaining({
        documentNo: 'PO20261103',
        partyName: '华东食品',
        orderTypeCode: 'PURCHASE_ORDER',
      }),
    )
    w.findAllComponents(ElCheckbox)
      .find((c) => c.attributes('aria-label') === '选择PO202611030001')!
      .vm.$emit('change', true)
    await w.vm.$nextTick()
    const select = w.findComponent(ElSelect)
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
        expect.objectContaining({ documentNo: 'PO202611030001', orderTypeCode: 'PURCHASE_ORDER' }),
        expect.objectContaining({ documentNo: 'SO202611030001', orderTypeCode: 'SALES_ORDER' }),
      ]),
    )
    expect(w.emitted('selected')?.[0]?.[0]).toHaveLength(2)
    w.unmount()
  })
})
