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
    'supply.order.menu': '订单管理',
    'supply.order.sales-orders': '销售订单',
    'supply.erp.master-data.menu': '商品中心',
    'supply.erp.master-data.products': '商品管理',
    'supply.erp.master-data.attributes.categories': '商品分类',
    'supply.erp.master-data.attributes.brands': '商品品牌',
    'supply.erp.master-data.attributes.tags': '商品标签',
    'supply.erp.inventory.menu': '库存管理',
    'supply.crm.customers.menu': '客户管理',
    'supply.crm.customers.profiles': '客户管理',
    'supply.crm.customers.shipping-addresses': '客户地址',
    'supply.crm.customers.levels-tags': '客户类型',
    'supply.crm.customers.areas': '归属地区',
    'supply.integration.menu': '外部同步',
    'supply.integration.sync-control.menu': '订货宝同步',
    'supply.integration.overview': '订货宝同步中心',
    'supply.erp.master-data.attributes.specifications': '商品规格',
    'supply.settings.numbering-dictionaries': '数据字典',
    'supply.order.shipments': '发货单',
    'supply.order.sales-payments': '销售回款',
    'supply.order.fund-documents': '客户资金流水',
    'supply.order.sales-refunds': '销售退款',
    'supply.bi.menu': '数据看板',
    'supply.bi.index': '供应链经营总览',
    'supply.bi.sales-collection': '销售与回款看板',
    'supply.bi.product-sales': '商品销售统计',
    'supply.bi.gross-profit': '销售毛利分析',
    'supply.bi.payment-risk': '回款风险看板',
    'supply.bi.city-cost': '城市成本看板',
    'supply.bi.inventory-risk': '库存风险看板',
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
