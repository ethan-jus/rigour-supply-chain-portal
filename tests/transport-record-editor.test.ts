import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Editor from '@/views/supply-chain/cost/TransportRecordEditor.vue'
import type { TransportDetail } from '@/api/core/transport-records'
import type { CostSource } from '@/api/core/cost'
import { createLedgerCommand } from '@/views/supply-chain/cost/cost-ledger'

vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
}))

const api = vi.hoisted(() => ({
  employees: vi.fn(),
  history: vi.fn(),
  sources: vi.fn(),
  save: vi.fn(),
}))
vi.mock('@/api/core/cost', () => ({
  getCostEmployees: api.employees,
  getCostHistory: api.history,
  getCostCities: vi.fn(),
  saveCost: vi.fn(),
}))
vi.mock('@/api/core/cost-ledger', () => ({
  getLedgerSources: api.sources,
  getLedgerParties: vi.fn(),
}))
vi.mock('@/api/core/transport-records', () => ({ saveTransport: api.save }))
vi.mock('@/utils/business-dictionary', () => ({
  loadBusinessDictionaries: vi.fn(),
  businessDictionaryOptions: (_module: string, code: string) =>
    ({
      COST_CARRIER: [
        { value: 'SF', label: '顺丰' },
        { value: 'JT_NEW', label: '极兔' },
      ],
      COST_PAYMENT_STATUS: [
        { value: 'PAID', label: '已付款' },
        { value: 'UNPAID', label: '未付款' },
        { value: 'UNKNOWN', label: '未知' },
      ],
    })[code] || [],
  businessDictionaryLabel: (_module: string, _code: string, value: string) => value || '-',
}))

