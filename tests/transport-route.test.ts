import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import type { CostRecord } from '@/api/core/cost'
import type { PlatformTransport } from '@/api/core/transport-records'
import { createLedgerCommand, newParty } from '@/views/supply-chain/cost/cost-ledger'
import { routeOf, routeText } from '@/views/supply-chain/cost/transport-records'
import TransportRouteSummary from '@/views/supply-chain/cost/TransportRouteSummary.vue'

const record = (): CostRecord => ({
  id: 'C1',
  documentNo: 'LC001',
  statusCode: 'DRAFT',
  revision: 1,
  categoryCode: 'LOGISTICS',
  data: createLedgerCommand(true),
  sources: [],
  warehouseName: null,
  ownerEmployeeName: null,
  createdTime: '',
  updatedTime: '',
})
const stop = (name: string, address = '') => ({
  name,
  address,
  contactName: '',
  contactPhone: '',
})
function platform(stops: ReturnType<typeof stop>[]): PlatformTransport {
  return {
    source: {
      id: 'P1',
      fileName: '接口',
      state: 'GENERATED',
      revision: 1,
      costId: 'C1',
      order: {
        enterpriseId: 'EP1',
        orderNo: 'HL001',
        status: '已完成',
        useTime: '2026-11-11',
        paidAmount: 0,
        raw: {},
        salesOrderNos: [],
        line: 0,
        facts: {
          connectorId: 'X1',
          sourceEmployeeName: null,
          mappedEmployeeCode: null,
          billAmount: 0,
          unpaidAmount: 0,
          refundAmount: 0,
          couponAmount: 0,
          billState: 'FINAL',
          issue: null,
          stops,
          fees: [],
        },
      },
    },
    draft: null,
    billHistory: [],
  }
}
let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('行驶路段数据口径', () => {
  it('平台按最新返回站序展示，收货点数不包含发货地且不按名称去重', () => {
    const p = platform([stop('旧发货地'), stop('旧收货地')])
    p.source.latestOrder = {
      ...p.source.order,
      facts: {
        ...p.source.order.facts!,
        stops: [stop('武汉仓'), stop('同名门店', '一号路'), stop('同名门店', '二号路')],
      },
    }
    const route = routeOf(record(), p)
    expect(route.origin?.name).toBe('武汉仓')
    expect(route.receivers).toHaveLength(2)
    expect(route.receivers.map((p) => p.address)).toEqual(['一号路', '二号路'])
    expect(routeText(route)).toBe('武汉仓 → 同名门店（一号路） → 同名门店（二号路）')
  })

  it('手工记录按已保存的发货信息和收货点顺序展示，重复停靠仍保留', () => {
    const r = record()
    r.data.ledger!.sender = { ...newParty(), displayName: '深圳仓', address: '仓储路1号' }
    r.data.ledger!.receivingPoints = [
      { ...newParty(), manualName: '星河门店', address: '星河路1号' },
      { ...newParty(), manualName: '长江门店', address: '长江路2号' },
      { ...newParty(), manualName: '星河门店', address: '星河路1号' },
    ]
    const route = routeOf(r)
    expect(route.origin).toEqual({ name: '深圳仓', address: '仓储路1号' })
    expect(route.receivers.map((p) => p.name)).toEqual(['星河门店', '长江门店', '星河门店'])
  })

  it('缺失平台路线不借用手工草稿，历史手工只有地址时仍能识别路线', () => {
    const r = record()
    r.data.logistics = {
      legCode: 'DELIVERY',
      sourceIds: [],
      voucherIds: [],
      carrierName: '顺丰',
      trackingNo: '',
      transportMethodCode: '',
      payerCode: '',
      originAddress: '发货路1号',
      destinationAddress: '收货路2号',
    }
    expect(routeText(routeOf(r))).toBe('发货路1号 → 收货路2号')
    expect(routeOf(r, platform([]))).toEqual({ origin: null, receivers: [] })
    expect(routeText(routeOf(r, platform([])))).toBe('-')
  })
})

describe('行驶路段摘要与展开', () => {
  it('多站列表仅展示起终点及中途数量，点击后可按序查看全部站点及地址', async () => {
    const route = routeOf(
      record(),
      platform([stop('武汉仓'), stop('门店一', '一号路'), stop('门店二'), stop('终点门店')]),
    )
    wrapper = mount(TransportRouteSummary, {
      props: { route },
      attachTo: document.body,
      global: { plugins: [ElementPlus] },
    })
    const summary = wrapper.find('.route-summary')
    expect(summary.text()).toContain('武汉仓')
    expect(summary.text()).toContain('终点门店')
    expect(summary.text()).toContain('2个中途收货地')
    expect(summary.text()).not.toContain('门店一')
    await summary.find('button').trigger('click')
    await flushPromises()
    const content = document.querySelector('.route-details')!
    expect(content.textContent).toContain('3个收货点')
    expect([...content.querySelectorAll('.route-details-name')].map((s) => s.textContent)).toEqual([
      '武汉仓',
      '门店一',
      '门店二',
      '终点门店',
    ])
    expect(content.textContent).toContain('一号路')
    expect(content.textContent).toContain('最终收货地')
  })

  it('单一收货地不显示中途数量，空路线以短横线展示', () => {
    wrapper = mount(TransportRouteSummary, {
      props: { route: routeOf(record(), platform([stop('发货地'), stop('收货地')])) },
      global: { plugins: [ElementPlus] },
    })
    expect(wrapper.findAll('.route-stop').map((n) => n.text())).toEqual(['发货地', '收货地'])
    expect(wrapper.find('.route-middle').exists()).toBe(false)
    wrapper.unmount()
    wrapper = mount(TransportRouteSummary, {
      props: { route: { origin: null, receivers: [] } },
      global: { plugins: [ElementPlus] },
    })
    expect(wrapper.text()).toBe('-')
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
