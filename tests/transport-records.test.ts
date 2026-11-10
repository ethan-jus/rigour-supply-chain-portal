import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import View from '@/views/supply-chain/cost/LogisticsTransportRecordsView.vue'
import Bill from '@/views/supply-chain/cost/TransportPlatformBill.vue'
import type { TransportPage, PlatformTransport } from '@/api/core/transport-records'
import type { CostRecord } from '@/api/core/cost'
import {
  transportDraft,
  amountOf,
  allocationPreview,
  receiversOf,
} from '@/views/supply-chain/cost/transport-records'
import { createLedgerCommand } from '@/views/supply-chain/cost/cost-ledger'
const api = vi.hoisted(() => ({
  list: vi.fn(),
  selected: vi.fn(),
  workbook: vi.fn(),
  dictionaries: vi.fn(),
  getVoucher: vi.fn(),
}))
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ query: {} }),
}))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
}))
vi.mock('@/api/core/transport-records', () => ({
  getTransportRecords: api.list,
  exportSelectedTransport: api.selected,
  getTransportVoucher: api.getVoucher,
  getTransport: vi.fn(),
  saveTransport: vi.fn(),
  confirmTransport: vi.fn(),
}))
vi.mock('@/api/core/cost', () => ({
  changeCostStatus: vi.fn(),
  getCostCities: vi.fn(),
  getCostEmployees: vi.fn(),
}))
vi.mock('@/views/supply-chain/cost/cost-export', () => ({ exportCostRows: api.workbook }))
vi.mock('@/utils/business-dictionary', () => ({
  loadBusinessDictionaries: api.dictionaries,
  businessDictionaryOptions: () => [],
  businessDictionaryLabel: (_module: string, _code: string, value: string) => value || '-',
}))
const record = (): CostRecord => ({
  id: 'C1',
  documentNo: 'LC202611100001',
  statusCode: 'CONFIRMED',
  revision: 2,
  categoryCode: 'LOGISTICS',
  data: { ...createLedgerCommand(true), costDate: '2026-11-10', amount: 137.64 },
  sources: [],
  warehouseName: null,
  ownerEmployeeName: null,
  createdTime: '',
  updatedTime: '',
})
const platform = (): PlatformTransport => ({
  source: {
    id: 'R1',
    costId: 'C1',
    state: 'GENERATED',
    revision: 2,
    fileName: '接口',
    sourceChannel: 'API',
    sourceDifference: true,
    order: {
      enterpriseId: '1001',
      orderNo: '3624071813921329726',
      useTime: '2026-11-10 10:00:00',
      status: '已完成',
      paidAmount: 142.64,
      raw: {},
      salesOrderNos: [],
      line: 0,
      facts: {
        connectorId: 'X1',
        sourceEmployeeName: '王先生',
        mappedEmployeeCode: null,
        billAmount: 142.64,
        unpaidAmount: 0,
        refundAmount: 0,
        couponAmount: 5,
        bonusAmount: 0,
        billState: 'FINAL',
        issue: null,
        stops: [
          {
            name: '武汉仓',
            contactName: '仓管',
            contactPhone: '13900000001',
            address: '仓储路1号',
          },
          {
            name: '星河门店',
            contactName: '张先生',
            contactPhone: '13900000002',
            address: '沿江路18号',
          },
          {
            name: '长江门店',
            contactName: '李女士',
            contactPhone: '13900000003',
            address: '江汉路20号',
          },
        ],
        fees: [
          { name: '专享价', amount: 108.85 },
          {
            name: '高速路桥费',
            amount: 20,
            vouchers: [{ id: 'V1', name: '路桥凭证.png', state: 'PENDING' }],
          },
          { name: '搬运费', amount: 11 },
          { name: '税费', amount: 2.79 },
          { name: '货运券抵扣', amount: -5 },
          { name: '停车费', amount: 5 },
        ],
      },
    },
  },
  draft: null,
  billHistory: [],
})
let wrapper: VueWrapper | undefined
beforeEach(() => {
  vi.clearAllMocks()
  api.dictionaries.mockResolvedValue(undefined)
  api.workbook.mockResolvedValue(undefined)
  api.list.mockResolvedValue({
    page: { total: 1, begin: 0, step: 20, items: [record()] },
    platformRecords: { C1: platform() },
  } satisfies TransportPage)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})
