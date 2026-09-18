import type { RouteComponent, RouteRecordRaw, Router } from 'vue-router'
import type { NavigationNode } from '@/types/management'
import { devInfo, devWarn } from '@/utils/dev-log'

export const CUSTOM_PAGE_ROUTE_PREFIX = '/supply-chain/'
export const CUSTOM_PAGE_PARENT_ROUTE_NAME = 'SupplyChainConsole'

type ViewLoader = () => Promise<RouteComponent>

/**
 * 自定义页面组件白名单。
 *
 * componentPath 来自数据库，只有被 Vite 编译进包的 src/views 页面才能解析成功；
 * 未命中的路径一律告警并跳过，避免一颗脏数据打断整棵菜单树或注册出任意组件。
 */
const VIEW_MODULES = import.meta.glob('../views/**/*.vue') as unknown as Record<string, ViewLoader>

/** glob key 形如 `../views/supply-chain/order/OrderListView.vue`。 */
function normalizeGlobKey(key: string): string {
  return key.replace(/^.*\/views\//, '')
}

/** 数据库/表单里的组件路径做宽容归一：允许 ./、/、src/views/ 前缀和反斜杠。 */
function normalizeComponentPath(componentPath: string): string {
  return componentPath
    .trim()
    .replace(/\\/g, '/')
    .replace(/^(\.\/)+/, '')
    .replace(/^\/+/, '')
    .replace(/^(src\/)?views\//, '')
}

const REGISTERED_VIEWS: Record<string, ViewLoader> = Object.fromEntries(
  Object.entries(VIEW_MODULES).map(([key, loader]) => [normalizeGlobKey(key), loader]),
)

/** 已编译页面组件路径列表，例如 `supply-chain/order/OrderListView.vue`。 */
export function listRegisteredViews(): string[] {
  return Object.keys(REGISTERED_VIEWS).sort()
}

/** 自定义页面节点：以 componentPath 为准，绑定已注册资源的节点该字段为空。 */
export function isCustomPage(node: Pick<NavigationNode, 'componentPath'>): boolean {
  return typeof node.componentPath === 'string' && node.componentPath.trim().length > 0
}

/** 解析数据库组件路径；解析不到返回 null，由调用方告警并跳过。 */
export function resolveView(componentPath: string | null | undefined): ViewLoader | null {
  if (typeof componentPath !== 'string') return null
  const key = normalizeComponentPath(componentPath)
  return key ? REGISTERED_VIEWS[key] ?? null : null
}

function customRouteName(nodeId: string): string {
  return 'CustomPage' + nodeId.replace(/-/g, '')
}

function collectCustomPages(nodes: NavigationNode[]): NavigationNode[] {
  return nodes.flatMap((node) => [
    ...(isCustomPage(node) ? [node] : []),
    ...collectCustomPages(node.children ?? []),
  ])
}

/**
 * 把数据库配置的自定义页面注册到 `SupplyChainConsole` 父路由下。
 *
 * - 路由名由节点 id 生成，重复加载同一份菜单时先移除旧记录，保证幂等；
 * - 路由地址、组件路径、父路由或同名/同路径冲突任一不满足时只告警并跳过，绝不抛错。
 */
export function registerCustomRoutes(router: Router, nodes: NavigationNode[]): void {
  const pages = collectCustomPages(nodes)
  if (!pages.length) return
  if (!router.hasRoute(CUSTOM_PAGE_PARENT_ROUTE_NAME)) {
    devWarn('自定义页面父路由不存在，已跳过后台配置的动态页面', {
      parent: CUSTOM_PAGE_PARENT_ROUTE_NAME,
      count: pages.length,
    })
    return
  }
  let registered = 0
  for (const node of pages) {
    const routePath = node.routePath
    const validPath = typeof routePath === 'string'
      && routePath.startsWith(CUSTOM_PAGE_ROUTE_PREFIX)
      && routePath.length > CUSTOM_PAGE_ROUTE_PREFIX.length
    if (node.type !== 'PAGE' || !validPath) {
      devWarn('忽略无效的自定义页面菜单节点', {
        id: node.id,
        type: node.type,
        routePath,
        componentPath: node.componentPath,
      })
      continue
    }
    const loader = resolveView(node.componentPath)
    if (!loader) {
      devWarn('自定义页面组件未编译，已跳过该菜单节点', {
        id: node.id,
        displayName: node.displayName,
        componentPath: node.componentPath,
      })
      continue
    }
    const name = customRouteName(node.id)
    const conflict = router.getRoutes().find((record) => record.path === routePath && record.name !== name)
    if (conflict) {
      devWarn('自定义页面路由地址与现有路由冲突，已跳过该菜单节点', {
        id: node.id,
        routePath,
        conflict: String(conflict.name ?? conflict.path),
      })
      continue
    }
    try {
      if (router.hasRoute(name)) router.removeRoute(name)
      router.addRoute(CUSTOM_PAGE_PARENT_ROUTE_NAME, {
        path: routePath.slice(CUSTOM_PAGE_ROUTE_PREFIX.length),
        name,
        component: loader,
        meta: {
          title: node.displayName,
          requiresAuth: true,
          applicationCode: 'SUPPLY_CHAIN',
          routeKey: node.routeKey,
          permission: node.permissionCode ?? undefined,
        },
      } satisfies RouteRecordRaw)
      registered += 1
    } catch (error) {
      devWarn('自定义页面路由注册失败，已跳过该菜单节点', {
        id: node.id,
        routePath,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }
  devInfo('自定义页面路由注册完成', { registered, total: pages.length })
}
