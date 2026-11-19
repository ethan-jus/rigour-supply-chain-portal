import type { SupplyMenuNode } from '@/api/core/supply-settings'

const interfaceActions = new Set([
  'order:update', 'order:warehouse:select', 'order:cancel', 'order:history:repair',
  'order:attribution:read', 'order:attribution:propose', 'order:attribution:approve',
])
export function menuKind(node: SupplyMenuNode, parent?: SupplyMenuNode) {
  if (node.type === 'MENU') return '目录'
  if (node.type === 'PAGE') return '页面'
  if (parent?.resourceCode === 'SUPPLY_CHAIN.MENU.SALES_ATTENDANCE') return 'App 权限'
  if (parent?.resourceCode === 'SUPPLY_CHAIN.MENU.SALES_ORGANIZATION' ||
      interfaceActions.has(node.permissionCode || '')) return '接口权限'
  if (parent?.type === 'MENU') return '共享权限'
  if (node.permissionCode?.endsWith(':read')) return '查看权限'
  return '按钮'
}
