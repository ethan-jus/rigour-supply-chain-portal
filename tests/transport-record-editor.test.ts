import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { defineComponent } from 'vue'
import Editor from '@/views/supply-chain/cost/TransportRecordEditor.vue'
import TransportShipmentSources from '@/views/supply-chain/cost/TransportShipmentSources.vue'
import type { ShipmentTransportSource, TransportDetail } from '@/api/core/transport-records'
import type { CostEmployee, CostSource } from '@/api/core/cost'
import { createLedgerCommand } from '@/views/supply-chain/cost/cost-ledger'

vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
}))

const getMappedDhbCarrierValues = vi.hoisted(() => vi.fn().mockResolvedValue([]))
vi.mock('@/api/core/business-settings', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getMappedDhbCarrierValues,
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
  getCostCities: vi.fn().mockResolvedValue([]),
  saveCost: vi.fn(),
}))
vi.mock('@/api/core/cost-ledger', () => ({
  getLedgerSources: api.sources,
  getLedgerParties: vi.fn(),
}))
vi.mock('@/api/core/transport-records', () => ({
  saveTransport: api.save,
  saveTransportWithEvidence: api.save,
  getTransportVoucher: vi.fn(),
}))
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
      statusCode: 'ACTIVE',
      data,
      warehouseName: null,
      ownerEmployeeName: null,
      sources: [
        {
          id: 'S1',
          documentNo: 'SO1',
          sourceType: 'SALES_ORDER',
          receiverCode: 'CUS1',
          cityCode: 'WH',
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
    RouterLink: true,
    CostAttachments: true,
    CostAttachmentEditor: true,
    TransportEvidence: defineComponent({
      template: '<div />',
      emits: ['count'],
      mounted() {
        this.$emit('count', 1)
      },
    }),
    CostLedgerSourcePicker: true,
    CostCitySelect: true,
    CostLedgerPartySelect: true,
    CostLedgerEditor: true,
  },
}
beforeEach(() => {
  vi.clearAllMocks()
  getMappedDhbCarrierValues.mockResolvedValue([])
  api.employees.mockResolvedValue([])
  api.history.mockResolvedValue([])
  api.save.mockResolvedValue(detail())
  api.sources.mockResolvedValue([
    { documentNo: 'SO1', receiverName: '后续修改的门店', documentDate: '2026-11-01' },
  ])
})
describe('运输记录详情回填', () => {
  it('操作记录保留业务修改，隐藏系统迁移说明和附件内部编号', async () => {
    api.history.mockResolvedValue([
      { action: 'STATE_UPGRADE', reason: '内部迁移说明', actorId: 'system', occurredTime: '' },
      {
        action: 'ATTACHMENT_ADDED',
        reason: '附件 internal-file-id',
        actorId: 'U',
        occurredTime: '',
      },
      { action: 'UPDATE', reason: '根据运费票据更正金额', actorId: 'U', occurredTime: '' },
    ])
    const w = mount(Editor, {
      props: { modelValue: true, readonly: true, detail: detail() },
      global,
    })
    await flushPromises()
    expect(w.text()).toContain('添加附件')
    expect(w.text()).toContain('根据运费票据更正金额')
    expect(w.text()).not.toContain('内部迁移说明')
    expect(w.text()).not.toContain('internal-file-id')
    w.unmount()
  })

  it.each(['新增', '编辑', '查看'])(
    '%s沿用同一核心分区和关联字段，查看不提供输入控件',
    async (mode) => {
      const d = detail()
      d.record.statusCode = 'ACTIVE'
      d.record.data.ledger = validManualLedger()
      const w = mount(Editor, {
        props: {
          modelValue: true,
          readonly: mode === '查看',
          detail: mode === '新增' ? null : d,
          salesSource: mode === '新增' ? d.record.sources[0] : undefined,
          salesOrderId: mode === '新增' ? 'SO1' : undefined,
          initialCarrierCode: 'SF',
        },
        global,
        attachTo: document.body,
      })
      await flushPromises()
      const headings = [
        ...document.body.querySelectorAll(
          '.transport-section > h3, .transport-section > .section-heading > h3',
        ),
      ].map((e) => e.textContent)
      expect(headings.slice(0, 7)).toEqual([
        '基本信息',
        '关联业务订单',
        '费用信息',
        '发货信息',
        '收货信息与行驶路段',
        '凭证与运输影像',
        '备注',
      ])
      const columns = [...document.body.querySelectorAll('th')].map((e) => e.textContent)
      expect(columns).toContain('订单关联时间')
      for (const label of [
        '收货方式',
        '费用负责人',
        '付款状态',
        '运输费用总额（元）',
        '发货仓库',
        '发货方',
        '收货单位',
        '收货联系人',
        '收货联系电话',
        '收货地址',
      ])
        expect(document.body.textContent).toContain(label)
      const receiving = w
        .findAll('.el-form-item')
        .find((item) => item.find('.el-form-item__label').text() === '收货方式')!
      if (mode === '查看') {
        expect(w.findAll('input')).toHaveLength(0)
        expect(receiving.get('.el-form-item__content').text()).toBe('到点自提')
      } else {
        expect(receiving.get('[aria-label="收货方式"]').attributes('disabled')).toBeUndefined()
      }
      w.unmount()
      document.body.innerHTML = ''
    },
  )
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
      expect(api.sources).not.toHaveBeenCalled()
      expect(document.body.textContent).toContain('确认时的门店')
      expect(document.body.textContent).toContain('确认时的业务员')
      expect(document.body.textContent).toContain('确认时的部门')
      expect(document.body.textContent).not.toContain('后续修改的门店')
      const receiverSection = Array.from(document.body.querySelectorAll('.transport-section')).find(
        (s) => s.querySelector('h3')?.textContent === '收货信息与行驶路段',
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
      (s) => s.querySelector('h3')?.textContent === '收货信息与行驶路段',
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
    ['ACTIVE', [], ['编辑', '作废', '确认', '撤销', '删除']],
    ['VOID', [], ['删除', '编辑', '确认', '作废', '撤销']],
  ])('详情 %s 只供查看，不允许编辑作废或改变订单关联', async (status, allowed, forbidden) => {
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
    expect(link).toBeUndefined()
    expect(w.emitted('edit')).toBeUndefined()
    w.unmount()
    document.body.innerHTML = ''
  })
  it('员工选项加载不阻塞已有运输快照展示，保存仍需表单必填校验', async () => {
    api.employees.mockReturnValue(new Promise(() => {}))
    const d = detail()
    d.record.statusCode = 'ACTIVE'
    const wrapper = mount(Editor, {
      props: { modelValue: true, readonly: false, detail: d },
      global,
      attachTo: document.body,
    })
    await flushPromises()
    const save = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '保存运输记录',
    )
    expect(save?.disabled).toBe(false)
    wrapper.unmount()
    document.body.innerHTML = ''
  })
})

