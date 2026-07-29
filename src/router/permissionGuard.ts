import type { Router } from 'vue-router'
import { useAuthStore } from '@/stores'

/**
 * 路由权限守卫
 *
 * 职责：
 * - 设置页面标题
 * - 未登录用户访问需认证页面 → 跳转 /login
 * - 已登录但无用户信息（页面刷新）→ 自动 fetchUser() 恢复会话
 *   fetchUser 内部调用 permissionStore.initRoutes() 重建菜单树
 * - 无权限访问 → 跳转 /403
 *
 * 架构说明：
 * - 所有路由在 router/index.ts 中静态全量注册（不使用 addRoute）
 * - 侧边菜单由 permissionStore.accessibleRoutes 控制（仅影响渲染）
 * - 导航守卫独立检查 meta.permission，即使用户直接输入 URL 也能拦截
 *
 * 边界：
 * - 不直接操作 token，通过 authStore 判定
 * - 菜单初始化由 authStore.fetchUser() 自动触发
 *
 * 风险：
 * - fetchUser 失败时 logout 并跳转登录，依赖后端 /auth/me 可用性
 */
export function setupPermissionGuard(router: Router): void {
  router.beforeEach(async (to, _from, next) => {
    const authStore = useAuthStore()

    const title = (to.meta?.title as string) || '瑞盖优选供应链运营门户'
    document.title = `${title} - 瑞盖优选`

    // 无需认证直接放行
    if (!to.meta?.requiresAuth) {
      next()
      return
    }

    // 未登录 → 登录页
    if (!authStore.isAuthenticated) {
      next({ path: '/login', query: { redirect: to.fullPath } })
      return
    }

    // 已登录但未加载用户信息 → 恢复会话（包含菜单初始化）
    if (!authStore.user) {
      try {
        await authStore.fetchUser()
        // fetchUser 成功后 permissionStore.accessibleRoutes 已填充
      } catch {
        authStore.logout()
        next({ path: '/login', query: { redirect: to.fullPath } })
        return
      }
    }

    // 权限检查 → 403
    const permission = to.meta?.permission as string | undefined
    if (permission && !authStore.hasPermission(permission)) {
      next({ path: '/403' })
      return
    }

    next()
  })
}
