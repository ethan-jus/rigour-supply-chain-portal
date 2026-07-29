import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { RouteMeta } from 'vue-router'
import { asyncRoutes } from '@/router/routes'
import { filterAsyncRoutes } from '@/utils/route-filter'

/**
 * 权限路由 Store
 *
 * 职责：
 * - 存储当前用户可访问的菜单路由树（accessibleRoutes）
 * - 登录后根据 user.permissions 过滤 asyncRoutes 并初始化菜单
 * - 退出登录时清空菜单状态
 *
 * 边界：
 * - 菜单过滤与导航守卫独立：路由仍静态全量注册到 router，
 *   accessibleRoutes 仅供 AppSidebar 渲染菜单使用。
 *   无权限的 URL 直接访问由导航守卫跳转 /403。
 * - 不使用 addRoute/removeRoute，避免重复注册问题。
 *
 * 风险：
 * - 菜单过滤依赖 user.permissions 列表的准确性；
 *   若后端返回的权限标识与路由 meta.permission 不一致，菜单可能不完整。
 */

export interface PermissionRoute {
  path: string
  meta?: RouteMeta
  children?: PermissionRoute[]
}

export const usePermissionStore = defineStore('permission', () => {
  const accessibleRoutes = ref<PermissionRoute[]>([])
  const loaded = ref(false)

  /**
   * 根据用户权限初始化菜单路由
   *
   * @param permissions - 用户权限标识列表，如 ['erp:sku:list', 'order:order:list']
   *                      包含 '*:*:*' 时显示全部菜单
   */
  function initRoutes(permissions: string[]) {
    const filtered = filterAsyncRoutes(asyncRoutes, permissions)
    accessibleRoutes.value = filtered
    loaded.value = true
  }

  function reset() {
    accessibleRoutes.value = []
    loaded.value = false
  }

  return {
    accessibleRoutes,
    loaded,
    initRoutes,
    reset,
  }
})
