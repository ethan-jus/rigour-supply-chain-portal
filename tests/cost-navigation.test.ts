import { describe, expect, it } from 'vitest'
import type { NavigationNode } from '@/types/management'
import { costNavigationSections } from '@/utils/cost-navigation'
function node(path: string, children: NavigationNode[] = [], visible = true): NavigationNode {
  return {
    id: path,
    routePath: children.length ? null : `/supply-chain/${path}`,
    displayName: path,
    children,
    visible,
  } as NavigationNode
}
const costs = [
  'purchases',
  'losses',
  'logistics',
  'warehouse-rentals',
  'office-rentals',
  'marketing',
].map((path) => node(`cost/${path}`))
const paths = (groups: ReturnType<typeof costNavigationSections>) =>
  groups.flatMap((group) => group.nodes.map((item) => item.routePath))
describe('成本管理仅显示所属六项台账', () => {
  it('即使其他入口可见，也只展示指定六项成本功能', () => {
    const result = costNavigationSections([
      ...costs,
      node('hr/payroll'),
      node('hr/expenses'),
      node('bi/city-cost'),
      node('cost/custom'),
    ])
    expect(result.map((group) => group.title)).toEqual([
      '商品成本',
      '物流运输',
      '场地租赁',
      '营销推广',
    ])
    expect(paths(result)).toEqual(costs.map((item) => item.routePath))
  })
  it('营销角色只有营销入口，不补造人事与老板权限', () => {
    expect(paths(costNavigationSections([node('cost/marketing')]))).toEqual([
      '/supply-chain/cost/marketing',
    ])
  })
  it('仅有人事入口时不产生任何成本菜单', () => {
    expect(costNavigationSections([node('hr/payroll'), node('hr/expenses')])).toEqual([])
  })
  it('隐藏父节点的成本功能不可见，保留已授权的嵌套成本功能', () => {
    expect(
      paths(
        costNavigationSections([
          node('hidden', [node('cost/purchases')], false),
          node('visible', [node('cost/marketing')]),
        ]),
      ),
    ).toEqual(['/supply-chain/cost/marketing'])
  })
})
