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
  vehicleOf,
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
      raw: { 下单时间: '2026-11-09 18:30:26', 车型: '微面' },
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
describe('统一运输记录 V2.6', () => {
  it('列表和导出使用最新平台下单时间；缺失时不拿运输日期或本系统创建时间补位', async () => {
    const p = platform()
    p.source.latestOrder = {
      ...p.source.order,
      raw: { 下单时间: '2026-11-10 08:15:36' },
    }
    const manual = { ...record(), id: 'MANUAL', createdTime: '2026-11-12T02:00:00Z' }
    api.list.mockResolvedValue({
      page: { total: 2, begin: 0, step: 20, items: [record(), manual] },
      platformRecords: { C1: p },
    })
    wrapper = mount(View, {
      global: {
        plugins: [ElementPlus],
        stubs: { CostCarrierOrdersPanel: true, TransportRecordEditor: true, ElTeleport: true },
      },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('下单时间')
    expect(wrapper.text()).toContain('2026-11-10 08:15:36')
    expect(wrapper.text()).not.toContain('2026-11-09 18:30:26')
    await startExport()
    const [, headers, rows] = api.workbook.mock.calls[0]!
    expect(rows.map((r: string[]) => r[headers.indexOf('下单时间')])).toEqual([
      '2026-11-10 08:15:36',
      '-',
    ])
  })

  it('车型取最新平台资料；手工和缺失资料保持横线，不按物流公司猜测', () => {
    const p = platform()
    expect(vehicleOf(p)).toBe('微面')
    p.source.latestOrder = { ...p.source.order, raw: { 车型: '小货车' } }
    expect(vehicleOf(p)).toBe('小货车')
    p.source.latestOrder.raw = {}
    expect(vehicleOf(p)).toBe('-')
    expect(vehicleOf(null)).toBe('-')
  })
  it('快递单号筛选使用原独立平台单号参数，不与隐藏的运单号混用', async () => {
    wrapper = mount(View, {
      global: {
        plugins: [ElementPlus],
        stubs: { CostCarrierOrdersPanel: true, TransportRecordEditor: true },
      },
    })
    await flushPromises()
    await wrapper.find('input[aria-label="快递单号"]').setValue('3624071813921329726')
    await wrapper.find('form[aria-label="查询条件"]').trigger('submit')
    await flushPromises()
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ platformOrderNo: '3624071813921329726' }),
    )
    expect(api.list.mock.lastCall?.[0]).not.toHaveProperty('trackingNo')
    expect(wrapper.find('input[aria-label="运单号"]').exists()).toBe(false)
  })
  it('手工两个号码独立回填，平台没有运单号时不拿平台订单号补位', () => {
    const r = record()
    r.data.ledger = createLedgerCommand(true).ledger!
    r.data.ledger.carrierCode = 'HLL'
    r.data.ledger.trackingNo = 'WB-001'
    r.data.ledger.platformOrderNo = '3624071813921329726'
    expect(transportDraft(r).trackingNo).toBe('WB-001')
    expect(transportDraft(r).platformOrderNo).toBe('3624071813921329726')
    r.data.ledger.platformOrderNo = null
    expect(transportDraft(r).platformOrderNo).toBe('')
    expect(transportDraft(r, platform()).trackingNo).toBe('')
    r.data.ledger.manualBillItems = [{ name: '原手工运费', amount: 137.64 }]
    expect(transportDraft(r, platform()).manualBillItems).toEqual([])
  })
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
    expect(wrapper.text()).toContain('付款状态已付款')
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
    const settings = wrapper.findComponent({ name: 'TableColumnSettings' })
    const labels = (settings.props('columns') as { label: string }[]).map((c) => c.label)
    expect(labels).toContain('物流公司')
    expect(labels).toContain('下单时间')
    expect(labels.indexOf('下单时间')).toBeLessThan(labels.indexOf('行驶路段'))
    expect(labels).toContain('快递单号')
    expect(labels).toContain('车型')
    expect(labels).not.toContain('运单号')
    expect(labels.indexOf('快递单号')).toBeLessThan(labels.indexOf('物流公司'))
    expect(labels).toContain('行驶路段')
    expect(labels).toContain('收货点数')
    expect(labels.indexOf('行驶路段')).toBeLessThan(labels.indexOf('运输类型'))
    expect(labels).not.toContain('收货方')
    expect(labels).not.toContain('已支付（元）')
    expect(labels).not.toContain('付款状态')
    expect(labels).not.toContain('货拉拉下单员工')
    expect(headers).toContain('付款状态')
    expect(headers.length).toBeGreaterThan(15)
    expect(headers).toContain('已确认运输成本（元）')
    expect(headers).toContain('本系统关联员工')
    expect(headers).toContain('员工关联状态')
    expect(headers).not.toContain('运单号')
    expect(headers).not.toContain('第三方订单号')
    expect(rows[0][headers.indexOf('车型')]).toBe('微面')
    expect(rows[0][headers.indexOf('下单时间')]).toBe('2026-11-09 18:30:26')
    expect(rows[0][headers.indexOf('运输费用（元）')]).toBe(142.64)
    expect(rows[0][headers.indexOf('已确认运输成本（元）')]).toBe(137.64)
    expect(rows[0][headers.indexOf('快递单号')]).toBe('3624071813921329726')
    expect(rows[0][headers.indexOf('付款状态')]).toBe('已付款')
    expect(rows[0][headers.indexOf('行驶路段')]).toBe(
      '武汉仓（仓储路1号） → 星河门店（沿江路18号） → 长江门店（江汉路20号）',
    )
    expect(rows[0][headers.indexOf('收货点数')]).toBe(2)
    expect(rows[0][headers.indexOf('收货方')]).toBe('星河门店\n长江门店')
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

describe('平台回单、票据和装卸货照片', () => {
  function evidence() {
    const p = platform()
    p.source.order.facts!.billUpdatedTime = '2026-11-08 16:00:00'
    p.source.order.facts!.receiptInfo = {
      type: 3,
      status: 3,
      backType: 2,
      expressNo: 'SF987654321000',
      remark: '纸质回单已寄回',
      unableToReturn: 0,
      unableReason: '',
    }
    p.source.order.facts!.receipts = [
      {
        id: 'R1',
        name: '拍照回单.jpg',
        state: 'READY',
        contentType: 'image/jpeg',
        savedAt: '2026-11-11T06:00:00Z',
      },
    ]
    p.source.order.facts!.stopPhotos = [
      {
        stopIndex: 0,
        name: '武汉仓',
        phase: '装货照片',
        vouchers: [{ id: 'P1', name: '装货.jpg', state: 'READY', contentType: 'image/jpeg' }],
      },
      {
        stopIndex: 2,
        name: '长江门店',
        phase: '卸货照片',
        vouchers: [{ id: 'P2', name: '卸货.jpg', state: 'FAILED' }],
      },
    ]
    return p
  }
  async function renderEvidence() {
    wrapper = mount(Bill, {
      props: { recordId: 'C1', platform: evidence(), confirmed: true, confirmedAmount: 137.64 },
      global: { plugins: [ElementPlus], stubs: { CostFilePreview: true } },
    })
    await flushPromises()
  }
  it('纸质回单独立展示寄回快递号，逐站显示照片和失败重试状态，金额及账单只读', async () => {
    await renderEvidence()
    const text = wrapper!.text()
    for (const value of [
      '纸质回单',
      '已确认',
      '快递寄回',
      '回单寄回快递单号',
      'SF987654321000',
      '纸质回单已寄回',
      '2026-11-08 16:00:00',
      '第1站 武汉仓 · 装货照片',
      '第3站 长江门店 · 卸货照片',
      '获取失败，将自动重试',
    ])
      expect(text).toContain(value)
    expect(wrapper!.findAll('input, textarea, select')).toHaveLength(0)
    expect(wrapper!.findAll('.bill-totals strong').map((n) => n.text())).toEqual([
      '142.64',
      '142.64',
      '0.00',
      '0.00',
    ])
    expect(wrapper!.findAll('button').filter((b) => b.text() === '下载')).toHaveLength(2)
  })
  it('照片查看与下载分别请求鉴权地址，下载不直接使用货拉拉源地址', async () => {
    api.getVoucher.mockResolvedValue({
      url: 'https://our-private-cos.example/temporary-signed-url',
    })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await renderEvidence()
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === '查看')!
      .trigger('click')
    await flushPromises()
    expect(api.getVoucher).toHaveBeenLastCalledWith('C1', 'R1')
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === '下载')!
      .trigger('click')
    await flushPromises()
    expect(api.getVoucher).toHaveBeenLastCalledWith('C1', 'R1', true)
    expect(click).toHaveBeenCalledTimes(1)
    expect(document.querySelector('a[download]')).toBeNull()
    click.mockRestore()
  })
  it('保留无法寄回原因，未知状态不伪装已确认', async () => {
    const p = evidence()
    Object.assign(p.source.order.facts!.receiptInfo!, {
      status: 99,
      unableToReturn: 1,
      unableReason: '收货方未提供纸质单据',
    })
    wrapper = mount(Bill, {
      props: { recordId: 'C1', platform: p, confirmed: false },
      global: { plugins: [ElementPlus], stubs: { CostFilePreview: true } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('未知（99）')
    expect(wrapper.text()).toContain('收货方未提供纸质单据')
  })
})
