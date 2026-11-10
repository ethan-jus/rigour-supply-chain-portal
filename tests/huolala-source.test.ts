import { describe, expect, it } from 'vitest'
import {
  canGenerateSource,
  verifiedSourceAmount,
  sourceReceiverHints,
  deliveryAddressesDiffer,
  platformPaymentStatus,
  type ImportRow,
} from '@/views/supply-chain/cost/huolala-source'
const row = (): ImportRow => ({
  id: 'R1',
  revision: 1,
  state: 'UNMATCHED',
  costId: null,
  fileName: '货拉拉.xlsx',
  order: {
    enterpriseId: '',
    orderNo: '3624071813921329726',
    status: '已完成',
    useTime: '2026-11-08 10:00:00',
    paidAmount: 40.5,
    raw: {},
    salesOrderNos: [],
    line: 2,
  },
})
describe('货拉拉来源金额和生成门槛', () => {
  it('企业付款进度取平台金额，与运送完成及成本确认独立，缺失和退款不猜测状态', () => {
    const r = row()
    r.order.facts = {
      connectorId: 'C1',
      sourceEmployeeName: null,
      mappedEmployeeCode: null,
      billAmount: '40.50',
      unpaidAmount: 0,
      refundAmount: 0,
      couponAmount: 0,
      billState: 'FINAL',
      issue: null,
      stops: [],
      fees: [],
    }
    expect(platformPaymentStatus(r.order)).toBe('已付款')
    r.order.status = '运送中'
    expect(platformPaymentStatus(r.order)).toBe('已付款')
    r.order.paidAmount = 10
    r.order.facts.unpaidAmount = '30.50'
    expect(platformPaymentStatus(r.order)).toBe('部分付款')
    r.order.paidAmount = 0
    r.order.facts.unpaidAmount = '40.50'
    expect(platformPaymentStatus(r.order)).toBe('未付款')
    r.order.facts.unpaidAmount = null
    expect(platformPaymentStatus(r.order)).toBe('待核对')
    r.order.facts.unpaidAmount = 0
    r.order.facts.billAmount = 0
    expect(platformPaymentStatus(r.order)).toBe('无需付款')
    r.order.facts.refundAmount = 5
    expect(platformPaymentStatus(r.order)).toBe('待核对')
    r.order.facts.refundAmount = 0
    r.order.facts.billAmount = 40.5
    expect(platformPaymentStatus(r.order)).toBe('待核对')
    r.order.paidAmount = -1
    expect(platformPaymentStatus(r.order)).toBe('待核对')
    r.order.paidAmount = 40.5
    r.order.facts.unpaidAmount = Number.NaN
    expect(platformPaymentStatus(r.order)).toBe('待核对')
  })
  it('接口来源的多收货点用于候选推荐，不依赖Excel原始字段', () => {
    const r = row()
    r.order.facts = {
      connectorId: 'C1',
      sourceEmployeeName: null,
      mappedEmployeeCode: null,
      billAmount: 40.5,
      unpaidAmount: 0,
      refundAmount: 0,
      couponAmount: 0,
      billState: 'FINAL',
      issue: null,
      fees: [],
      stops: [
        { name: '武汉仓', address: '发货路1号', contactName: '仓管', contactPhone: '13800000000' },
        {
          name: '星河门店',
          address: '收货路2号',
          contactName: '张三',
          contactPhone: '13900000000',
        },
        {
          name: '另一门店',
          address: '收货路3号',
          contactName: '李四',
          contactPhone: '13700000000',
        },
      ],
    }
    const hint = sourceReceiverHints(r)
    expect(hint).toContain('收货路2号')
    expect(hint).toContain('另一门店')
    expect(hint).not.toContain('发货路1号')
    expect(deliveryAddressesDiffer(r, ['收货路2号', '收货路3号'])).toBe(false)
    expect(deliveryAddressesDiffer(r, ['收货路2号'])).toBe(true)
    expect(deliveryAddressesDiffer(r, [])).toBe(false)
  })

  it('未核对的月结报表不能把实付零元当作成本', () => {
    const r = row()
    r.order.raw['支付方式'] = '月结账期支付'
    r.order.paidAmount = 0
    expect(canGenerateSource(r)).toBe(false)
    expect(verifiedSourceAmount(r)).toBeNull()
    r.verification = { amount: '40.50', reason: '根据最终月结账单核对' }
    expect(canGenerateSource(r)).toBe(true)
    expect(verifiedSourceAmount(r)).toBe('40.50')
  })
  it('已核对的零元有效，来源变化后仍禁止生成', () => {
    const r = row()
    r.verification = { amount: 0, reason: '该笔已退款，全额核对为零' }
    expect(canGenerateSource(r)).toBe(true)
    expect(verifiedSourceAmount(r)).toBe(0)
    r.sourceDifference = true
    expect(canGenerateSource(r)).toBe(false)
  })
  it('取消及未知金额不能未经核对生成，普通完单可关联', () => {
    const r = row()
    expect(canGenerateSource(r)).toBe(true)
    r.order.status = '已取消'
    expect(canGenerateSource(r)).toBe(false)
    expect(verifiedSourceAmount(r)).toBeNull()
    r.order.status = '已完成'
    r.order.paidAmount = null
    expect(canGenerateSource(r)).toBe(false)
  })
})
