import type { NavigationNode } from '@/types/management'

/** 展示名称集中维护；菜单权限、路径及业务资源仍由 IAM 提供。 */
export const businessPageLabels: Record<string, string> = {
  '/supply-chain/hr': '人事管理',
  '/supply-chain/hr/employees': '员工档案',
  '/supply-chain/hr/departments': '部门管理',
  '/supply-chain/hr/positions': '岗位管理',
  '/supply-chain/hr/assignments': '任职调动',
  '/supply-chain/hr/city-managers': '城市负责人管理',
  '/supply-chain/hr/attendance': '员工考勤确认',
  '/supply-chain/hr/attendance-rules': '考勤规则设置',
  '/supply-chain/hr/payroll': '月度薪酬核算',
  '/supply-chain/hr/performance-rules': '绩效考核规则',
  '/supply-chain/hr/commission-rules': '商品提成规则',
  '/supply-chain/hr/allowance-rules': '员工补贴规则',
  '/supply-chain/hr/target-settings': '月度经营目标',
  '/supply-chain/hr/expenses': '员工报销台账',
  '/supply-chain/cost/purchases': '商品进货记录',
  '/supply-chain/cost/losses': '商品损耗记录',
  '/supply-chain/cost/logistics': '物流运费记录',
  '/supply-chain/cost/warehouse-rentals': '仓库租赁费用',
  '/supply-chain/cost/office-rentals': '办公室租赁费用',
  '/supply-chain/cost/marketing': '营销推广费用',
}

export function businessNavigationName(node: NavigationNode): string {
  if (
    !node.routePath &&
    ['supply.hr', 'supply.hr.menu', 'supply-chain.hr', 'supply-chain.hr.menu'].includes(
      node.routeKey,
    )
  )
    return '人事管理'
  return (node.routePath && businessPageLabels[node.routePath]) || node.displayName
}
