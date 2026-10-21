import type { NavigationNode } from '@/types/management'

const sections = [
  { title: '工资与人员', paths: ['payroll', 'employees'] },
  {
    title: '独立规则配置',
    paths: [
      'attendance-rules',
      'performance-rules',
      'target-settings',
      'commission-rules',
      'allowance-rules',
    ],
  },
  { title: '任职与来源', paths: ['city-managers', 'attendance'] },
  { title: '基础人事', paths: ['departments', 'assignments', 'positions', 'expenses'] },
]
const labels: Record<string, string> = {
  'performance-rules': '绩效规则设置',
  'commission-rules': '提成设置',
  'allowance-rules': '补贴及其他薪资设置',
}

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
      return [{ ...node, displayName: labels[path] || node.displayName, children: [] }]
    }),
  }))
  const extra = entries.filter(
    (node) => !used.has(node.id) && node.routePath !== '/supply-chain/hr/payroll-schemes',
  )
  if (extra.length) result.push({ title: '其他人事功能', nodes: extra })
  return result.filter((section) => section.nodes.length)
}
