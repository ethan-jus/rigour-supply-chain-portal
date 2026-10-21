import { describe, expect, it } from 'vitest'
import {
  commissionRows,
  newCommissionRow,
  flattenCommissionRows,
  commissionRowTotal,
} from '@/utils/payroll-commission-rows'

describe('同一商品的双角色提成标准', () => {
  it('两种提成各保留一条规则，表格合计不生成第三笔提成', () => {
    const row = newCommissionRow('A300')
    row.sales.variantIds = ['15']
    Object.assign(row.sales, { method: 'QUANTITY', unitCode: 'SET', value: 15 })
    Object.assign(row.manager, { method: 'QUANTITY', unitCode: 'SET', value: 5 })
    const rules = flattenCommissionRows([row])
    expect(rules).toHaveLength(2)
    expect(rules.map((r) => [r.recipientRole, r.value, r.variantIds])).toEqual([
      ['SALES', 15, ['15']],
      ['CITY_MANAGER', 5, ['15']],
    ])
    expect(commissionRowTotal(commissionRows(rules)[0]!)).toEqual({
      value: 20,
      method: 'QUANTITY',
      unitCode: 'SET',
    })
  })
  it('历史数据只维护一个角色时，另一角色必须补录而非自动视为零', () => {
    const row = newCommissionRow('方便面')
    row.sales.categoryIds = [1]
    row.sales.value = 4
    const restored = commissionRows([row.sales])[0]!
    expect(restored.manager.value).toBeNull()
    expect(restored.manager.excluded).toBe(false)
    expect(commissionRowTotal(restored)).toBeNull()
  })
  it('相同标识下的不同商品范围不能被合并覆盖', () => {
    const row = newCommissionRow('方便面')
    row.sales.categoryIds = [1]
    row.manager.categoryIds = [2]
    expect(commissionRows([row.sales, row.manager])).toHaveLength(2)
  })
})
