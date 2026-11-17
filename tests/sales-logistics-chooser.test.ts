import { beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Chooser from '@/views/supply-chain/order/components/SalesLogisticsChooser.vue'
import type { SalesLogisticsContext } from '@/api/core/sales-logistics'
const api = vi.hoisted(() => ({ list: vi.fn(), link: vi.fn() }))
vi.mock('@/api/core/transport-records', () => ({ getTransportRecords: api.list }))
vi.mock('@/api/core/sales-logistics', () => ({ linkSalesLogistics: api.link }))
vi.mock('@/views/supply-chain/cost/cost-dictionaries', () => ({
  costOptions: (code: string) =>
    code === 'COST_DELIVERY_MODE'
      ? [
          { value: 'THIRD_PARTY', label: '第三方配送' },
          { value: 'SELF', label: '自营配送' },
        ]
      : [
          { value: 'HLL', label: '货拉拉' },
          { value: 'JT_NEW', label: '字典新物流公司' },
        ],
  costLabel: (_code: string, value: string) => value || '-',
}))
const context = {
  salesOrder: {
    documentNo: 'SO001',
    receiverName: '门店',
    employeeName: '业务员',
    departmentName: '销售部',
  },
  transports: [],
  allocatedAmount: null,
  confirmedAmount: null,
  canAssociate: true,
} as unknown as SalesLogisticsContext
const global = {
  plugins: [ElementPlus],
  stubs: {
    ElDialog: { template: '<section><slot /><slot name="footer" /></section>' },
    TransportRecordEditor: {
      props: ['salesOrderId', 'salesSource', 'initialCarrierCode'],
      template: '<div data-test="manual">手工录入表单</div>',
    },
    TransportRouteSummary: true,
  },
}
beforeEach(() => {
  vi.clearAllMocks()
  api.list.mockResolvedValue({ page: { items: [], total: 0 }, platformRecords: {} })
})
it('新增字典物流公司直接提供手工录入入口，并携带当前销售订单，不查询货拉拉候选', async () => {
  const wrapper = mount(Chooser, { props: { modelValue: true, orderId: 11, context }, global })
  await flushPromises()
  const selects = wrapper.findAllComponents({ name: 'ElSelect' })
  selects[1]!.vm.$emit('update:modelValue', 'JT_NEW')
  selects[1]!.vm.$emit('change', 'JT_NEW')
  await flushPromises()
  const button = wrapper.findAll('button').find((b) => b.text() === '手工录入物流')!
  expect(button.exists()).toBe(true)
  await button.trigger('click')
  const editor = wrapper.findComponent({ name: 'TransportRecordEditor' })
  expect(wrapper.find('[data-test="manual"]').exists()).toBe(true)
  if (editor.exists()) expect(editor.props('salesOrderId')).toBe(11)
  expect(api.list).not.toHaveBeenCalled()
  expect(api.link).not.toHaveBeenCalled()
  wrapper.unmount()
})
it('货拉拉选择使用本地已同步运输列表，筛选区域与已选信息分开显示', async () => {
  const wrapper = mount(Chooser, { props: { modelValue: true, orderId: 11, context }, global })
  await flushPromises()
  const select = wrapper.findAllComponents({ name: 'ElSelect' })[1]!
  select.vm.$emit('update:modelValue', 'HLL')
  select.vm.$emit('change', 'HLL')
  await flushPromises()
  expect(api.list).toHaveBeenCalledWith(
    expect.objectContaining({ sourceSystem: 'HUOLALA', carrierCode: 'HLL', step: 50 }),
  )
  expect(wrapper.text()).toContain('运输记录')
  expect(wrapper.text()).not.toContain('推荐依据')
  expect(wrapper.findAll('button').some((b) => b.text() === '手工录入物流')).toBe(false)
  expect(api.link).not.toHaveBeenCalled()
  wrapper.unmount()
})

it('选择物流同时保留待完善和已完善记录，排除已作废记录且不能选中已有的作废关联', async () => {
  const record = (id: string, status: string, business: string) => ({
    id,
    documentNo: id,
    revision: 1,
    statusCode: status,
    businessStatusCode: business,
    data: { typeCode: 'DELIVERY', amount: 10, ledger: null },
    sources: [],
  })
  const platform = (id: string) => ({
    source: {
      order: { orderNo: id, status: '已完成', raw: {}, facts: { billAmount: 10, stops: [] } },
    },
    draft: { orderCodes: id === 'LC-VOID' ? ['SO001'] : [] },
  })
  const voidRecord = record('LC-VOID', 'VOID', 'VOID')
  api.list.mockResolvedValue({
    page: {
      items: [
        record('LC-PENDING', 'ACTIVE', 'INCOMPLETE'),
        record('LC-COMPLETE', 'ACTIVE', 'COMPLETE'),
        voidRecord,
      ],
      total: 3,
    },
    platformRecords: Object.fromEntries(
      ['LC-PENDING', 'LC-COMPLETE', 'LC-VOID'].map((id) => [id, platform(id)]),
    ),
  })
  const wrapper = mount(Chooser, { props: { modelValue: true, orderId: 11, context }, global })
  const carrier = wrapper.findAllComponents({ name: 'ElSelect' })[1]!
  carrier.vm.$emit('update:modelValue', 'HLL')
  carrier.vm.$emit('change', 'HLL')
  await flushPromises()
  expect(wrapper.text()).toContain('LC-PENDING')
  expect(wrapper.text()).toContain('LC-COMPLETE')
  expect(wrapper.text()).not.toContain('单据状态')
  expect(wrapper.text()).not.toContain('待完善')
  expect(wrapper.text()).not.toContain('已完善')
  expect(wrapper.text()).not.toContain('LC-VOID')
  expect(wrapper.text()).not.toContain('已作废')
  wrapper.findComponent({ name: 'ElTable' }).vm.$emit('row-click', {
    record: voidRecord,
    platform: platform('LC-VOID'),
  })
  await flushPromises()
  expect(wrapper.find('[aria-label="已选物流信息"]').exists()).toBe(false)
  const save = wrapper.findAll('button').find((button) => button.text() === '保存关联')!
  expect(save.attributes('disabled')).toBeDefined()
  expect(api.link).not.toHaveBeenCalled()
  wrapper.unmount()
})

it('再次关联已有运输时先展示所有销售单的分摊预览，不额外创建费用', async () => {
  const record = {
    id: 'C1',
    documentNo: 'LC1',
    revision: 3,
    statusCode: 'ACTIVE',
    data: { typeCode: 'DELIVERY', amount: 137.64, ledger: null },
    sources: [{ documentNo: 'SO002', sourceType: 'SALES_ORDER', documentAmount: 4000 }],
  }
  const platform = {
    source: {
      order: {
        orderNo: 'HL001',
        status: '已完成',
        raw: {},
        facts: { billAmount: 137.64, stops: [] },
      },
    },
    draft: { orderCodes: ['SO002'] },
  }
  api.list.mockResolvedValue({
    page: { items: [record], total: 1 },
    platformRecords: { C1: platform },
  })
  const wrapper = mount(Chooser, {
    props: {
      modelValue: true,
      orderId: 11,
      context: {
        ...context,
        salesOrder: { ...context.salesOrder, sourceType: 'SALES_ORDER', documentAmount: 6000 },
      },
    },
    global,
  })
  const carrier = wrapper.findAllComponents({ name: 'ElSelect' })[1]!
  carrier.vm.$emit('update:modelValue', 'HLL')
  carrier.vm.$emit('change', 'HLL')
  await flushPromises()
  wrapper.findComponent({ name: 'ElTable' }).vm.$emit('row-click', { record, platform })
  await flushPromises()
  expect(wrapper.text()).toContain('关联后分摊预览')
  expect(wrapper.text()).toContain('82.58')
  expect(wrapper.text()).toContain('55.06')
  expect(api.link).not.toHaveBeenCalled()
  wrapper.unmount()
})

it('自动带入物流优先展示订货宝保存的公司与快递单号，不依赖字典已映射', async () => {
  const wrapper = mount(Chooser, {
    props: {
      modelValue: true,
      orderId: 11,
      context: {
        ...context,
        transports: [
          {
            record: {
              id: 'DHB1',
              documentNo: 'LC-DHB1',
              statusCode: 'ACTIVE',
              data: { ledger: null },
            },
            platform: null,
            shipments: [
              { latest: { carrierName: '极兔速递', trackingNumbers: ['JT001', 'JT002'] } },
            ],
          },
        ],
      } as unknown as SalesLogisticsContext,
    },
    global,
  })
  await flushPromises()
  expect(wrapper.text()).toContain('已自动带入')
  expect(wrapper.text()).toContain('极兔速递')
  expect(wrapper.text()).toContain('JT001、JT002')
  expect(api.list).not.toHaveBeenCalled()
  wrapper.unmount()
})

it('已作废的订货宝物流不再显示为自动带入记录', async () => {
  const wrapper = mount(Chooser, {
    props: {
      modelValue: true,
      orderId: 11,
      context: {
        ...context,
        transports: [
          {
            record: { id: 'VOID1', documentNo: 'LC-VOID', statusCode: 'VOID' },
            shipments: [{ latest: { carrierName: '顺丰', trackingNumbers: ['SF-VOID'] } }],
          },
        ],
      } as unknown as SalesLogisticsContext,
    },
    global,
  })
  await flushPromises()
  expect(wrapper.text()).not.toContain('已自动带入')
  expect(wrapper.text()).not.toContain('LC-VOID')
  expect(wrapper.text()).not.toContain('SF-VOID')
  wrapper.unmount()
})