function detail(): TransportDetail {
  const data = createLedgerCommand(true)
  data.ledger = null
  data.typeCode = 'DELIVERY'
  data.amount = 100.01
  data.costDate = '2026-11-10'
  return {
    platform: null,
    record: {
      id: 'C1',
      documentNo: 'LC1',
      revision: 2,
      categoryCode: 'LOGISTICS',
      statusCode: 'CONFIRMED',
      data,
      warehouseName: null,
      ownerEmployeeName: null,
      sources: [
        {
          id: 'S1',
          documentNo: 'SO1',
          sourceType: 'SALES_ORDER',
          receiverName: '确认时的门店',
          employeeName: '确认时的业务员',
          departmentName: '确认时的部门',
          documentDate: '2026-11-01',
          contactName: '原收货人',
          contactPhone: '13900000001',
          destinationAddress: '原收货地址',
        } as CostSource,
      ],
      createdTime: '',
      updatedTime: '',
    },
  }
}
const global = {
  plugins: [ElementPlus],
  stubs: {
    CostAttachments: true,
    CostAttachmentEditor: true,
    CostLedgerSourcePicker: true,
    CostCitySelect: true,
    CostLedgerPartySelect: true,
    CostLedgerEditor: true,
  },
}
beforeEach(() => {
  vi.clearAllMocks()
  api.employees.mockResolvedValue([])
  api.history.mockResolvedValue([])
  api.save.mockResolvedValue(detail())
  api.sources.mockResolvedValue([
    { documentNo: 'SO1', receiverName: '后续修改的门店', documentDate: '2026-11-01' },
  ])
})
describe('运输记录详情回填', () => {
  it.each(['完整来源快照', '台账快照'])(
    '只读详情使用%s，不覆盖确认时的业务资料',
    async (format) => {
      const d = detail()
      if (format === '台账快照') {
        const ledger = createLedgerCommand(true).ledger!
        ledger.receivingPoints = [
          {
            pointCode: 'TO1',
            partyTypeCode: 'CUSTOMER',
            partyCode: 'CU1',
            manualName: null,
            displayName: '确认时的门店',
            contactName: '原收货人',
            phone: '13900000001',
            address: '原收货地址',
            cityCode: '4201',
          },
        ]
        ledger.sources = [
          {
            orderCode: 'SO1',
            orderTypeCode: 'SALES_ORDER',
            linkRoleCode: 'COST',
            employeeName: '确认时的业务员',
            departmentName: '确认时的部门',
            allocations: [
              {
                feeKey: 'F1',
                receivingPointCode: 'TO1',
                cityCode: '4201',
                basis: 1,
                amount: 100.01,
              },
            ],
          },
        ]
        d.record.data.ledger = ledger
        d.record.sources = []
      }
      const wrapper = mount(Editor, {
        props: { modelValue: true, readonly: true, detail: d },
        global,
        attachTo: document.body,
      })
      await flushPromises()
      if (format === '台账快照') expect(api.sources).toHaveBeenCalledOnce()
      else expect(api.sources).not.toHaveBeenCalled()
      expect(document.body.textContent).toContain('确认时的门店')
      expect(document.body.textContent).toContain('确认时的业务员')
      expect(document.body.textContent).toContain('确认时的部门')
      expect(document.body.textContent).not.toContain('后续修改的门店')
      const receiverSection = Array.from(document.body.querySelectorAll('.transport-section')).find(
        (s) => s.querySelector('h3')?.textContent === '收货信息',
      )
      expect(receiverSection?.textContent).toContain('原收货人')
      expect(receiverSection?.textContent).toContain('13900000001')
      expect(receiverSection?.textContent).toContain('原收货地址')
      wrapper.unmount()
      document.body.innerHTML = ''
    },
  )
  it('历史未关联原单仍显示已保存的收货方、地址和物流公司，不提示查看者选单', async () => {
    const d = detail()
    d.record.sources = []
    d.record.data.logistics = {
      ...createLedgerCommand(true).logistics!,
      receiverName: '历史收货仓',
      destinationAddress: '历史收货地址',
      carrierName: '历史承运公司',
    }
    const wrapper = mount(Editor, {
      props: { modelValue: true, readonly: true, detail: d },
      global,
      attachTo: document.body,
    })
    await flushPromises()
    const receiverSection = Array.from(document.body.querySelectorAll('.transport-section')).find(
      (s) => s.querySelector('h3')?.textContent === '收货信息',
    )
    expect(receiverSection?.textContent).toContain('历史收货仓')
    expect(receiverSection?.textContent).toContain('历史收货地址')
    expect(document.body.textContent).toContain('历史承运公司')
    expect(document.body.textContent).not.toContain('选择业务订单后显示收货信息')
    expect(api.sources).not.toHaveBeenCalled()
    wrapper.unmount()
    document.body.innerHTML = ''
  })
  it.each([
    ['DRAFT', ['编辑', '确认', '作废'], ['撤销', '删除']],
    ['CONFIRMED', ['撤销'], ['编辑', '确认', '作废', '删除']],
    ['VOID', ['删除'], ['编辑', '确认', '作废', '撤销']],
  ])('详情 %s 只提供允许的操作并从详情进入订单关联', async (status, allowed, forbidden) => {
    const d = detail()
    d.record.statusCode = status as string
    const w = mount(Editor, {
      props: { modelValue: true, readonly: true, detail: d },
      global,
      attachTo: document.body,
    })
    await flushPromises()
    const heading = document.body.querySelector('.record-heading')!
    const labels = Array.from(heading.querySelectorAll('button')).map((b) => b.textContent!.trim())
    for (const label of allowed as string[]) expect(labels).toContain(label)
    for (const label of forbidden as string[]) expect(labels).not.toContain(label)
    const link = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent!.trim() === '更改关联',
    )
    if (status === 'DRAFT') {
      link!.click()
      await flushPromises()
      expect(w.emitted('edit')).toEqual([['orders']])
    } else expect(link).toBeUndefined()
    w.unmount()
    document.body.innerHTML = ''
  })
  it('资料未加载完时不能保存半加载的运输记录', async () => {
    api.employees.mockReturnValue(new Promise(() => {}))
    const d = detail()
    d.record.statusCode = 'DRAFT'
    const wrapper = mount(Editor, {
      props: { modelValue: true, readonly: false, detail: d },
      global,
      attachTo: document.body,
    })
    await flushPromises()
    const save = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '保存运输记录',
    )
    expect(save?.disabled).toBe(true)
    wrapper.unmount()
    document.body.innerHTML = ''
  })
})

