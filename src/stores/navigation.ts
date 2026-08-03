import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/api'
import type { NavigationNode } from '@/types/management'
import { validateNavigation } from '@/utils/route-registry'
import { devInfo, devWarn } from '@/utils/dev-log'

/** 数据库驱动导航；routeKey只映射前端已注册路由，不创建任意组件。 */
export const useNavigationStore = defineStore('navigation', () => {
  const navigationByApplication = ref<Record<string, NavigationNode[]>>({})
  const loadedApplications = ref<string[]>([])

  async function fetchNavigation(applicationCode: string): Promise<NavigationNode[]> {
    devInfo('开始加载应用菜单', { applicationCode })
    try {
      const response = (await apiClient.get(`/portal/navigation/${encodeURIComponent(applicationCode)}`)) as NavigationNode[]
      const nodes = validateNavigation(response)
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
