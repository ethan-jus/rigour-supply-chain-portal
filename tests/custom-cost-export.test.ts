import { describe, expect, it, vi } from 'vitest'
import {
  collectCostExportRows,
  selectedCostColumns,
} from '@/views/supply-chain/cost/custom-cost-export'

describe('成本自定义导出范围与数据完整性', () => {
  const rows = Array.from({ length: 230 }, (_, i) => ({ id: `C${i}`, amount: i === 0 ? null : 0 }))
  const fetchPage = async (begin: number, step: number) => ({
    total: rows.length,
    items: rows.slice(begin, begin + step),
  })
  it('未选择导出跨页全部，勾选只返回指定记录并保留0与空金额', async () => {
    expect(
      await collectCostExportRows({ fetchPage, key: (r) => r.id, current: () => true }),
    ).toEqual(rows)
    const selected = await collectCostExportRows({
      fetchPage,
      key: (r) => r.id,
      selected: ['C220', 'C0'],
      current: () => true,
    })
    expect(selected).toEqual([rows[220], rows[0]])
    expect(selected![0]!.amount).toBe(0)
    expect(selected![1]!.amount).toBeNull()
  })
  it('所选记录不在授权筛选结果时拒绝导出，不回退全部', async () => {
    await expect(
      collectCostExportRows({
        fetchPage,
        key: (r) => r.id,
        selected: ['DELETED'],
        current: () => true,
      }),
    ).rejects.toThrow('所选记录已变化')
  })
  it('跨页重复、总数变化及不完整页均拒绝生成文件', async () => {
    const duplicate = vi
      .fn()
      .mockResolvedValueOnce({ total: 2, items: [rows[0]] })
      .mockResolvedValueOnce({ total: 2, items: [rows[0]] })
    await expect(
      collectCostExportRows({
        fetchPage: duplicate,
        key: (r: (typeof rows)[number]) => r.id,
        current: () => true,
      }),
    ).rejects.toThrow('数据已变化')
    const changed = vi
      .fn()
      .mockResolvedValueOnce({ total: 2, items: [rows[0]] })
      .mockResolvedValueOnce({ total: 3, items: [rows[1]] })
    await expect(
      collectCostExportRows({
        fetchPage: changed,
        key: (r: (typeof rows)[number]) => r.id,
        current: () => true,
      }),
    ).rejects.toThrow('数据已变化')
    await expect(
      collectCostExportRows({
        fetchPage: async () => ({ total: 1, items: [] as typeof rows }),
        key: (r) => r.id,
        current: () => true,
      }),
    ).rejects.toThrow('不完整')
  })
  it('旧页面返回的数据不用于新范围的文件，字段按业务顺序且不能全空', async () => {
    expect(
      await collectCostExportRows({ fetchPage, key: (r) => r.id, current: () => false }),
    ).toBeNull()
    const columns = [
      { key: 'code', label: '单号' },
      { key: 'amount', label: '金额' },
      { key: 'date', label: '日期' },
    ]
    expect(selectedCostColumns(columns, ['date', 'amount', 'internalId'])).toEqual([
      columns[1],
      columns[2],
    ])
    expect(() => selectedCostColumns(columns, [])).toThrow('至少选择')
  })
})
