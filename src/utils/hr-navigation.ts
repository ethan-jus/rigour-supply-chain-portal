import type { NavigationNode } from '@/types/management'
import { businessNavigationName } from './business-page-labels'

const sections = [
  {
    title: '员工与组织',
    paths: ['employees', 'departments', 'positions', 'assignments', 'city-managers'],
  },
  { title: '考勤管理', paths: ['attendance', 'attendance-rules'] },
  {
    title: '薪酬与绩效',
    paths: [
      'payroll',
      'performance-rules',
      'target-settings',
      'commission-rules',
      'allowance-rules',
    ],
  },
  { title: '员工报销', paths: ['expenses'] },
]

/** 只重排 IAM 已授权且可见的入口，不创建菜单或扩大权限。 */
export function hrNavigationSections(nodes: NavigationNode[]) {
  const entries: NavigationNode[] = []
  function visit(branch: NavigationNode[]) {
    for (const node of branch) {
      if (!node.visible) continue
      if (node.routePath) entries.push(node)
      visit(node.children)
    }
  }
  visit(nodes)
  const used = new Set<string>()
  const result: { title: string; nodes: NavigationNode[] }[] = sections.map((section) => ({
    title: section.title,
    nodes: section.paths.flatMap((path) => {
      const node = entries.find((entry) => entry.routePath === `/supply-chain/hr/${path}`)
      if (!node) return []
      used.add(node.id)
      return [{ ...node, displayName: businessNavigationName(node), children: [] }]
    }),
  }))
  const extra = entries.filter(
    (node) => !used.has(node.id) && node.routePath !== '/supply-chain/hr/payroll-schemes',
  )
  if (extra.length) result.push({ title: '其他人事功能', nodes: extra })
  return result.filter((section) => section.nodes.length)
}
