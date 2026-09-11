import type { Router } from 'vue-router'
import { useApplicationStore, useAuthStore, useNavigationStore } from '@/stores'
import { devInfo, devWarn } from '@/utils/dev-log'

interface ApiFailure {
  code?: string
  response?: { status?: number }
}

const SESSION_INVALID_CODES = new Set(['IAM_TOKEN_INVALID', 'IAM_UNAUTHORIZED', 'IAM_INVALID_TOKEN'])

function apiFailure(error: unknown): ApiFailure | null {
  if (!error || typeof error !== 'object') return null
  return error as ApiFailure
}

function isSessionInvalidFailure(error: unknown): boolean {
  const failure = apiFailure(error)
  if (!failure) return false
  if (failure.code) return SESSION_INVALID_CODES.has(failure.code)
  return failure.response?.status === 401
}

function isForbiddenFailure(error: unknown): boolean {
  const failure = apiFailure(error)
  if (!failure) return false
  return failure.code === 'IAM_FORBIDDEN' || failure.response?.status === 403
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
 * - fetchUser明确返回Token失效marker时清除会话；服务异常进入503页面，避免误清会话或静默回门户首页
 */
export function setupPermissionGuard(router: Router): void {
  router.beforeEach(async (to, _from, next) => {
    const authStore = useAuthStore()
    const wasAuthenticated = authStore.isAuthenticated
    authStore.synchronizeTokenState()

    const title = (to.meta?.title as string) || '瑞盖优选供应链运营门户'
    document.title = `${title} - 瑞盖优选`

    // 无需认证直接放行
    if (!to.meta?.requiresAuth) {
      next()
      return
    }

    // 未登录 → 登录页
    if (!authStore.isAuthenticated) {
      devInfo('路由守卫发现未登录身份，跳转登录页', { path: to.fullPath })
      authStore.clearLocalSession()
      next({
        path: '/login',
        query: {
          redirect: to.fullPath,
          ...(wasAuthenticated ? { reason: 'session_expired' } : {}),
        },
      })
      return
    }

    // 已登录但未加载用户信息 → 恢复会话（包含菜单初始化）
    if (!authStore.user) {
      try {
        await authStore.fetchUser({ deferSessionRecovery: true })
        // fetchUser 成功后 permissionStore.accessibleRoutes 已填充
      } catch (error) {
        // 只有IAM明确Token失效marker才说明本地Token失效；服务500、超时或网络断开
        // 不应清除内存Token并把用户误导到登录页。
        if (isSessionInvalidFailure(error)) {
          devWarn('用户会话已失效，清理会话并跳转登录页', { path: to.fullPath })
          authStore.clearLocalSession()
          next({ path: '/login', query: { redirect: to.fullPath, reason: 'session_expired' } })
        } else {
          devWarn('恢复用户会话遇到服务异常，跳转503页面', { path: to.fullPath })
          next({ path: '/service-unavailable', query: { redirect: to.fullPath } })
        }
        return
      }
    }

    const applicationCode = to.meta?.applicationCode as string | undefined
    const requiredApplicationCode = to.meta?.requiredApplicationCode as string | undefined
    const entitlementApplicationCode = applicationCode || requiredApplicationCode
    if (entitlementApplicationCode) {
      const applicationStore = useApplicationStore()
      try {
        if (!applicationStore.loaded || applicationStore.applications.length === 0) {
          await applicationStore.fetchApplications({ deferSessionRecovery: true })
        }
      } catch (error) {
        if (isSessionInvalidFailure(error)) {
          devWarn('加载应用目录时身份已失效，跳转登录页', { path: to.fullPath })
          authStore.clearLocalSession()
          next({ path: '/login', query: { redirect: to.fullPath, reason: 'session_expired' } })
          return
        }
        devWarn('加载应用目录遇到服务异常，进入503页面', { path: to.fullPath })
        next({ path: '/service-unavailable', query: { redirect: to.fullPath, reason: 'applications-unavailable' } })
        return
      }
      if (!applicationStore.applications.some(
        (application) => application.code === entitlementApplicationCode,
      )) {
        next({ path: '/403' })
        return
      }
    }

    if (applicationCode) {
      const navigationStore = useNavigationStore()
      try {
        if (!navigationStore.isLoaded(applicationCode)) {
          await navigationStore.fetchNavigation(applicationCode, { deferSessionRecovery: true })
        }
      } catch (error) {
        if (isSessionInvalidFailure(error)) {
          devWarn('加载应用菜单时身份已失效，跳转登录页', { applicationCode, path: to.fullPath })
          authStore.clearLocalSession()
          next({ path: '/login', query: { redirect: to.fullPath, reason: 'session_expired' } })
          return
        }
        if (isForbiddenFailure(error)) {
          devWarn('加载应用菜单被拒绝，跳转403页面', { applicationCode, path: to.fullPath })
          next({ path: '/403' })
          return
        }
        devWarn('加载应用菜单遇到服务异常，进入503页面', { applicationCode, path: to.fullPath })
        next({ path: '/service-unavailable', query: { redirect: to.fullPath, reason: 'navigation-unavailable' } })
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
      devWarn('路由权限不足，跳转403页面', { path: to.fullPath, permission })
      next({ path: '/403' })
      return
    }

    devInfo('路由权限校验通过', { path: to.fullPath, applicationCode, requiredApplicationCode })
    next()
  })
}
