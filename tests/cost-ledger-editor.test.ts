import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive } from 'vue'
import ElementPlus, { ElMessage } from 'element-plus'
import Editor from '@/views/supply-chain/cost/CostLedgerEditor.vue'
import PartySelect from '@/views/supply-chain/cost/CostLedgerPartySelect.vue'
import { createLedgerCommand, newParty } from '@/views/supply-chain/cost/cost-ledger'

vi.mock('@/views/supply-chain/cost/cost-dictionaries', () => ({
  costOptions: () => [],
  costLabel: (_code: string, value: string) => value || '—',
  costMoney: (value: number | null) => (value == null ? '待补金额' : value.toFixed(2)),
}))

describe('物流组合费用继承实际收货方', () => {
  it.each([false, true])('增加费用保留原订单收货点，多收货点=%s', async (multiple) => {
    const form = reactive(createLedgerCommand(true))
    const plan = form.ledger!
    const points = [
      { ...newParty('CQ'), pointCode: 'point-cq', manualName: '重庆门店' },
      { ...newParty('WH'), pointCode: 'point-wh', manualName: '武汉门店' },
    ]
    plan.receivingPoints = points
    const oldFee = plan.feeItems[0]!
    plan.sources = [0, 1].map((i) => ({
      orderTypeCode: 'SALES_ORDER',
      orderCode: `SO-${i}`,
      linkRoleCode: 'COST',
      noSourceReason: '',
      allocations: (multiple ? points : [points[i]!]).map((point) => ({
        feeKey: oldFee.feeKey,
        receivingPointCode: point.pointCode,
        cityCode: point.cityCode,
        basis: null,
        amount: null,
      })),
    }))
    const wrapper = mount(Editor, {
      props: { modelValue: form, logistics: true, cities: [], employees: [] },
      global: {
        plugins: [ElementPlus],
        stubs: {
          CostDictSelect: true,
          CostLedgerPartyFields: true,
          CostLedgerPartySelect: true,
          CostLedgerSourcePicker: true,
        },
      },
    })
    try {
      await wrapper
        .findAll('button')
        .find((b) => b.text() === '新增费用项目')!
        .trigger('click')
      const newFee = plan.feeItems[1]!
      for (let i = 0; i < plan.sources.length; i++) {
        expect(plan.sources[i]!.allocations.filter((a) => a.feeKey === newFee.feeKey)).toEqual(
          (multiple ? points : [points[i]!]).map((point) => ({
            feeKey: newFee.feeKey,
            receivingPointCode: point.pointCode,
            cityCode: point.cityCode,
            basis: null,
            amount: 0,
          })),
        )
      }
    } finally {
      wrapper.unmount()
    }
  })
})

describe('仓储费用仓库城市校验', () => {
  it.each([null, '', 'DHB_AREA_1027'])(
    '缺少有效经营城市时提示维护档案，来源城市=%s',
    async (cityCode) => {
      const form = reactive(createLedgerCommand(false))
      form.cityCode = 'WH'
      form.cityName = '武汉市'
      const warning = vi.spyOn(ElMessage, 'warning').mockImplementation(() => ({ close: vi.fn() }))
      const wrapper = mount(Editor, {
        props: {
          modelValue: form,
          logistics: false,
          cities: [{ code: 'WH', name: '武汉市' }],
          employees: [],
        },
        global: {
          plugins: [ElementPlus],
          stubs: { CostDictSelect: true, CostLedgerPartySelect: true },
        },
      })
      try {
        wrapper.findAllComponents(PartySelect)[0]!.vm.$emit('selected', { code: 'WH1', cityCode })
        await wrapper.vm.$nextTick()
        expect(form.cityCode).toBe('')
        expect(form.cityName).toBe('')
        expect(warning).toHaveBeenCalledWith(expect.stringContaining('请先维护仓库档案'))
      } finally {
        wrapper.unmount()
        warning.mockRestore()
      }
    },
  )
})
