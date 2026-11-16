import { describe, expect, it } from 'vitest'
import {
  allocationError,
  transportAllocations,
  savedTransportAllocations,
} from '@/views/supply-chain/cost/transport-allocation'
import type { CostSource } from '@/api/core/cost'
import type { TransportDetail } from '@/api/core/transport-records'
const sources = [
  { documentNo: 'S1', sourceType: 'SALES_ORDER', documentAmount: 6000 },
  { documentNo: 'S2', sourceType: 'SALES_ORDER', documentAmount: 4000 },
] as CostSource[]

describe('统一运输分摊', () => {
  it('137.64按6000/4000计算，尾差按最大余数补齐，选择顺序不改变金额', () => {
    expect(transportAllocations(137.64, ['S2', 'S1'], sources)).toEqual([
      { code: 'S1', amount: 82.58 },
      { code: 'S2', amount: 55.06 },
    ])
  })
  it('缺少销售金额采用均分，来源金额保持未知；未知运费不能变为0', () => {
    const incomplete = [{ ...sources[0]!, documentAmount: null }, sources[1]!]
    expect(transportAllocations(100.01, ['S2', 'S1'], incomplete)).toEqual([
      { code: 'S1', amount: 50.01 },
      { code: 'S2', amount: 50 },
    ])
    expect(transportAllocations(null, ['S1', 'S2'], sources).map((s) => s.amount)).toEqual([
      null,
      null,
    ])
    expect(transportAllocations(0, ['S1', 'S2'], sources).map((s) => s.amount)).toEqual([0, 0])
  })
  it('保留业务填写金额，不重新均分；不平、漏单、负数、三位小数均不允许保存', () => {
    const manual = { S1: 80, S2: 57.64 }
    expect(transportAllocations(137.64, ['S1', 'S2'], sources, manual)).toEqual([
      { code: 'S1', amount: 80 },
      { code: 'S2', amount: 57.64 },
    ])
    expect(allocationError(137.64, ['S1', 'S2'], manual)).toBe('')
    const invalidShares: Record<string, number | null>[] = [
      { S1: 80, S2: 57.63 },
      { S1: 80 },
      { S1: -1, S2: 138.64 },
      { S1: 80.001, S2: 57.639 },
      { S1: null, S2: 137.64 },
    ]
    for (const invalid of invalidShares)
      expect(allocationError(137.64, ['S1', 'S2'], invalid)).not.toBe('')
  })
  it('待确认货拉拉分摊在销售摘要可读，已确认则始终读冻结金额', () => {
    const detail = {
      record: {
        statusCode: 'DRAFT',
        data: {
          amount: 137.64,
          ledger: {
            sources: [{ orderCode: 'S1', linkRoleCode: 'COST', allocations: [{ amount: 82.58 }] }],
          },
        },
      },
      platform: {
        source: { order: { facts: { billAmount: 137.64 } } },
        draft: { orderCodes: ['S1', 'S2'], orderAllocations: { S1: 80, S2: 57.64 } },
      },
    } as unknown as TransportDetail
    expect(savedTransportAllocations(detail, sources)[0]!.amount).toBe(80)
    detail.record.statusCode = 'CONFIRMED'
    detail.platform!.source.order.facts!.billAmount = 142.64
    expect(savedTransportAllocations(detail, sources)[0]!.amount).toBe(82.58)
  })
  it('平台金额变化后不静默重算人工分摊，也不把分摊异常显示为0', () => {
    const detail = {
      record: { statusCode: 'DRAFT', data: {} },
      platform: {
        source: { order: { facts: { billAmount: 142.64 } } },
        draft: { orderCodes: ['S1', 'S2'], orderAllocations: { S1: 80, S2: 57.64 } },
      },
    } as unknown as TransportDetail
    expect(savedTransportAllocations(detail, sources).map((s) => s.amount)).toEqual([null, null])
  })
})
