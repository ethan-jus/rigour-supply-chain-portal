import { beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { createMemoryHistory, createRouter } from 'vue-router'
import Panel from '@/views/supply-chain/order/components/SalesLogisticsPanel.vue'
import { createLedgerCommand } from '@/views/supply-chain/cost/cost-ledger'
import type { SalesLogisticsContext } from '@/api/core/sales-logistics'
import type { TransportDetail } from '@/api/core/transport-records'

const api = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), dictionaries: vi.fn() }))
vi.mock('@/utils/business-dictionary', () => ({
  loadBusinessDictionaries: api.dictionaries,
}))
vi.mock('@/api/core/sales-logistics', () => ({ getSalesLogistics: api.list }))
vi.mock('@/api/core/transport-records', () => ({ getTransport: api.detail }))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
}))
vi.mock('@/views/supply-chain/cost/cost-dictionaries', () => ({
  loadCostDictionaries: vi.fn(),
  costLabel: (_code: string, value: string) => (value === 'SF' ? '顺丰' : '-'),
}))

beforeEach(() => vi.clearAllMocks())

it('物流发货保留本单分摊口径，路线采用运输快照，查看复用只读运输详情', async () => {
  const data = createLedgerCommand(true)
  data.ledger!.carrierCode = 'SF'
  data.ledger!.platformOrderNo = 'SF001'
  data.amount = 100
  data.ledger!.sender = { ...data.ledger!.sender, manualName: '总部仓', address: '发货地址' }
  const transport = {
    record: {
      id: 'C1',
      documentNo: 'LC1',
      revision: 1,
      statusCode: 'ACTIVE',
      businessStatusCode: 'COMPLETE',
      data,
      sources: [
        {
          documentNo: 'SO1',
          sourceType: 'SALES_ORDER',
          receiverName: '门店甲',
          destinationAddress: '收货地址',
        },
      ],
    },
    platform: null,
  } as TransportDetail
  const context = {
    salesOrder: { documentNo: 'SO1' },
    canAssociate: true,
    allocatedAmount: 40,
    confirmedAmount: 40,
    transports: [
      transport,
      {
        ...transport,
        record: { ...transport.record, id: 'C2', documentNo: 'LC-VOID', statusCode: 'VOID' },
      },
      {
        ...transport,
        record: {
          ...transport.record,
          id: 'C3',
          documentNo: 'LC-PENDING',
          businessStatusCode: 'INCOMPLETE',
        },
      },
    ],
  } as SalesLogisticsContext
  api.list.mockResolvedValue(context)
  api.detail.mockResolvedValue(transport)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  const wrapper = mount(Panel, {
    props: { orderId: 'S1' },
    global: {
      plugins: [ElementPlus, router],
      stubs: { TransportRecordEditor: true, SalesLogisticsChooser: true },
    },
  })
  await flushPromises()
  expect(api.dictionaries).toHaveBeenCalledWith([
    { moduleCode: '', code: 'COST_CARRIER' },
    { moduleCode: '', code: 'COST_DELIVERY_MODE' },
  ])
  const summary = wrapper.get('.logistics-summary').text().replace(/\s+/g, '')
  expect(summary).toContain('已关联2笔')
  expect(summary).toContain('本单分摊费用40.00元')
  expect(summary).toContain('计入运输成本40.00元')
  expect(wrapper.text()).toContain('顺丰')
  expect(wrapper.text()).toContain('SF001')
  expect(wrapper.text()).toContain('总部仓')
  expect(wrapper.text()).toContain('门店甲')
  expect(wrapper.text()).not.toContain('单据状态')
  expect(wrapper.text()).not.toContain('已完善')
  expect(wrapper.text()).not.toContain('待完善')
  expect(wrapper.text()).toContain('LC-PENDING')
  expect(wrapper.text()).not.toContain('LC-VOID')
  expect(wrapper.text()).not.toContain('已作废')
  expect(wrapper.findAll('button').filter((b) => b.text() === '查看物流')).toHaveLength(2)
  const view = wrapper.findAll('button').find((b) => b.text() === '查看物流')!
  await view.trigger('click')
  await flushPromises()
  expect(api.detail).toHaveBeenCalledWith('C1')
  expect(wrapper.findComponent({ name: 'TransportRecordEditor' }).props()).toMatchObject({
    readonly: true,
    detail: transport,
  })
  wrapper.unmount()
})
