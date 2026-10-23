import type { ExpenseCostCategory } from '@/api/core/cost'

/** 内部归集规则；录入人员只选择业务费用类型。最终分类仍由 HR 保存接口确定。 */
export function expenseCostCategory(type: string | null | undefined): ExpenseCostCategory {
  if (
    [
      'OFFICE',
      'OFFICE_SUPPLIES',
      'CONSUMABLE',
      'CONSUMABLES',
      'FIXED_ASSET',
      'OFFICE_RENT',
      'NETWORK',
      'OFFICE_MOVE',
      'OFFICE_MOVING',
    ].includes(type || '')
  )
    return 'office'
  if (['FREIGHT', 'CARGO'].includes(type || '')) return 'freight'
  if (type === 'WAREHOUSE_RENT') return 'warehouse'
  if (type === 'MARKETING') return 'marketing'
  if (type === 'GOODS_PURCHASE') return 'purchase'
  return 'expense'
}
