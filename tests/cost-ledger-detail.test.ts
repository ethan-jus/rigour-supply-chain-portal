import { describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Detail from '@/views/supply-chain/cost/CostLedgerDetail.vue'
import { createLedgerCommand, newParty } from '@/views/supply-chain/cost/cost-ledger'
import type { CostRecord } from '@/api/core/cost'

vi.mock('@/api/core/cost-ledger', () => ({ getLedgerParties: vi.fn().mockResolvedValue([]) }))
describe('运输费用详情业务阅读顺序', () => {
  it('保留原单、业务收货方和冻结人员部门，并把分摊放在路线之后', async () => {
    const data = createLedgerCommand(true)
    const plan = data.ledger!
    plan.carrierCode = 'HLL'
    const point = newParty('WH')
    point.partyTypeCode = 'CUSTOMER'
    point.pointCode = 'P1'
    point.manualName = '星河门店'
    point.address = '业务订单地址'
    plan.receivingPoints = [point]
    plan.feeItems[0]!.feeKey = 'F1'
    plan.sources = [
      {
        orderTypeCode: 'SALES_ORDER',
        orderCode: 'SO1',
        linkRoleCode: 'COST',
        employeeName: '原单业务员',
        departmentName: '原单部门',
        allocations: [
          { feeKey: 'F1', receivingPointCode: 'P1', cityCode: 'WH', amount: 35, basis: null },
        ],
      },
    ]
    const row: CostRecord = {
      id: 'C1',
      documentNo: 'CST1',
      categoryCode: 'LOGISTICS',
      statusCode: 'DRAFT',
      revision: 1,
      data,
      sources: [],
      warehouseName: null,
      ownerEmployeeName: '下单负责人',
      createdTime: '2026-11-09T00:00:00Z',
      updatedTime: '2026-11-09T00:00:00Z',
    }
    const w = mount(Detail, {
      props: { row, category: 'logistics' },
      global: {
        plugins: [ElementPlus],
        stubs: {
          CostAttachments: true,
          CostCarrierBill: { template: '<section><h3>货拉拉账单</h3></section>' },
        },
      },
    })
    await flushPromises()
    const headings = w.findAll('h3').map((h) => h.text())
    expect(headings).toContain('货拉拉账单')
    expect(headings.indexOf('货拉拉账单')).toBeLessThan(headings.indexOf('关联业务单据'))
    expect(headings.indexOf('收货信息')).toBeLessThan(headings.indexOf('人员归属与费用分摊'))
    expect(w.text()).toContain('原单业务员')
    expect(w.text()).toContain('原单部门')
    expect(w.text()).toContain('业务订单地址')
    w.unmount()
  })
})
