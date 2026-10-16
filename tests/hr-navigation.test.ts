import { describe, expect, it } from 'vitest'
import type { NavigationNode } from '@/types/management'
import { hrNavigationSections } from '@/utils/hr-navigation'
const node = (id: string, children: NavigationNode[] = [], visible = true): NavigationNode =>
  ({
    id,
    displayName: id,
    routePath: children.length ? null : `/supply-chain/hr/${id}`,
    visible,
    children,
  }) as NavigationNode
describe('人事导航授权边界', () => {
  it('规则直接展开且只显示 IAM 提供的可见入口', () => {
    const result = hrNavigationSections([
      node('employees'),
      node('rules', [node('commission-rules'), node('performance-rules', [], false)]),
      node('payroll-schemes'),
    ])
    expect(result.flatMap((s) => s.nodes).map((n) => n.id)).toEqual([
      'employees',
      'commission-rules',
    ])
    expect(result.find((s) => s.title === '独立规则配置')?.nodes[0]?.displayName).toBe('提成设置')
  })
  it('隐藏父菜单的子节点不会泄露，保留其他授权入口', () => {
    const result = hrNavigationSections([node('hidden', [node('payroll')], false), node('custom')])
    expect(result.flatMap((s) => s.nodes).map((n) => n.id)).toEqual(['custom'])
  })
})
