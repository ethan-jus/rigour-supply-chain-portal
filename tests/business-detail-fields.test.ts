import { describe, expect, it, vi } from 'vitest'
import {
  displayAmount,
  displayValue,
  displayRecordDateTime,
  displayRecordActor,
} from '@/utils/business-display'
import { costExportFields, costSnapshotFields } from '@/views/supply-chain/cost/cost-audit'
import type { CostRecord } from '@/api/core/cost'

vi.mock('@/utils/business-dictionary', () => ({
  businessDictionaryLabel: (_module: string, _code: string, value: string) => value || '-',
}))

describe('业务只读字段展示', () => {
  it('空值使用短横线，真实零值、false 和前导零编号保留', () => {
    expect([null, undefined, '', '  '].map(displayValue)).toEqual(['-', '-', '-', '-'])
    expect([0, false, '000123'].map(displayValue)).toEqual(['0', 'false', '000123'])
    expect(displayAmount(null)).toBe('-')
    expect(displayAmount(0)).toBe('0.00')
    expect(displayValue('—')).toBe('-')
    expect(displayRecordDateTime(null)).toBe('-')
    expect(displayRecordActor('')).toBe('-')
  })
  it('外部凭据、系统单据和租赁日期均保留独立字段', () => {
    const fields = costSnapshotFields({
      data: {
        amount: null,
        rental: { leaseFrom: '2026-10-01', leaseTo: '2027-09-30' },
        logistics: {
          externalDocuments: [
            {
              sourceSystem: 'DHB',
              documentNo: '00012',
              documentDate: '2026-10-01',
              senderName: '供应商甲',
              receiverName: '中心仓',
              linkedId: null,
            },
          ],
        },
      },
      sources: [
        {
          sourceSystem: 'DHB',
          originalNo: '00034',
          documentNo: 'SYS-34',
          senderName: '供应商乙',
          receiverName: '城市仓',
        },
      ],
    })
    expect(fields).toEqual(
      expect.arrayContaining([
        { label: '外部单据 1 单号', value: '00012' },
        { label: '外部单据 1 日期', value: '2026-10-01' },
        { label: '外部单据 1 发货方', value: '供应商甲' },
        { label: '外部单据 1 收货方', value: '中心仓' },
        { label: '关联系统单据 1 原始单号', value: '00034' },
        { label: '关联系统单据 1 本系统单号', value: 'SYS-34' },
        { label: '租赁开始日期', value: '2026-10-01' },
        { label: '租赁结束日期', value: '2027-09-30' },
        { label: '金额', value: '-' },
      ]),
    )
    expect(fields.some((field) => field.label === '关联系统单据' || field.label === '租期')).toBe(
      false,
    )
  })
  it('活动日期在详情拆分，既有导出期间仍保留完整值', () => {
    const row = {
      data: { amount: 0, marketing: { serviceFrom: '2026-10-01', serviceTo: '2026-10-31' } },
      sources: [],
    } as unknown as CostRecord
    expect(costSnapshotFields(row)).toEqual(
      expect.arrayContaining([
        { label: '活动服务开始日期', value: '2026-10-01' },
        { label: '活动服务结束日期', value: '2026-10-31' },
        { label: '金额', value: '0.00' },
      ]),
    )
    expect(costExportFields(row)).toContainEqual({
      label: '活动服务期间',
      value: '2026-10-01 至 2026-10-31',
    })
  })
})
