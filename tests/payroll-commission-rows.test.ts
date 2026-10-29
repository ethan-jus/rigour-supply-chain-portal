import { describe, expect, it } from 'vitest'
import {
  commissionRows,
  newCommissionRow,
  flattenCommissionRows,
  commissionRowTotal,
  duplicateCommissionScope,
  groupCommissionRows,
  commissionProductRows,
} from '@/utils/payroll-commission-rows'

describe('同一商品的双角色提成标准', () => {
  it('未指定型号时规格留空；指定型号失去商品资料时不把维护名称当作真实商品字段', () => {
    const row = newCommissionRow('方便面 销售提成')
    expect(commissionProductRows(row.sales, [])).toEqual([
      {
        variantId: '',
        productName: '方便面',
        specification: null,
        categoryId: null,
        categoryName: null,
      },
    ])
    row.sales.variantIds = ['missing']
    expect(commissionProductRows(row.sales, [])).toEqual([
      {
        variantId: 'missing',
        productName: '',
        specification: null,
        categoryId: null,
        categoryName: null,
      },
    ])
  })
  it('数字规格ID回显为选择器使用的字符串，并正确配对双角色', () => {
    const row = newCommissionRow('A300')
    row.sales.variantIds = [15 as unknown as string]
    row.sales.excludedVariantIds = [16 as unknown as string]
    row.manager.variantIds = ['15']
    row.manager.excludedVariantIds = ['16']
    const restored = commissionRows([row.sales, row.manager])
    expect(restored).toHaveLength(1)
    expect(restored[0]!.sales.variantIds).toEqual(['15'])
    expect(restored[0]!.manager.excludedVariantIds).toEqual(['16'])
    expect(row.sales.variantIds).toEqual([15])
  })
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
  it('未完成的商品标准各自独立，仅显式添加的单位行跟随原草稿组', () => {
    const source = newCommissionRow('')
    const other = newCommissionRow('')
    const bed = newCommissionRow('')
    expect(groupCommissionRows([source, other, bed])).toHaveLength(3)
    expect(
      groupCommissionRows([source, other, bed], { [bed.code]: source.code }).map((group) =>
        group.map((row) => row.code),
      ),
    ).toEqual([[source.code, bed.code], [other.code]])
  })
  it('同型号按套与床分别保留；相同单位重复或改名改金额仍拦截，规格顺序不影响检查', () => {
    const set = newCommissionRow('A300/A500')
    set.sales.variantIds = ['15', '16']
    Object.assign(set.sales, { method: 'QUANTITY', unitCode: 'SET', value: 15 })
    Object.assign(set.manager, { method: 'QUANTITY', unitCode: 'SET', value: 5 })
    const bed = newCommissionRow('按床标准')
    bed.sales.variantIds = ['16', '15']
    Object.assign(bed.sales, { method: 'QUANTITY', unitCode: 'BED', value: 8 })
    Object.assign(bed.manager, { method: 'QUANTITY', unitCode: 'BED', value: 2 })
    expect(duplicateCommissionScope(commissionRows(flattenCommissionRows([set, bed])))).toBeNull()
    const saved = commissionRows(flattenCommissionRows([set, bed]))
    expect(saved).toHaveLength(2)
    expect(saved.map(commissionRowTotal)).toEqual([
      { method: 'QUANTITY', unitCode: 'SET', value: 20 },
      { method: 'QUANTITY', unitCode: 'BED', value: 10 },
    ])
    bed.name = set.name
    const another = newCommissionRow('另一组型号')
    another.sales.variantIds = ['17']
    const grouped = groupCommissionRows([set, another, bed])
    expect(grouped.map((group) => group.map((row) => row.code))).toEqual([
      [set.code, bed.code],
      [another.code],
    ])
    expect(grouped[0]!.map(commissionRowTotal)).toEqual(saved.map(commissionRowTotal))
    bed.sales.unitCode = 'SET'
    expect(duplicateCommissionScope([set, bed])).toContain('商品范围和计提单位重复')
    bed.sales.value = 15
    expect(duplicateCommissionScope([set, bed])).toContain('重复')
    bed.sales.variantIds = ['17']
    bed.manager.variantIds = ['17']
    expect(duplicateCommissionScope([set, bed])).toBeNull()
  })
})