function button(label: string) {
  const b = wrapper!.findAll('button').find((b) => b.text() === label)
  expect(b, label).toBeTruthy()
  return b!
}
async function startExport() {
  await button('自定义导出').trigger('click')
  await flushPromises()
  await button('开始导出').trigger('click')
  await flushPromises()
}
describe('统一运输记录 V2.5', () => {
  it('最新运输费用与已确认成本分离，付款进度不重复计费，多收货方逐一展示', () => {
    const p = platform(),
      r = record()
    expect(amountOf(r, p)).toBe(142.64)
    expect(r.data.amount).toBe(137.64)
    expect(receiversOf(r, p)).toEqual(['星河门店', '长江门店'])
    const incomplete = platform()
    incomplete.source.order.facts!.stops = []
    expect(receiversOf(r, incomplete)).toEqual(['-'])
    expect(transportDraft(r, p).carrierCode).toBe('HLL')
    expect(transportDraft(r, p).amount).toBe(142.64)
  })
  it('未知金额与零金额区分，手动金额分到多单后精确守恒', () => {
    const r = record(),
      p = platform()
    p.source.order.facts!.billAmount = null
    expect(amountOf(r, p)).toBeNull()
    expect(transportDraft(r, p).amount).toBeNull()
    p.source.order.facts!.billAmount = 0
    expect(transportDraft(r, p).amount).toBe(0)
    const splits = allocationPreview(100.01, ['SO3', 'SO1', 'SO2'])
    expect(splits).toEqual([
      { code: 'SO1', amount: 33.34 },
      { code: 'SO2', amount: 33.34 },
      { code: 'SO3', amount: 33.33 },
    ])
    expect(splits.reduce((n, s) => n + Math.round(s.amount * 100), 0)).toBe(10001)
  })
  it('平台账单四项分别展示，明细和凭证只读，确认金额不随新账单变动', async () => {
    wrapper = mount(Bill, {
      props: { recordId: 'C1', platform: platform(), confirmed: true, confirmedAmount: 137.64 },
      global: { plugins: [ElementPlus], stubs: { CostFilePreview: true } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('已确认成本仍为 ¥137.64')
    expect(wrapper.findAll('.bill-totals strong').map((s) => s.text())).toEqual([
      '142.64',
      '142.64',
      '0.00',
      '0.00',
    ])
    expect(wrapper.text()).toContain('待获取')
    expect(wrapper.text()).toContain('货运券抵扣')
    expect(wrapper.findAll('input')).toHaveLength(0)
  })
  it('未勾选导出全部筛选结果，默认完整字段且平台费用取一次总额', async () => {
    wrapper = mount(View, {
      global: {
        plugins: [ElementPlus],
        stubs: { CostCarrierOrdersPanel: true, TransportRecordEditor: true, ElTeleport: true },
      },
    })
    await flushPromises()
    await startExport()
    expect(api.selected).not.toHaveBeenCalled()
    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ begin: 0, step: 200 }), true)
    const [, headers, rows] = api.workbook.mock.calls[0]!
    expect(headers.length).toBeGreaterThan(15)
    expect(headers).toContain('已确认运输成本（元）')
    expect(rows[0][headers.indexOf('运输费用（元）')]).toBe(142.64)
    expect(rows[0][headers.indexOf('已确认运输成本（元）')]).toBe(137.64)
    expect(rows[0][headers.indexOf('货拉拉订单号')]).toBe('3624071813921329726')
  })
  it('已勾选只导出选择记录，不能回退成整批；单据状态在创建人之前', async () => {
    api.selected.mockResolvedValue([{ record: record(), platform: platform() }])
    wrapper = mount(View, {
      global: {
        plugins: [ElementPlus],
        stubs: { CostCarrierOrdersPanel: true, TransportRecordEditor: true, ElTeleport: true },
      },
    })
    await flushPromises()
    wrapper.findComponent({ name: 'ElTable' }).vm.$emit('selection-change', [record()])
    await flushPromises()
    await startExport()
    expect(api.selected).toHaveBeenCalledWith(['C1'])
    expect(api.list).toHaveBeenCalledTimes(1)
    const text = wrapper.text()
    expect(text.indexOf('单据状态', text.indexOf('费用单号'))).toBeLessThan(text.indexOf('创建人'))
    expect(wrapper.text()).not.toContain('来源差异')
  })
})
