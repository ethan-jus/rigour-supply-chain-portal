import type { RouteRecordRaw } from 'vue-router'
import type { PermissionRoute } from '@/stores/permission'

/**
 * 递归过滤路由树，仅保留用户有权限的节点
 *
 * 策略（与导航守卫独立，导航守卫检查 meta.permission）：
 * 1. 叶节点有 meta.permission → 检查用户是否持有该权限
 * 2. 叶节点无 meta.permission → 保留（无限制页面）
 * 3. 父节点 → 递归过滤子节点；若至少一个子节点保留则保留父节点
 * 4. super_admin 或 *:*:* → 全部保留
 *
 * 职责：生成侧边菜单树，不改变 router 注册的路由。
 * 边界：不处理 addRoute，路由仍静态全量注册，403 由导航守卫拦截。
 */
export function filterAsyncRoutes(
  routes: Readonly<RouteRecordRaw[]>,
  permissions: string[],
): PermissionRoute[] {
  const isAdmin = permissions.includes('*:*:*')

  function filter(routes: Readonly<RouteRecordRaw[]>): PermissionRoute[] {
    const result: PermissionRoute[] = []

    for (const route of routes) {
      const meta = route.meta as Record<string, unknown> | undefined

      if (route.children && route.children.length > 0) {
        // 父路由：递归过滤子路由
        const filteredChildren = filter(route.children)
        if (filteredChildren.length > 0) {
          result.push({
            path: route.path,
            meta: route.meta,
            children: filteredChildren,
          })
        }
      } else {
        // 叶节点
        const required = meta?.permission as string | undefined
        if (!required || isAdmin || permissions.includes(required)) {
          result.push({
            path: route.path,
            meta: route.meta,
          })
        }
      }
    }

    return result
  }

  return filter(routes)
}
