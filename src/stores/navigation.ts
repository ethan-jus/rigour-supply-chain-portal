import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/api'
import type { NavigationNode } from '@/types/management'
import { validateNavigation } from '@/utils/route-registry'

/** 数据库驱动导航；routeKey只映射前端已注册路由，不创建任意组件。 */
export const useNavigationStore = defineStore('navigation', () => {
  const navigationByApplication = ref<Record<string, NavigationNode[]>>({})
  const loadedApplications = ref<string[]>([])

  async function fetchNavigation(applicationCode: string): Promise<NavigationNode[]> {
    const response = (await apiClient.get(`/portal/navigation/${encodeURIComponent(applicationCode)}`)) as NavigationNode[]
    const nodes = validateNavigation(response)
    navigationByApplication.value[applicationCode] = nodes
    if (!loadedApplications.value.includes(applicationCode)) loadedApplications.value.push(applicationCode)
    return nodes
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
