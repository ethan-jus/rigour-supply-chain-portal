import type { Router } from 'vue-router'
import { useApplicationStore, useAuthStore, useNavigationStore } from '@/stores'

interface ApiFailure {
  code?: string
  response?: { status?: number }
}

function isApiFailure(error: unknown, status: number, code: string): boolean {
  if (!error || typeof error !== 'object') return false
  const failure = error as ApiFailure
  return failure.code === code || failure.response?.status === status
}

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
        authStore.clearLocalSession()
        next({ path: '/login', query: { redirect: to.fullPath } })
        return
      }
    }

    const applicationCode = to.meta?.applicationCode as string | undefined
    if (applicationCode) {
      const applicationStore = useApplicationStore()
      try {
        if (!applicationStore.loaded) await applicationStore.fetchApplications()
      } catch (error) {
        if (isApiFailure(error, 401, 'IAM_UNAUTHORIZED')) {
          authStore.clearLocalSession()
          next({ path: '/login', query: { redirect: to.fullPath } })
          return
        }
        next({ path: '/apps', query: { launchError: 'applications-unavailable' } })
        return
      }
      if (!applicationStore.applications.some((application) => application.code === applicationCode)) {
        next({ path: '/403' })
        return
      }
      const navigationStore = useNavigationStore()
      try {
        if (!navigationStore.isLoaded(applicationCode)) await navigationStore.fetchNavigation(applicationCode)
      } catch (error) {
        if (isApiFailure(error, 403, 'IAM_FORBIDDEN')) {
          next({ path: '/403' })
          return
        }
        next({ path: '/apps', query: { launchError: 'navigation-unavailable' } })
        return
      }
      if (!navigationStore.hasPath(applicationCode, to.path)) {
        next({ path: '/403' })
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