function validManualLedger() {
  const ledger = createLedgerCommand(true).ledger!
  Object.assign(ledger, {
    deliveryModeCode: 'THIRD_PARTY',
    receivingMethodCode: 'SELF_PICKUP',
    platformOrderNo: 'SF001',
    sender: {
      pointCode: 'FROM',
      partyTypeCode: 'OTHER',
      manualName: '武汉仓',
      displayName: '武汉仓',
      address: '武汉市仓库路1号',
      cityCode: 'WH',
    },
    receivingPoints: [
      {
        pointCode: 'TO0',
        partyTypeCode: 'CUSTOMER',
        partyCode: 'CUS1',
        manualName: '确认时的门店',
        displayName: '确认时的门店',
        contactName: '王先生',
        phone: '13900000001',
        address: '收货地址',
        cityCode: 'WH',
      },
    ],
  })
  return ledger
}
describe('通用手工账单', () => {
  it('全部费用和优惠合计后保存，修改与移除费用即时重算，不将合计再算一遍', async () => {
    const d = detail()
    d.record.statusCode = 'ACTIVE'
    d.record.data.ledger = validManualLedger()
    Object.assign(d.record.data.ledger, {
      carrierCode: 'SF',
      transportPurposeCode: 'DELIVERY',
      feeItems: [{ ...d.record.data.ledger.feeItems[0], allocationMethodCode: 'EQUAL' }],
      sources: [
        { orderCode: 'SO1', orderTypeCode: 'SALES_ORDER', linkRoleCode: 'COST', allocations: [] },
      ],
      manualBillItems: [
        { name: '基础运费', amount: 54 },
        { name: '装卸费', amount: 10 },
        { name: '燃油费', amount: 3.2 },
        { name: '运输保险费', amount: 2.8 },
        { name: '优惠', amount: 5 },
      ],
    })
    d.record.data.amount = 65
    const w = mount(Editor, {
      props: { modelValue: true, readonly: false, detail: d },
      global,
      attachTo: document.body,
    })
    await flushPromises()
    const receiving = w
      .findAllComponents({ name: 'ElSelect' })
      .find((select) => select.props('placeholder') === '请选择收货方式')!
    expect(receiving.props('modelValue')).toBe('SELF_PICKUP')
    receiving.vm.$emit('update:modelValue', 'DOOR_DELIVERY')
    await flushPromises()
    const summary = () => w.find('[aria-label="账单汇总"]').text()
    expect(summary()).toContain('费用小计（元）70.00')
    expect(summary()).toContain('优惠及减免（元）5.00')
    expect(
      w
        .findAllComponents({ name: 'ElInputNumber' })
        .find((i) => i.props('placeholder') === '填写本次运输费用')!
        .props('modelValue'),
    ).toBe(65)
    const amounts = w
      .findAllComponents({ name: 'ElInputNumber' })
      .filter((input) => input.props('placeholder') === '填写金额')
    const totalInput = w
      .findAllComponents({ name: 'ElInputNumber' })
      .find((input) => input.props('placeholder') === '填写本次运输费用')!
    await totalInput.find('input').setValue('72.25')
    await totalInput.find('input').trigger('blur')
    await flushPromises()
    expect((totalInput.find('input').element as HTMLInputElement).value).toBe('72.25')
    expect(amounts[0]!.props('modelValue')).toBe(61.25)
    expect(amounts[1]!.props('modelValue')).toBe(10)
    expect(amounts[4]!.props('modelValue')).toBe(5)
    expect(summary()).toContain('费用小计（元）77.25')
    expect(summary()).toContain('优惠及减免（元）5.00')
    await totalInput.find('input').setValue('65')
    await totalInput.find('input').trigger('blur')
    await flushPromises()
    amounts[1]!.vm.$emit('update:modelValue', 12)
    await flushPromises()
    expect(
      w
        .findAllComponents({ name: 'ElInputNumber' })
        .find((i) => i.props('placeholder') === '填写本次运输费用')!
        .props('modelValue'),
    ).toBe(67)
    await w
      .findAll('tr')
      .find((row) => row.text().includes('优惠') && row.find('button').exists())!
      .find('button')
      .trigger('click')
    await flushPromises()
    expect(
      w
        .findAllComponents({ name: 'ElInputNumber' })
        .find((i) => i.props('placeholder') === '填写本次运输费用')!
        .props('modelValue'),
    ).toBe(72)
    await w
      .findAll('button')
      .find((b) => b.text() === '保存运输记录')!
      .trigger('click')
    await flushPromises()
    expect(api.save).toHaveBeenCalledWith(
      'C1',
      expect.objectContaining({
        draft: expect.objectContaining({
          amount: 72,
          receivingMethodCode: 'DOOR_DELIVERY',
          manualBillItems: expect.arrayContaining([{ name: '装卸费', amount: 12 }]),
        }),
      }),
      [],
    )
    w.unmount()
    document.body.innerHTML = ''
  })
  it('添加明细保留已填总额，切回只填总额后可直接修改并保存', async () => {
    const d = detail()
    d.record.statusCode = 'ACTIVE'
    d.record.data.ledger = validManualLedger()
    Object.assign(d.record.data.ledger, {
      carrierCode: 'SF',
      transportPurposeCode: 'DELIVERY',
      feeItems: [{ ...d.record.data.ledger.feeItems[0], allocationMethodCode: 'EQUAL' }],
      sources: [
        { orderCode: 'SO1', orderTypeCode: 'SALES_ORDER', linkRoleCode: 'COST', allocations: [] },
      ],
      manualBillItems: [],
    })
    d.record.data.amount = 35.27
    const w = mount(Editor, {
      props: { modelValue: true, readonly: false, detail: d },
      global,
      attachTo: document.body,
    })
    await flushPromises()
    await w
      .findAll('button')
      .find((b) => b.text() === '添加费用项目')!
      .trigger('click')
    await flushPromises()
    expect(w.text()).toContain('全部费用减去优惠后的合计')
    const billAmount = w
      .findAllComponents({ name: 'ElInputNumber' })
      .find((input) => input.props('placeholder') === '填写金额')!
    expect(billAmount.props('modelValue')).toBe(35.27)
    await w
      .findAll('button')
      .find((b) => b.text() === '改为只填总额')!
      .trigger('click')
    await flushPromises()
    const total = w
      .findAllComponents({ name: 'ElInputNumber' })
      .find((input) => input.props('placeholder') === '填写本次运输费用')!
    expect(total.props('modelValue')).toBe(35.27)
    await total.find('input').setValue('36.28')
    await total.find('input').trigger('blur')
    await flushPromises()
    await w
      .findAll('button')
      .find((b) => b.text() === '保存运输记录')!
      .trigger('click')
    await flushPromises()
    expect(api.save).toHaveBeenCalledWith(
      'C1',
      expect.objectContaining({
        draft: expect.objectContaining({ amount: 36.28, manualBillItems: [] }),
      }),
      [],
    )
    w.unmount()
    document.body.innerHTML = ''
  })

  it.each(['SF', 'JT_NEW'])(
    '%s 用快递单号编辑原平台单号，保留隐藏的历史运单号、付款状态和费用分项',
    async (carrier) => {
      const d = detail()
      d.record.statusCode = 'ACTIVE'
      d.record.data.ledger = validManualLedger()
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
      await w.find('input[placeholder="填写快递单号"]').setValue('THIRD-002')
      expect(w.find('input[placeholder="填写运单号"]').exists()).toBe(false)
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
          draft: expect.objectContaining({
            carrierCode: carrier,
            platformOrderNo: 'THIRD-002',
            trackingNo: 'WB-001',
            paymentStatusCode: 'PAID',
            amount: 22.35,
            manualBillItems: [
              { name: '运费', amount: 24.35 },
              { name: '优惠', amount: -2 },
            ],
          }),
        }),
        [],
      )
      w.unmount()
      document.body.innerHTML = ''
    },
  )
  it('只读详情保留付款状态和带优惠的账单，账单不出现输入控件', async () => {
    const d = detail()
    d.record.data.ledger = validManualLedger()
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
    expect(w.text()).toContain('快递单号')
    expect(w.text()).not.toContain('运单号')
    expect(w.text()).not.toContain('第三方订单号')
    expect(w.text()).toContain('SF-ORDER')
    expect(w.text()).not.toContain('SF-WAYBILL')
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
      d.record.statusCode = 'ACTIVE'
      d.record.data.ledger = validManualLedger()
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
        expect(w.text()).toContain('金额须为非负数')
      } else
        expect(api.save).toHaveBeenCalledWith(
          'C1',
          expect.objectContaining({
            draft: expect.objectContaining({
              amount: 35,
              paymentStatusCode: 'UNPAID',
              manualBillItems: [],
            }),
          }),
          [],
        )
      w.unmount()
      document.body.innerHTML = ''
    },
  )
  it('只填总额的记录不把系统的合计费用冒充账单分项', async () => {
    const d = detail()
    d.record.data.ledger = validManualLedger()
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

describe('物流详情的信息优先级', () => {
  it.each([true, false])('立即送从发货来源回显公司，物流编辑保持只读（详情=%s）', async (readonly) => {
    const d = detail()
    d.record.data.ledger = validManualLedger()
    d.record.data.ledger.deliveryModeCode = 'SELF'
    d.record.data.ledger.carrierCode = null
    d.record.data.amount = 0
    d.shipments = [{
      id: 'FH-1',
      costId: d.record.id,
      issue: null,
      differencePending: false,
      latest: {
        shipmentId: 'FH-1',
        shipmentNo: 'FH.20261120.0639',
        salesOrderId: 'SO1',
        sourceStatus: 'receivedin',
        shipTime: '2026-11-20T08:52:00Z',
        sourceUpdatedAt: null,
        carrierCode: null,
        carrierName: '立即送',
        deliveryModeCode: 'SELF',
        deliveryModeName: '送货上门',
        trackingNumbers: [],
        receiver: null,
        sourceFields: {},
        goods: [],
      },
    }]
    const w = mount(Editor, {
      props: { modelValue: true, readonly, detail: d },
      global,
      attachTo: document.body,
    })
    try {
      await flushPromises()
      const carrier = w.findAll('.el-form-item').find((field) => field.text().includes('物流公司'))
      expect(carrier?.text()).toContain('立即送')
      expect(carrier?.find('input').exists()).toBe(false)
      expect(w.text()).toContain('送货上门')
      expect(w.findAll('.el-form-item').some((field) => field.text().startsWith('快递单号'))).toBe(false)
    } finally {
      w.unmount()
      document.body.innerHTML = ''
    }
  })

  it('按发货商品行显示订货宝规格，兼容单字段和缺失规格', async () => {
    const latest: ShipmentTransportSource['latest'] = {
      shipmentId: 'SHIP1',
      shipmentNo: 'FH-1',
      salesOrderId: 'SO1',
      sourceStatus: 'receivedin',
      shipTime: '2026-11-18T08:38:00Z',
      sourceUpdatedAt: null,
      carrierCode: null,
      carrierName: null,
      deliveryModeCode: null,
      deliveryModeName: null,
      trackingNumbers: [],
      receiver: null,
      sourceFields: {},
      goods: [
        {
          goods_num: '100003',
          options_info: [{ options_name: 'A300' }],
          ships_number: 1,
          remark: '发货前核对颜色',
        },
        { goods_num: '100003', options_info: [{ options_name: 'A500' }], ships_number: 1 },
        {
          options_info: [{ options_name: '蓝色' }, null, { options_name: ' ' }, { options_name: '加厚' }],
          goods_options: '旧规格',
        },
        { options_info: [{ options_name: ' ' }], goods_options: '单规格' },
        { options_info: null },
      ],
    }
    const w = mount(TransportShipmentSources, {
      props: { sources: [{ id: 'SHIP1', costId: 'C1', issue: null, differencePending: false, latest }] },
      global,
    })
    try {
      await w.get('.el-collapse-item__header').trigger('click')
      await flushPromises()
      const specs = w.findAll('.el-table__body tbody tr').map((row) => row.findAll('td')[2]?.text())
      expect(specs).toEqual(['A300', 'A500', '蓝色 / 加厚', '单规格', '-'])
      expect(w.findAll('th').at(-1)?.text()).toBe('商品备注')
      expect(w.findAll('.goods-remark').map((cell) => cell.text())).toEqual([
        '发货前核对颜色',
        '-',
        '-',
        '-',
        '-',
      ])
    } finally {
      w.unmount()
    }
  })

  it('同一费用单优先展示货拉拉运输信息，保留订货宝原发货资料', async () => {
    const d = detail()
    const orderNo = '3618959686541873242'
    d.record.data.amount = 37.03
    d.platform = {
      source: {
        id: 'P1',
        costId: 'C1',
        state: 'GENERATED',
        revision: 1,
        fileName: '接口',
        order: {
          enterpriseId: 'E1',
          orderNo,
          status: '已完成',
          paidAmount: 37.03,
          useTime: '2026-11-01 13:17:34',
          raw: { 下单时间: '2026-11-01 13:08:41', 车型: '跑腿' },
          salesOrderNos: [],
          line: 0,
        },
      },
      draft: null,
      billHistory: [],
    }
    const shipment: ShipmentTransportSource = {
      id: 'SHIP1',
      costId: 'C1',
      issue: '来源物流公司尚未映射，请维护数据字典的来源映射后重新同步',
      differencePending: false,
      latest: {
        shipmentId: 'SHIP1',
        shipmentNo: 'FH.20261101.0001',
        salesOrderId: 'SO1',
        sourceStatus: 'received',
        shipTime: '2026-11-01T05:22:00Z',
        sourceUpdatedAt: null,
        carrierCode: null,
        carrierName: null,
        deliveryModeCode: 'THIRD_PARTY',
        deliveryModeName: '快递',
        trackingNumbers: [orderNo],
        receiver: null,
        sourceFields: {},
        goods: [{ goods_name: '球杆', options_info: [{ options_name: 'A300' }], ships_number: 2 }],
      },
    }
    d.shipments = [shipment]
    const w = mount(Editor, {
      props: { modelValue: true, readonly: true, detail: d },
      global,
      attachTo: document.body,
    })
    try {
      await flushPromises()
      const basic = w.get('.transport-section')
      for (const value of [
        '货拉拉和订货宝同步',
        '收货方式',
        '送货上门',
        orderNo,
        '2026-11-01 13:08:41',
        '跑腿',
      ])
        expect(basic.text()).toContain(value)
      expect(basic.text()).not.toContain('订货宝发货方式')
      expect(w.text()).toContain('37.03')
      expect(w.text()).toContain('SO1')
      const source = w.get('[aria-label="订货宝发货信息"]')
      expect(source.text()).toContain('FH.20261101.0001')
      expect(source.text()).toContain('已收货')
      expect(source.text()).toContain('订货宝发货方式快递')
      expect(source.text()).toContain('已按快递单号关联货拉拉')
      expect(source.find('.el-alert').exists()).toBe(false)
      expect(getMappedDhbCarrierValues).not.toHaveBeenCalled()
      await source.get('.el-collapse-item__header').trigger('click')
      expect(source.text()).toContain('球杆')
      expect(source.text()).toContain('A300')
    } finally {
      w.unmount()
    }

    const review = mount(TransportShipmentSources, {
      props: {
        huolalaOrderNo: orderNo,
        sources: [{ ...shipment, issue: '已关联的业务订单待核对', differencePending: true }],
      },
      global,
    })
    try {
      expect(review.get('.el-alert').text()).toContain('已关联的业务订单待核对')
    } finally {
      review.unmount()
    }
  })

  it.each([
    ['快递', '完整'],
    ['快递', '待设置配送方式'],
    ['客户自提', '完整'],
    ['送货上门', '完整'],
    ['送货上门', '未识别物流公司'],
    ['送货上门', '物流公司更新中'],
    ['送货上门', '仅识别物流公司'],
  ])('订货宝「%s」资料%s时保留来源字段且不重复', async (sourceMode, state) => {
    const mapped = state === '完整'
    const updating = state === '物流公司更新中'
    if (updating) getMappedDhbCarrierValues.mockResolvedValueOnce(['顺丰速运'])
    const d = detail()
    const detailRemark =
      sourceMode === '快递' ? '到店请联系仓库' : sourceMode === '客户自提' ? undefined : ''
    const listRemark = '发货列表备注'
    d.record.data.remark = '本系统补充说明'
    d.record.data.ledger = {
      ...validManualLedger(),
      carrierCode: 'SF',
      deliveryModeCode: mapped ? 'THIRD_PARTY' : '',
      transportMethodCode: sourceMode === '快递' ? 'EXPRESS' : null,
      shippingTime: '2026-11-16T16:18:00',
    }
    d.shipments = [
      {
        id: 'SHIP1',
        costId: 'C1',
        issue: mapped ? null : '来源配送方式尚未映射，请维护数据字典的来源映射后重新同步',
        differencePending: false,
        latest: {
          shipmentId: 'SHIP1',
          shipmentNo: 'FH.20261116.0420',
          salesOrderId: 'SO1',
          sourceStatus: 'receivedin',
          shipTime: '2026-11-16T08:18:00Z',
          sourceUpdatedAt: null,
          carrierCode: state === '未识别物流公司' || updating ? null : 'SF',
          carrierName: '顺丰速运',
          deliveryModeCode: mapped ? 'THIRD_PARTY' : null,
          deliveryModeName: sourceMode,
          trackingNumbers: ['SF1582052267166'],
          receiver: null,
          sourceFields: {
            detail: {
              logistics_name: '顺丰速运',
              distribution_mode_name: sourceMode,
              remark: detailRemark,
            },
            list: { remark: listRemark },
          },
          goods: [{ goods_name: '球杆', ships_number: 2, units_name: '支' }],
        },
      },
    ]
    const w = mount(Editor, {
      props: { modelValue: true, readonly: true, detail: d },
      global,
      attachTo: document.body,
    })
    await flushPromises()
    const basic = w.findAll('.transport-section').find((s) => s.find('h3').text() === '基本信息')!
    for (const value of ['发货时间', '配送方式', '物流公司', '快递单号', 'SF1582052267166'])
      expect(basic.text()).toContain(value)
    const source = w.get('[aria-label="订货宝发货信息"]')
    expect(source.text()).toContain('FH.20261116.0420')
    expect(source.text()).toContain('待收货')
    expect(source.text()).toContain('发货商品')
    for (const readonly of [true, false]) {
      await w.setProps({ readonly })
      const fields = basic.findAll('.el-form-item')
      const sourceModeFields = fields.filter(
        (item) => item.get('.el-form-item__label').text() === '订货宝发货方式',
      )
      expect(sourceModeFields).toHaveLength(1)
      expect(sourceModeFields[0]!.get('.el-form-item__content').text()).toBe(sourceMode)
      expect(sourceModeFields[0]!.find('input').exists()).toBe(false)
      expect(basic.text()).not.toContain('运输渠道')
      expect(basic.text()).not.toContain('收货方式')
      if (!mapped) expect(basic.text()).toContain('待核对')
      const remarks = w.get('[aria-label="运输备注"]')
      expect(remarks.get('.platform-remark p').text()).toBe((detailRemark ?? listRemark) || '-')
      expect(remarks.get('.platform-remark').find('textarea').exists()).toBe(false)
      if (readonly) expect(remarks.text()).toContain('本系统补充说明')
      else expect(remarks.get('textarea').element.value).toBe('本系统补充说明')
    }
    const sourceLabels = source.findAll('dt').map((item) => item.text())
    for (const label of [
      '发货时间',
      '配送方式',
      '订货宝发货方式',
      '收货方式',
      '送达要求',
      '物流公司',
      '快递单号',
    ])
      expect(sourceLabels).not.toContain(label)
    if (updating) {
      expect(getMappedDhbCarrierValues).toHaveBeenCalledWith(['顺丰速运'])
      expect(source.text()).toContain('顺丰速运 · 更新中')
      expect(source.text()).not.toContain('去设置')
    } else if (state === '仅识别物流公司') {
      expect(source.text()).toContain('配送方式待核对')
      expect(source.text()).not.toContain('去设置')
    } else if (state === '待设置配送方式') {
      expect(source.text()).toContain('配送方式待核对')
      expect(source.find('router-link-stub').exists()).toBe(true)
      expect(source.text()).not.toContain('快递')
    } else if (!mapped) {
      expect(source.text()).toContain('物流公司待核对：顺丰速运')
    } else {
      expect(source.find('[role="alert"]').exists()).toBe(false)
    }
    await source.get('.el-collapse-item__header').trigger('click')
    await flushPromises()
    expect(source.text()).toContain('球杆')
    expect(source.text()).not.toContain('商品备注')
    w.unmount()
    document.body.innerHTML = ''
  })
  it('负责人档案未返回时先显示原单姓名，返回后更新姓名，界面不显示员工编码', async () => {
    let finish!: (rows: CostEmployee[]) => void
    api.employees.mockReturnValue(
      new Promise<CostEmployee[]>((resolve) => {
        finish = resolve
      }),
    )
    const source = {
      ...detail().record.sources[0]!,
      employeeCode: 'INTERNAL-EMP-1',
      employeeName: '原单姓名',
      departmentName: '金华市',
    }
    const w = mount(Editor, {
      props: {
        modelValue: true,
        readonly: false,
        detail: null,
        salesSource: source,
        salesOrderId: 'SO1',
      },
      global,
      attachTo: document.body,
    })
    await flushPromises()
    const field = w
      .findAllComponents({ name: 'ElFormItem' })
      .find((item) => item.props('label') === '费用负责人')!
    expect(field.text()).toContain('原单姓名（金华市）')
    expect(field.text()).not.toContain('INTERNAL-EMP-1')
    finish([
      {
        employeeCode: 'INTERNAL-EMP-1',
        employeeName: '档案姓名',
        departmentName: '金华市',
        departmentId: 1,
      },
    ])
    await flushPromises()
    expect(field.text()).toContain('档案姓名（金华市）')
    expect(field.text()).not.toContain('INTERNAL-EMP-1')
    w.unmount()
    document.body.innerHTML = ''
  })
  it.each([null, '', '  \n  '])('手工记录空备注 %s 统一显示短横线', async (remark) => {
    const d = detail()
    Object.assign(d.record.data, { remark })
    const w = mount(Editor, {
      props: { modelValue: true, readonly: true, detail: d },
      global,
      attachTo: document.body,
    })
    await flushPromises()
    const notes = w.get('[aria-label="运输备注"]')
    expect(notes.get('.remark').text()).toBe('-')
    expect(notes.find('.platform-remark').exists()).toBe(false)
    w.unmount()
    document.body.innerHTML = ''
  })
  it('平台最新备注与人工补充集中展示且不互相覆盖，编辑和查看仅各显示一次', async () => {
    const d = detail()
    d.record.data.remark = '人工补充：收货前联系店长'
    const sourceOrder = {
      enterpriseId: 'E1',
      orderNo: 'HL001',
      status: '已完成',
      paidAmount: 100.01,
      useTime: '2026-11-10 10:00:00',
      salesOrderNos: [],
      line: 0,
      raw: { 订单备注: '旧平台备注' },
    }
    d.platform = {
      source: {
        id: 'P1',
        costId: 'C1',
        revision: 1,
        fileName: '接口',
        state: 'GENERATED',
        order: sourceOrder,
        latestOrder: { ...sourceOrder, raw: { 订单备注: '两箱货，送货单签字后拍照' } },
      },
      draft: null,
      billHistory: [],
    }
    const w = mount(Editor, {
      props: { modelValue: true, readonly: false, detail: d },
      global,
      attachTo: document.body,
    })
    await flushPromises()
    const receiving = w
      .get('.transport-section')
      .findAll('.el-form-item')
      .find((item) => item.get('.el-form-item__label').text() === '收货方式')!
    expect(receiving.get('.el-form-item__content').text()).toBe('送货上门')
    expect(receiving.find('input').exists()).toBe(false)
    const notes = w.get('[aria-label="运输备注"]')
    expect(notes.text()).toContain('物流订单备注')
    expect(notes.text()).toContain('补充备注')
    expect(notes.text().split('两箱货，送货单签字后拍照')).toHaveLength(2)
    expect(w.text()).not.toContain('旧平台备注')
    expect(notes.get('textarea').element.value).toBe('人工补充：收货前联系店长')
    expect(w.find('.platform-details').text()).not.toContain('平台订单备注')
    await w.setProps({ readonly: true })
    expect(receiving.get('.el-form-item__content').text()).toBe('送货上门')
    expect(notes.find('textarea').exists()).toBe(false)
    expect(notes.text()).toContain('人工补充：收货前联系店长')
    expect(notes.text()).toContain('两箱货，送货单签字后拍照')
    expect(d.record.data.remark).toBe('人工补充：收货前联系店长')
    w.unmount()
    d.platform.source.latestOrder!.raw['订单备注'] = '  '
    const empty = mount(Editor, {
      props: { modelValue: true, readonly: true, detail: d },
      global,
      attachTo: document.body,
    })
    await flushPromises()
    expect(empty.get('.platform-remark p').text()).toBe('-')
    expect(empty.text()).not.toContain('未填写订单备注')
    expect(empty.text()).not.toContain('旧平台备注')
    empty.unmount()
    document.body.innerHTML = ''
  })
  it('费用与快递单号前置，平台确认成本不被新账单替代，多收货点按需展开且资料不丢失', async () => {
    const d = detail()
    d.platform = {
      source: {
        id: 'P1',
        costId: 'C1',
        state: 'GENERATED',
        revision: 2,
        fileName: '接口',
        sourceDifference: true,
        order: {
          enterpriseId: 'E1',
          orderNo: 'HL-ORDER-001',
          useTime: '2026-11-10 10:00:00',
          status: '已完成',
          paidAmount: 120,
          raw: { 车型: '微面', 下单时间: '2026-11-09 19:20:30', 运单号: 'LEGACY-HIDDEN' },
          line: 0,
          salesOrderNos: [],
          facts: {
            connectorId: 'X1',
            sourceEmployeeName: null,
            mappedEmployeeCode: null,
            billAmount: 120,
            unpaidAmount: 0,
            refundAmount: 0,
            couponAmount: 0,
            billState: 'FINAL',
            issue: null,
            stops: [
              {
                name: '发货仓',
                address: '发货地址',
                contactName: '仓管',
                contactPhone: '13900000000',
              },
              ...Array.from({ length: 5 }, (_, i) => ({
                name: `门店${i + 1}`,
                address: `地址${i + 1}`,
                contactName: `联系人${i + 1}`,
                contactPhone: '13900000001',
              })),
            ],
            fees: [],
          },
        },
      },
      draft: null,
      billHistory: [],
    }
    const w = mount(Editor, {
      props: { modelValue: true, readonly: true, detail: d },
      global,
      attachTo: document.body,
    })
    await flushPromises()
    const sections = Array.from(document.body.querySelectorAll('.transport-section'))
    expect(sections[0]!.querySelector('h3')?.textContent).toBe('基本信息')
    const timeLabels = [
      ...sections[0]!.querySelectorAll('.el-form-item__label, .info-field > span'),
    ].filter((e) => e.textContent?.trim() === '下单时间')
    expect(timeLabels).toHaveLength(1)
    expect(document.body.textContent).not.toContain('运输概览')
    const fees = sections.find((s) => s.querySelector('h3')?.textContent === '费用信息')!
    expect(fees.textContent).toContain('120.00')
    expect(fees.textContent).toContain('100.01')
    expect(fees.textContent).toContain('已付款')
    for (const text of ['快递单号', 'HL-ORDER-001', '微面', '2026-11-09 19:20:30', '与运输费用'])
      expect(document.body.textContent).toContain(text)
    expect(document.body.textContent).not.toContain('LEGACY-HIDDEN')
    expect(document.body.textContent).not.toContain('运单号')
    expect(document.body.textContent).not.toContain('第三方订单号')
    const receivers = sections.find(
      (s) => s.querySelector('h3')?.textContent === '收货信息与行驶路段',
    )!
    expect(receivers.querySelectorAll('.address-card')).toHaveLength(2)
    const toggle = Array.from(receivers.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '展开全部 5 个收货点',
    )!
    toggle.click()
    await flushPromises()
    expect(receivers.querySelectorAll('.address-card')).toHaveLength(5)
    expect(receivers.textContent).toContain('联系人5')
    expect(receivers.textContent).toContain('地址5')
    expect(api.save).not.toHaveBeenCalled()
    w.unmount()
    document.body.innerHTML = ''
  })
})

describe('多单费用分摊', () => {
  it('编辑可调整各销售单金额，合计不等于总费用时拒绝保存，保存携带完整分摊', async () => {
    const d = detail()
    d.record.statusCode = 'ACTIVE'
    d.record.data.amount = 137.64
    const ledger = validManualLedger()
    ledger.carrierCode = 'SF'
    ledger.feeItems[0]!.feeKey = 'freight'
    ledger.feeItems[0]!.allocationMethodCode = 'AMOUNT'
    ledger.sources = [
      {
        orderCode: 'SO1',
        orderTypeCode: 'SALES_ORDER',
        linkRoleCode: 'COST',
        documentAmount: 6000,
        allocations: [
          {
            feeKey: 'freight',
            receivingPointCode: 'TO0',
            cityCode: 'WH',
            basis: 6000,
            amount: 82.58,
          },
        ],
      },
      {
        orderCode: 'SO2',
        orderTypeCode: 'SALES_ORDER',
        linkRoleCode: 'COST',
        documentAmount: 4000,
        allocations: [
          {
            feeKey: 'freight',
            receivingPointCode: 'TO0',
            cityCode: 'WH',
            basis: 4000,
            amount: 55.06,
          },
        ],
      },
    ]
    d.record.data.ledger = ledger
    d.record.sources = [
      { ...d.record.sources[0]!, documentAmount: 6000 },
      { ...d.record.sources[0]!, id: 'S2', documentNo: 'SO2', documentAmount: 4000 },
    ]
    const w = mount(Editor, {
      props: { modelValue: true, readonly: false, detail: d },
      global,
      attachTo: document.body,
    })
    await flushPromises()
    const input = (code: string) =>
      w
        .findAllComponents({ name: 'ElInputNumber' })
        .find((c) => c.props('ariaLabel') === `${code}分摊金额`)!
    input('SO1').vm.$emit('update:modelValue', 80)
    await flushPromises()
    const save = w.findAll('button').find((b) => b.text() === '保存运输记录')!
    await save.trigger('click')
    await flushPromises()
    expect(api.save).not.toHaveBeenCalled()
    expect(w.text()).toContain('订单分摊合计必须等于运输费用')
    input('SO2').vm.$emit('update:modelValue', 57.64)
    await flushPromises()
    await save.trigger('click')
    await flushPromises()
    expect(api.save).toHaveBeenCalledWith(
      'C1',
      expect.objectContaining({
        draft: expect.objectContaining({ orderAllocations: { SO1: 80, SO2: 57.64 } }),
      }),
      [],
    )
    w.unmount()
    document.body.innerHTML = ''
  })
})
