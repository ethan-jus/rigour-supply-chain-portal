import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/api'
import type { NavigationNode } from '@/types/management'
import { validateNavigation } from '@/utils/route-registry'
import { devInfo, devWarn } from '@/utils/dev-log'
import { isCustomPage, registerCustomRoutes } from '@/utils/dynamic-pages'

function hasCustomPages(nodes: NavigationNode[]): boolean {
  return nodes.some((node) => isCustomPage(node) || hasCustomPages(node.children ?? []))
}

/** 数据库驱动导航；静态路由只走 routeKey 白名单，自定义页面只注册已编译的 src/views 组件。 */
export const useNavigationStore = defineStore('navigation', () => {
  const navigationByApplication = ref<Record<string, NavigationNode[]>>({})
  const loadedApplications = ref<string[]>([])

  /**
   * 自定义页面路由要等菜单数据返回后才存在，动态 import 避免 store ↔ router 循环依赖。
   * 注册失败只告警，不影响菜单数据本身可用。
   */
  async function registerCustomPageRoutes(applicationCode: string, nodes: NavigationNode[]): Promise<void> {
    if (!hasCustomPages(nodes)) return
    try {
      const { getScdpRouter } = await import('@/router')
      const router = getScdpRouter()
      if (!router) {
        devWarn('路由器尚未创建，跳过自定义页面路由注册', { applicationCode })
        return
      }
      registerCustomRoutes(router, nodes)
    } catch (error) {
      devWarn('自定义页面路由注册失败，已跳过', {
        applicationCode,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  async function fetchNavigation(
    applicationCode: string,
    options: { deferSessionRecovery?: boolean } = {},
  ): Promise<NavigationNode[]> {
    if (applicationCode !== 'SUPPLY_CHAIN') throw new Error('不支持的业务系统')
    devInfo('开始加载供应链菜单', { applicationCode })
    try {
      const response = (await apiClient.get('/scdp/navigation', {
        deferSessionRecovery: options.deferSessionRecovery,
      })) as NavigationNode[]
      const nodes = validateNavigation(response)
      await registerCustomPageRoutes(applicationCode, nodes)
      navigationByApplication.value[applicationCode] = nodes
      if (!loadedApplications.value.includes(applicationCode)) loadedApplications.value.push(applicationCode)
      devInfo('应用菜单加载成功', { applicationCode, rootCount: nodes.length })
      return nodes
    } catch (error) {
      const message = error instanceof Error ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String(error.message) : '未知错误'
      devWarn(`应用菜单加载失败: ${message}`, {
        applicationCode,
        code: typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: string }).code : undefined,
        status: typeof error === 'object' && error !== null && 'response' in error
          ? (error as { response?: { status?: number } }).response?.status : undefined,
        message,
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
  function invalidate(applicationCode: string) {
    delete navigationByApplication.value[applicationCode]
    loadedApplications.value = loadedApplications.value.filter(code => code !== applicationCode)
  }
  function reset() { navigationByApplication.value = {}; loadedApplications.value = [] }
  return { navigationByApplication, loadedApplications, fetchNavigation, getNavigation, hasPath, isLoaded, invalidate, reset }
})
