import { describe, expect, it } from 'vitest'
import {
  createLedgerCommand,
  newParty,
  newWarehouseFee,
  previewWarehouseFee,
  receiverNames,
  splitMoney,
  totalFees,
  warehouseMonths,
} from '../src/views/supply-chain/cost/cost-ledger'
import type { CostRecord } from '../src/api/core/cost'

describe('精简费用台账的业务金额与收货方', () => {
  it('多个收货方完整返回名称，包含历史合运记录', () => {
    const data = createLedgerCommand(true)
    data.ledger!.receivingPoints = [
      { ...newParty(), manualName: '星河门店', partyTypeCode: 'OTHER' },
      { ...newParty(), manualName: '长江门店', partyTypeCode: 'OTHER' },
    ]
    expect(receiverNames({ data } as CostRecord)).toEqual(['星河门店', '长江门店'])
    const legacy = {
      data: {
        logistics: { deliveryStops: [{ customerName: '星河门店' }, { customerName: '长江门店' }] },
      },
      sources: [],
    } as unknown as CostRecord
    expect(receiverNames(legacy)).toEqual(['星河门店', '长江门店'])
  })
  it('一个分在一百张单上不产生负数，尾差稳定且金额守恒', () => {
    const result = splitMoney(0.01, Array(100).fill(1))
    expect(result.filter((v) => v === 0.01)).toHaveLength(1)
    expect(result[0]).toBe(0.01)
    expect(result.every((v) => v >= 0)).toBe(true)
    expect(result.reduce((a, b) => a + b, 0)).toBe(0.01)
    expect(splitMoney(280, [10, 20])).toEqual([93.33, 186.67])
    expect(splitMoney(20, [10, 20])).toEqual([6.67, 13.33])
  })
  it('半年租金与当月操作费分别归属，押金排除', () => {
    const plan = createLedgerCommand(false).warehouseLedger!
    plan.depositAmount = 10000
    const rent = {
      ...newWarehouseFee('2026-11-03'),
      feeAmount: 60000,
      allocationMethodCode: 'MONTH_EQUAL',
      serviceFrom: '2026-11-01',
      serviceTo: '2027-04-30',
    }
    previewWarehouseFee(rent)
    const assembly = { ...newWarehouseFee('2026-11-03'), feeTypeCode: 'ASSEMBLY', feeAmount: 1000 }
    previewWarehouseFee(assembly)
    plan.feeItems = [rent, assembly]
    expect(totalFees(plan.feeItems)).toBe(61000)
    expect(warehouseMonths(plan)).toEqual([
      { month: '2026-11', amount: 11000 },
      { month: '2026-12', amount: 10000 },
      { month: '2027-01', amount: 10000 },
      { month: '2027-02', amount: 10000 },
      { month: '2027-03', amount: 10000 },
      { month: '2027-04', amount: 10000 },
    ])
  })
  it('待补金额不被转换为零，并按实际服务天数覆盖闰日', () => {
    const unknown = {
      ...newWarehouseFee('2028-02-29'),
      allocationMethodCode: 'DAY_PRORATA',
      serviceFrom: '2028-02-29',
      serviceTo: '2028-03-02',
    }
    previewWarehouseFee(unknown)
    expect(unknown.monthAllocations).toEqual([
      { month: '2028-02', amount: null },
      { month: '2028-03', amount: null },
    ])
    unknown.feeAmount = 3
    previewWarehouseFee(unknown)
    expect(unknown.monthAllocations).toEqual([
      { month: '2028-02', amount: 1 },
      { month: '2028-03', amount: 2 },
    ])
  })
})
