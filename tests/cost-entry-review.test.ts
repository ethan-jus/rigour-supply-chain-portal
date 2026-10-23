import { describe, expect, it } from 'vitest'
import { costConfirmationGaps, costSaveGaps } from '@/views/supply-chain/cost/cost-entry-review'
import type { CostCommand } from '@/api/core/cost'

const command = (overrides: Partial<CostCommand> = {}) =>
  ({
    title: '验收费用',
    cityCode: '4201',
    cityName: '武汉市',
    costDate: '2026-10-21',
    amount: 10,
    ...overrides,
  }) as CostCommand
describe('cost business entry validation', () => {
  it('shows travel dates, goods details and freight leg before confirmation', () => {
    const data = command({
      typeCode: 'TRAVEL',
      ownerEmployeeCode: 'staff',
      expense: { purpose: '门店巡检', costCategory: 'expense' },
    })
    expect(costConfirmationGaps('expenses', data)).toEqual([
      '开始日期',
      '结束日期',
      '出发地',
      '目的地 / 住宿地点',
    ])
    data.typeCode = 'ACCOMMODATION'
    expect(costConfirmationGaps('expenses', data)).not.toContain('出发地')
    data.typeCode = 'OFFICE_SUPPLIES'
    expect(costConfirmationGaps('expenses', data)).toEqual(['物品或服务', '单位', '物品数量'])
    data.typeCode = 'FREIGHT'
    data.expense!.costCategory = 'freight'
    expect(costConfirmationGaps('expenses', data)).toEqual(['运输环节'])
  })
  it('快递寄送必填项在保存时逐项提示，完整录入后可提交', () => {
    const data = command({
      typeCode: 'COURIER',
      ownerEmployeeCode: 'E1',
      paymentStatusCode: 'UNPAID',
      expense: { costCategory: 'expense', purpose: '寄送合作合同' },
    })
    expect(costSaveGaps('expenses', data)).toEqual([
      '寄送内容',
      '收件客户 / 合作方',
      '快递公司',
      '运单号',
    ])
    data.expense!.courier = {
      contents: '合作合同',
      recipientName: '客户甲',
      companyName: '顺丰速运',
      trackingNo: 'SF00001234',
    }
    expect(costSaveGaps('expenses', data)).toEqual([])
    data.expense!.courier.trackingNo = '  '
    expect(costConfirmationGaps('expenses', data)).toEqual(['运单号'])
  })
  it('flags missing delivery addresses before the backend rejects confirmation', () => {
    const data = command({
      logistics: {
        legCode: 'DELIVERY',
        carrierName: '配送公司',
        payerCode: 'COMPANY',
        entryMode: 'NONE',
        noSourceReason: '临时配送',
        sourceIds: [],
      } as unknown as CostCommand['logistics'],
    })
    expect(costConfirmationGaps('logistics', data)).toEqual(['客户收货地址'])
    data.logistics!.destinationAddress = '门店收货区'
    expect(costConfirmationGaps('logistics', data)).toEqual([])
  })
  it('reports fields from the actual business form without requiring a purchaser employee', () => {
    const gaps = costSaveGaps('purchases', command({ cityCode: '', costDate: '', goods: null }))
    expect(gaps).toEqual(['费用归属', '进货日期', '商品', '单位', '进货单价'])
    expect(costSaveGaps('expenses', command())).toEqual([
      '报销类型',
      '报销员工',
      '费用用途 / 出差事由',
      '付款状态',
    ])
  })
  it('requires a reason for a discounted purchase', () => {
    const data = command({
      goods: {
        productName: '商品',
        unit: '件',
        quantity: 2,
        unitPrice: 10,
        supplierName: '供应商',
      } as CostCommand['goods'],
    })
    expect(costConfirmationGaps('purchases', data)).toEqual(['金额差异说明'])
    data.goods!.amountReason = '采购折扣'
    expect(costConfirmationGaps('purchases', data)).toEqual([])
    data.amount = null
    expect(costConfirmationGaps('purchases', data)).toEqual(['费用金额'])
  })
})
