import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import View from '@/views/supply-chain/cost/LogisticsTransportRecordsView.vue'
import Bill from '@/views/supply-chain/cost/TransportPlatformBill.vue'
import Evidence from '@/views/supply-chain/cost/TransportEvidence.vue'
import PlatformDetails from '@/views/supply-chain/cost/TransportPlatformDetails.vue'
import type {
  TransportPage,
  PlatformTransport,
  ShipmentTransportSource,
} from '@/api/core/transport-records'
import type { CostRecord } from '@/api/core/cost'
import {
  transportDraft,
  amountOf,
  allocationPreview,
  receiversOf,
  vehicleOf,
  transportTimeOf,
} from '@/views/supply-chain/cost/transport-records'
import { createLedgerCommand } from '@/views/supply-chain/cost/cost-ledger'
const api = vi.hoisted(() => ({
  list: vi.fn(),
  selected: vi.fn(),
  workbook: vi.fn(),
  dictionaries: vi.fn(),
  getVoucher: vi.fn(),
  getEvidenceContent: vi.fn(),
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
  getTransportEvidenceContent: api.getEvidenceContent,
  getTransport: vi.fn(),
  saveTransport: vi.fn(),
  confirmTransport: vi.fn(),
}))
vi.mock('@/api/core/cost', () => ({
  changeCostStatus: vi.fn(),
  getCostCities: vi.fn(),
  getCostEmployees: vi.fn(),
  getCostAttachments: vi.fn().mockResolvedValue([]),
  getCostAttachmentUrl: vi.fn(),
  getTransportPdfContent: vi.fn(),
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
  statusCode: 'ACTIVE',
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
async function startExport(allFields = false) {
  await button('自定义导出').trigger('click')
  await flushPromises()
  if (allFields) await button('全选').trigger('click')
  await button('开始导出').trigger('click')
  await flushPromises()
}
describe('统一运输记录 V2.6', () => {
  it('平台账单仅展示金额和费用，凭证资料由统一凭证区域展示', async () => {
    wrapper = mount(Bill, {
      props: { recordId: 'C1', platform: platform(), confirmedAmount: 137.64 },
      global: { plugins: [ElementPlus], stubs: { CostFilePreview: true } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('账单总计')
    expect(wrapper.text()).toContain('费用明细')
    expect(wrapper.text()).not.toContain('运输回单')
    expect(wrapper.text()).not.toContain('装卸货照片')
    expect(wrapper.findAll('input')).toHaveLength(0)
  })
  it('平台业务资料保持实际来源，联系人、下单员工与本系统员工部门分别展示', async () => {
    const p = platform()
    p.source.order.facts!.mappedEmployeeCode = 'EMP1'
    Object.assign(p.source.order.raw, {
      下单联系人: '联系人小李',
      下单联系电话: '01012345678',
      支付方式: '月结账期支付',
      发票状态: '待结清',
      '可开票金额（元）': '142.64',
      '规划里程（公里）': '10.5',
      '实际行驶里程（公里）': '11.2',
      保价状态: '生效中',
      运输进度: '司机接单|2026-11-10 10:00,货物卸完|2026-11-10 11:00',
    })
    wrapper = mount(PlatformDetails, {
      props: {
        platform: p,
        employees: [
          {
            employeeCode: 'EMP1',
            employeeName: '本系统员工',
            departmentId: 1,
            departmentName: '武汉销售部',
          },
        ],
      },
      global: { plugins: [ElementPlus] },
    })
    await flushPromises()
    for (const text of [
      '联系人小李',
      '王先生',
      '本系统员工',
      '武汉销售部',
      '待结清',
      '142.64',
      '10.5',
      '11.2',
      '司机接单',
      '货物卸完',
    ])
      expect(wrapper.text()).toContain(text)
    expect(wrapper.findAll('input')).toHaveLength(0)
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('associate-employee')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('ep_id')
  })
  it('列表和导出按来源展示下单或发货时间，手工旧日期以零点显示，新增保留完整时间', async () => {
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
    expect(wrapper.text()).toContain('下单／发货时间')
    expect(wrapper.text()).toContain('2026-11-10 08:15:36')
    expect(wrapper.text()).not.toContain('2026-11-09 18:30:26')
    await startExport()
    const [, headers, rows] = api.workbook.mock.calls[0]!
    expect(rows.map((r: string[]) => r[headers.indexOf('下单／发货时间')])).toEqual([
      '2026-11-10 08:15:36',
      `${manual.data.costDate} 00:00:00`,
    ])
  })

  it('订货宝发货时间跨时区和同车多单使用同一时间，列表与导出一致', async () => {
    const r = { ...record(), id: 'DHB', data: { ...record().data, amount: null } }
    const shipment = (shipTime: string): ShipmentTransportSource => ({
      id: shipTime,
      costId: r.id,
      issue: null,
      differencePending: false,
      latest: {
        shipmentId: 'FH1',
        shipmentNo: 'FH1',
        salesOrderId: 1,
        sourceStatus: 'received',
        shipTime,
        sourceUpdatedAt: null,
        carrierCode: 'SF',
        carrierName: '顺丰',
        deliveryModeCode: 'THIRD_PARTY',
        deliveryModeName: '第三方',
        trackingNumbers: ['SF-SHIPMENT-TEST'],
        receiver: null,
        sourceFields: {},
        goods: [],
      },
    })
    const shipments = [shipment('2026-11-16T06:00:00Z'), shipment('2026-11-15T17:00:00Z')]
    expect(transportTimeOf(r, null, shipments)).toBe('2026-11-16 01:00:00')
    api.list.mockResolvedValue({
      page: { total: 1, begin: 0, step: 20, items: [r] },
      platformRecords: {},
      shipmentRecords: { DHB: shipments },
    })
    wrapper = mount(View, {
      global: { plugins: [ElementPlus], stubs: { TransportRecordEditor: true } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('2026-11-16 01:00:00')
    expect(wrapper.text()).toContain('待补金额')
    const exported = { ...r, id: 'DHB-OTHER-PAGE' }
    api.list.mockResolvedValue({
      page: { total: 1, begin: 0, step: 20, items: [exported] },
      platformRecords: {},
      shipmentRecords: {
        [exported.id]: shipments.map((s) => ({ ...s, costId: exported.id })),
      },
    })
    await startExport(true)
    const [, headers, rows] = api.workbook.mock.calls[0]!
    expect(rows[0][headers.indexOf('下单／发货时间')]).toBe('2026-11-16 01:00:00')
    expect(rows[0][headers.indexOf('物流公司')]).toBe('顺丰')
    expect(rows[0][headers.indexOf('快递单号')]).toContain('SF-SHIPMENT-TEST')
    expect(rows[0][headers.indexOf('数据来源')]).toBe('订货宝同步')
    expect(rows[0][headers.indexOf('运输费用（元）')]).toBeNull()
    expect(transportTimeOf(r, null, [shipment('')])).toBe(`${r.data.costDate} 00:00:00`)
    const unknown = { ...r, data: { ...r.data, costDate: undefined } } as unknown as CostRecord
    expect(transportTimeOf(unknown)).toBe('-')
  })

  it('重新查询回到表格首条，保留横向滚动位置', async () => {
    wrapper = mount(View, {
      global: { plugins: [ElementPlus], stubs: { TransportRecordEditor: true } },
    })
    await flushPromises()
    const scroller = wrapper.find('.el-table .el-scrollbar__wrap').element as HTMLElement
    scroller.scrollTop = 240
    scroller.scrollLeft = 120
    await wrapper.get('form[aria-label="查询条件"]').trigger('submit')
    await flushPromises()
    expect(scroller.scrollTop).toBe(0)
    expect(scroller.scrollLeft).toBe(120)
  })
  it('切换手工来源后不展示或提交货拉拉专属筛选，联系电话仍可查询', async () => {
    wrapper = mount(View, {
      global: { plugins: [ElementPlus], stubs: { TransportRecordEditor: true } },
    })
    await flushPromises()
    await wrapper.get('input[aria-label="下单员工"]').setValue('下单员工')
    const select = (placeholder: string) =>
      wrapper!
        .findAllComponents({ name: 'ElSelect' })
        .find((c) => c.props('placeholder') === placeholder)!
    select('员工关联状态').vm.$emit('update:modelValue', 'UNLINKED')
    select('本公司员工').vm.$emit('update:modelValue', 'EMP1')
    select('数据来源').vm.$emit('update:modelValue', 'MANUAL_ENTRY')
    await flushPromises()
    expect(wrapper.find('input[aria-label="下单员工"]').exists()).toBe(false)
    expect(wrapper.find('input[aria-label="联系电话"]').exists()).toBe(true)
    await wrapper.get('form[aria-label="查询条件"]').trigger('submit')
    await flushPromises()
    const query = api.list.mock.calls.at(-1)![0]
    expect(query.sourceSystem).toBe('MANUAL_ENTRY')
    expect(query.platformEmployeeName).toBeUndefined()
    expect(query.employeeRelationState).toBeUndefined()
    expect(query.mappedEmployeeCode).toBeUndefined()
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
    expect(amountOf(r, p)).toBe(137.64)
    expect(r.data.amount).toBe(137.64)
    expect(receiversOf(r, p)).toEqual(['星河门店', '长江门店'])
    const incomplete = platform()
    incomplete.source.order.facts!.stops = []
    expect(receiversOf(r, incomplete)).toEqual(['-'])
    expect(transportDraft(r, p).carrierCode).toBe('HLL')
    expect(transportDraft(r, p).amount).toBe(137.64)
  })
  it('未知金额与零金额区分，手动金额分到多单后精确守恒', () => {
    const r = record(),
      p = platform()
    p.source.order.facts!.billAmount = 142.64
    r.data.amount = null
    expect(amountOf(r, p)).toBeNull()
    expect(transportDraft(r, p).amount).toBeNull()
    r.data.amount = 0
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
      props: { recordId: 'C1', platform: platform(), confirmedAmount: 137.64 },
      global: { plugins: [ElementPlus], stubs: { CostFilePreview: true } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('本系统成本为 ¥137.64')
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
  it('货拉拉业务明细按需勾选导出，平台费用只取一次总额', async () => {
    wrapper = mount(View, {
      global: {
        plugins: [ElementPlus],
        stubs: { CostCarrierOrdersPanel: true, TransportRecordEditor: true, ElTeleport: true },
      },
    })
    await flushPromises()
    await startExport(true)
    expect(api.selected).not.toHaveBeenCalled()
    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ begin: 0, step: 200 }), true)
    const [, headers, rows] = api.workbook.mock.calls[0]!
    const settings = wrapper.findComponent({ name: 'TableColumnSettings' })
    const labels = (settings.props('columns') as { label: string }[]).map((c) => c.label)
    expect(labels).toContain('物流公司')
    expect(labels).toContain('下单／发货时间')
    expect(labels.indexOf('下单／发货时间')).toBeLessThan(labels.indexOf('行驶路段'))
    expect(labels.indexOf('运输费用（元）')).toBeLessThan(labels.indexOf('行驶路段'))
    expect(labels.indexOf('单据状态')).toBeLessThan(labels.indexOf('行驶路段'))
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
    expect(labels).not.toContain('下单员工')
    expect(headers).toContain('付款状态')
    expect(headers.length).toBeGreaterThan(15)
    expect(headers).toContain('计入运输成本（元）')
    expect(headers).not.toContain('本公司员工')
    expect(headers).not.toContain('员工关联状态')
    expect(headers).not.toContain('最近同步时间')
    expect(headers).not.toContain('运单号')
    expect(headers).not.toContain('第三方订单号')
    expect(rows[0][headers.indexOf('车型')]).toBe('微面')
    expect(rows[0][headers.indexOf('下单／发货时间')]).toBe('2026-11-09 18:30:26')
    expect(rows[0][headers.indexOf('运输费用（元）')]).toBe(137.64)
    expect(rows[0][headers.indexOf('计入运输成本（元）')]).toBe(137.64)
    expect(rows[0][headers.indexOf('快递单号')]).toBe('3624071813921329726')
    expect(rows[0][headers.indexOf('付款状态')]).toBe('已付款')
    expect(rows[0][headers.indexOf('行驶路段')]).toBe(
      '武汉仓（仓储路1号） → 星河门店（沿江路18号） → 长江门店（江汉路20号）',
    )
    expect(rows[0][headers.indexOf('收货点数')]).toBe(2)
    expect(headers).not.toContain('收货方')
  })
  it('手工物流默认只导出九项摘要，货拉拉专属字段不出现在选项或文件中', async () => {
    const manual = { ...record(), id: 'MANUAL' }
    api.list.mockResolvedValue({
      page: { total: 1, begin: 0, step: 20, items: [manual] },
      platformRecords: {},
    })
    wrapper = mount(View, {
      global: { plugins: [ElementPlus], stubs: { TransportRecordEditor: true } },
    })
    await flushPromises()
    await button('自定义导出').trigger('click')
    await flushPromises()
    const dialog = wrapper.findComponent({ name: 'CostExportDialog' })
    const optionLabels = dialog.props('columns').map((c: { label: string }) => c.label)
    expect(optionLabels).not.toEqual(expect.arrayContaining(['运输状态', '下单员工']))
    for (const label of ['运输状态', '下单员工', '员工关联状态', '最近同步时间', '本公司员工'])
      expect(optionLabels).not.toContain(label)
    expect(dialog.props('fields')).toHaveLength(9)
    await button('开始导出').trigger('click')
    await flushPromises()
    const [, headers] = api.workbook.mock.calls[0]!
    expect(headers).toEqual([
      '费用单号',
      '快递单号',
      '物流公司',
      '下单／发货时间',
      '运输费用（元）',
      '单据状态',
      '行驶路段',
      '收货点数',
      '运输类型',
    ])
  })
  it('混合勾选只提供通用业务字段，导出数据改变为非货拉拉时仍移除专属字段', async () => {
    const manual = { ...record(), id: 'MANUAL' }
    api.list.mockResolvedValue({
      page: { total: 2, begin: 0, step: 20, items: [record(), manual] },
      platformRecords: { C1: platform() },
    })
    api.selected.mockResolvedValue([
      { record: record(), platform: platform() },
      { record: manual, platform: null },
    ])
    wrapper = mount(View, {
      global: { plugins: [ElementPlus], stubs: { TransportRecordEditor: true } },
    })
    await flushPromises()
    wrapper.findComponent({ name: 'ElTable' }).vm.$emit('selection-change', [record(), manual])
    await startExport(true)
    let [, headers] = api.workbook.mock.calls[0]!
    expect(headers).not.toContain('运输状态')
    expect(headers).not.toContain('下单员工')
    api.selected.mockResolvedValue([{ record: manual, platform: null }])
    wrapper.findComponent({ name: 'ElTable' }).vm.$emit('selection-change', [record()])
    await startExport(true)
    ;[, headers] = api.workbook.mock.calls[1]!
    expect(headers).not.toContain('运输状态')
    expect(headers).not.toContain('下单员工')
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
    wrapper = mount(Evidence, {
      props: {
        row: record(),
        platform: evidence(),
        modelValue: [],
        readonly: true,
        required: false,
        disabled: false,
        embedded: true,
      },
      global: { plugins: [ElementPlus], stubs: { CostFilePreview: true } },
    })
    await flushPromises()
  }
  it('统一凭证保留纸质回单寄回快递号、逐站照片和失败重试状态，平台文件只读', async () => {
    await renderEvidence()
    const text = wrapper!.text()
    for (const value of [
      '纸质回单',
      '已确认',
      '快递寄回',
      '回单寄回快递单号',
      'SF987654321000',
      '纸质回单已寄回',
      '第1站 武汉仓',
      '第3站 长江门店',
      '获取失败，将自动重试',
    ])
      expect(text).toContain(value)
    expect(wrapper!.findAll('input, textarea, select')).toHaveLength(0)
    expect(wrapper!.findAll('button').filter((b) => b.text() === '下载')).toHaveLength(2)
  })
  it('照片下载读取本系统鉴权文件并通过本地文件链接保存，不跳转第三方地址', async () => {
    api.getVoucher.mockResolvedValue({
      url: 'https://our-private-cos.example/temporary-signed-url',
    })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    api.getEvidenceContent.mockResolvedValue(new Blob(['file']))
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:download', revokeObjectURL: vi.fn() })
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
    expect(api.getEvidenceContent).toHaveBeenLastCalledWith('C1', 'R1', true)
    expect(click).toHaveBeenCalledTimes(1)
    expect(document.querySelector('a[download]')).toBeNull()
    click.mockRestore()
    vi.unstubAllGlobals()
  })
  it('保留无法寄回原因，未知状态不伪装已确认', async () => {
    const p = evidence()
    Object.assign(p.source.order.facts!.receiptInfo!, {
      status: 99,
      unableToReturn: 1,
      unableReason: '收货方未提供纸质单据',
    })
    wrapper = mount(Evidence, {
      props: {
        row: record(),
        platform: p,
        modelValue: [],
        readonly: true,
        required: false,
        disabled: false,
        embedded: true,
      },
      global: { plugins: [ElementPlus], stubs: { CostFilePreview: true } },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('未知（99）')
    expect(wrapper.text()).toContain('收货方未提供纸质单据')
  })
})

it('待补运费的手工单编辑不将占位分摊零元当成已录入分摊', () => {
  const row = record()
  row.statusCode = 'ACTIVE'
  row.data.amount = null
  row.data.ledger!.sources = [
    {
      orderCode: 'SO1',
      orderTypeCode: 'SALES_ORDER',
      linkRoleCode: 'COST',
      allocations: [
        { feeKey: 'freight', receivingPointCode: 'TO0', cityCode: 'WH', basis: 1, amount: 0 },
      ],
    },
  ]
  expect(transportDraft(row, null).orderAllocations).toBeNull()
})