describe('通用手工账单', () => {
  it.each(['SF', 'JT_NEW'])(
    '%s 独立保存第三方订单号、运单号、付款状态和账单分项',
    async (carrier) => {
      const d = detail()
      d.record.statusCode = 'DRAFT'
      d.record.data.ledger = createLedgerCommand(true).ledger!
      d.record.data.ledger.feeItems[0]!.allocationMethodCode = 'EQUAL'
      Object.assign(d.record.data.ledger, {
        carrierCode: carrier,
        transportPurposeCode: 'DELIVERY',
        platformOrderNo: 'THIRD-001',
        trackingNo: 'WB-001',
        sources: [
          { orderCode: 'SO1', orderTypeCode: 'SALES_ORDER', linkRoleCode: 'COST', allocations: [] },
        ],
        manualBillItems: [
          { name: '运费', amount: 20 },
          { name: '优惠', amount: -2 },
        ],
      })
      d.record.data.paymentStatusCode = 'UNPAID'
      d.record.data.amount = 18
      const w = mount(Editor, {
        props: { modelValue: true, readonly: false, detail: d },
        global,
        attachTo: document.body,
      })
      await flushPromises()
      await w.find('input[placeholder="填写物流公司提供的订单号"]').setValue('THIRD-002')
      await w.find('input[placeholder="填写运单号"]').setValue('WB-002')
      const payment = w
        .findAllComponents({ name: 'ElSelect' })
        .find((select) => select.props('placeholder') === '请选择付款状态')!
      payment.vm.$emit('update:modelValue', 'PAID')
      const amounts = w
        .findAllComponents({ name: 'ElInputNumber' })
        .filter((input) => input.props('placeholder') === '填写金额')
      amounts[0]!.vm.$emit('update:modelValue', 24.35)
      await flushPromises()
      expect(w.text()).toContain('22.35')
      const save = w.findAll('button').find((b) => b.text() === '保存运输记录')!
      await save.trigger('click')
      await flushPromises()
      expect(api.save).toHaveBeenCalledWith(
        'C1',
        expect.objectContaining({
          carrierCode: carrier,
          platformOrderNo: 'THIRD-002',
          trackingNo: 'WB-002',
          paymentStatusCode: 'PAID',
          amount: 22.35,
          manualBillItems: [
            { name: '运费', amount: 24.35 },
            { name: '优惠', amount: -2 },
          ],
        }),
      )
      w.unmount()
      document.body.innerHTML = ''
    },
  )
  it('只读详情保留付款状态和带优惠的账单，账单不出现输入控件', async () => {
    const d = detail()
    d.record.data.ledger = createLedgerCommand(true).ledger!
    Object.assign(d.record.data.ledger, {
      carrierCode: 'SF',
      platformOrderNo: 'SF-ORDER',
      trackingNo: 'SF-WAYBILL',
      manualBillItems: [
        { name: '运费', amount: 20 },
        { name: '优惠', amount: -2 },
      ],
    })
    d.record.data.paymentStatusCode = 'PAID'
    d.record.data.amount = 18
    const w = mount(Editor, {
      props: { modelValue: true, readonly: true, detail: d },
      global,
      attachTo: document.body,
    })
    await flushPromises()
    expect(w.text()).toContain('第三方订单号')
    expect(w.text()).toContain('SF-ORDER')
    expect(w.text()).toContain('SF-WAYBILL')
    expect(w.text()).toContain('付款状态')
    expect(w.text()).toContain('PAID')
    expect(w.text()).toContain('-2.00')
    expect(w.findAll('input')).toHaveLength(0)
    expect(w.text()).not.toContain('货拉拉订单号')
    w.unmount()
    document.body.innerHTML = ''
  })
  it.each([false, true])(
    '手工账单分项缺失为%s时，支持只填总额；负净额不能保存',
    async (negative) => {
      const d = detail()
      d.record.statusCode = 'DRAFT'
      d.record.data.ledger = createLedgerCommand(true).ledger!
      Object.assign(d.record.data.ledger, {
        carrierCode: 'SF',
        transportPurposeCode: 'DELIVERY',
        feeItems: [{ ...d.record.data.ledger.feeItems[0], allocationMethodCode: 'EQUAL' }],
        sources: [
          { orderCode: 'SO1', orderTypeCode: 'SALES_ORDER', linkRoleCode: 'COST', allocations: [] },
        ],
        manualBillItems: negative ? [{ name: '优惠', amount: -5 }] : [],
      })
      d.record.data.amount = negative ? -5 : 35
      d.record.data.paymentStatusCode = 'UNPAID'
      const w = mount(Editor, {
        props: { modelValue: true, readonly: false, detail: d },
        global,
        attachTo: document.body,
      })
      await flushPromises()
      await w
        .findAll('button')
        .find((b) => b.text() === '保存运输记录')!
        .trigger('click')
      await flushPromises()
      if (negative) {
        expect(api.save).not.toHaveBeenCalled()
        expect(w.text()).toContain('优惠后合计不能小于0')
      } else
        expect(api.save).toHaveBeenCalledWith(
          'C1',
          expect.objectContaining({ amount: 35, paymentStatusCode: 'UNPAID', manualBillItems: [] }),
        )
      w.unmount()
      document.body.innerHTML = ''
    },
  )
  it('只填总额的记录不把系统的合计费用冒充账单分项', async () => {
    const d = detail()
    d.record.data.ledger = createLedgerCommand(true).ledger!
    d.record.data.ledger.manualBillItems = []
    const w = mount(Editor, {
      props: { modelValue: true, readonly: true, detail: d },
      global,
      attachTo: document.body,
    })
    await flushPromises()
    expect(w.text()).toContain('未登记费用明细')
    w.unmount()
    document.body.innerHTML = ''
  })
})
