import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/api'
import type { NavigationNode } from '@/types/management'
import { validateNavigation } from '@/utils/route-registry'
import { devInfo, devWarn } from '@/utils/dev-log'

/** 数据库驱动导航；routeKey只映射前端已注册路由，不创建任意组件。 */
export const useNavigationStore = defineStore('navigation', () => {
  /** IAM迁移尚未刷新或浏览器保留旧菜单缓存时，保证已发布的菜单文案即时生效。 */
  const DISPLAY_NAME_OVERRIDES: Record<string, string> = {
    'supply.order.stock-up': '出库/发货',
    'supply.order.shipments': '物流跟踪',
    'supply.order.settlement.menu': '订单结算管理',
    'supply.order.settlement.collections': '收付记录',
    'supply.order.settlement.receipts': '收款单',
    'supply.order.settlement.payments': '付款单',
    'supply.order.settlement.reconciliation': '财务对账',
    'supply.order.settlement.differences': '对账差异',
  }
  const navigationByApplication = ref<Record<string, NavigationNode[]>>({})
  const loadedApplications = ref<string[]>([])

  async function fetchNavigation(applicationCode: string): Promise<NavigationNode[]> {
    devInfo('开始加载应用菜单', { applicationCode })
    try {
      const response = (await apiClient.get(`/portal/navigation/${encodeURIComponent(applicationCode)}`)) as NavigationNode[]
      const nodes = applyDisplayNameOverrides(validateNavigation(response))
      navigationByApplication.value[applicationCode] = nodes
      if (!loadedApplications.value.includes(applicationCode)) loadedApplications.value.push(applicationCode)
      devInfo('应用菜单加载成功', { applicationCode, rootCount: nodes.length })
      return nodes
    } catch (error) {
      devWarn('应用菜单加载失败', {
        applicationCode,
        code: typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: string }).code : undefined,
        status: typeof error === 'object' && error !== null && 'response' in error
          ? (error as { response?: { status?: number } }).response?.status : undefined,
      })
      throw error
    }
  }
  function applyDisplayNameOverrides(nodes: NavigationNode[]): NavigationNode[] {
    return nodes.map((node) => ({
      ...node,
      displayName: DISPLAY_NAME_OVERRIDES[node.routeKey] || node.displayName,
      children: applyDisplayNameOverrides(node.children),
    }))
  }
  function getNavigation(applicationCode: string): NavigationNode[] {
    return navigationByApplication.value[applicationCode] || []
  }
  function hasPath(applicationCode: string, path: string): boolean {
    const visit = (nodes: NavigationNode[]): boolean => nodes.some((node) =>
      node.routePath === path || visit(node.children))
    return visit(getNavigation(applicationCode))
  }
  function isLoaded(applicationCode: string) { return loadedApplications.value.includes(applicationCode) }
  function reset() { navigationByApplication.value = {}; loadedApplications.value = [] }
  return { navigationByApplication, loadedApplications, fetchNavigation, getNavigation, hasPath, isLoaded, reset }
})
