import type { Router } from 'vue-router'
import { useAuthStore, useNavigationStore } from '@/stores'
import { devInfo, devWarn } from '@/utils/dev-log'
import { supplyPageName } from '@/utils/supply-page-title'
import { useSupplyAuthorizationStore } from '@/stores/supply-authorization'
import { ensureAccessToken, TokenRefreshError } from '@/auth/oidc'

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

/** SCDP 登录与导航守卫。动态菜单名称和层级来自服务端，路径必须在已编译路由白名单内。 */
export function setupPermissionGuard(router: Router): void {
  router.beforeEach(async (to, _from, next) => {
    const authStore = useAuthStore()
    const wasAuthenticated = authStore.isAuthenticated
    authStore.synchronizeTokenState()

    const title = (to.meta?.title as string) || '瑞盖供应链数字化平台'
    document.title = title === '瑞盖供应链数字化平台' ? title : `${title} - 瑞盖供应链数字化平台`

    // 自定义页面路由由导航数据注册：刷新或直达 /supply-chain/* 时先完成鉴权与导航加载，
    // 再按路径重新解析一次；isLoaded 之后不再进入该分支，不会形成跳转循环。
    const customPageDeepLink = to.name === 'NotFound'
      && to.path.startsWith('/supply-chain/')
      && authStore.isAuthenticated

    // 无需认证直接放行
    if (!to.meta?.requiresAuth && !customPageDeepLink) {
      next()
      return
    }

    // 未登录 → 登录页
    if (authStore.isAuthenticated) {
      try {
        await ensureAccessToken()
        authStore.synchronizeTokenState()
      } catch (error) {
        if (error instanceof TokenRefreshError && error.code === 'REQUEST_CANCELLED') {
          next(false)
        } else if (isSessionInvalidFailure(error)) {
          authStore.clearLocalSession()
          next({ path: '/login', query: { reason: 'session_expired' } })
        } else {
          next({ path: '/service-unavailable', query: { redirect: to.fullPath } })
        }
        return
      }
    }

    if (!authStore.isAuthenticated) {
      devInfo('路由守卫发现未登录身份，跳转登录页', { path: to.fullPath })
      authStore.clearLocalSession()
      next({
        path: '/login',
        query: {
          ...(wasAuthenticated ? { reason: 'session_expired' } : {}),
        },
      })
      return
    }

    // 已登录但未加载用户信息 → 恢复当前租户身份
    if (!authStore.user) {
      try {
        await authStore.fetchUser({ deferSessionRecovery: true })
      } catch (error) {
        // 只有IAM明确Token失效marker才说明本地Token失效；服务500、超时或网络断开
        // 不应清除内存Token并把用户误导到登录页。
        if (isSessionInvalidFailure(error)) {
          devWarn('用户会话已失效，清理会话并跳转登录页', { path: to.fullPath })
          authStore.clearLocalSession()
          next({ path: '/login', query: { reason: 'session_expired' } })
        } else if (isForbiddenFailure(error)) {
          next({ path: '/403' })
        } else {
          devWarn('恢复用户会话遇到服务异常，跳转503页面', { path: to.fullPath })
          next({ path: '/service-unavailable', query: { redirect: to.fullPath } })
        }
        return
      }
    }

    const applicationCode = (to.meta?.applicationCode as string | undefined)
      ?? (customPageDeepLink ? 'SUPPLY_CHAIN' : undefined)
    const supplyAccess = applicationCode === 'SUPPLY_CHAIN' ? useSupplyAuthorizationStore() : null
    if (supplyAccess) {
      try {
        await supplyAccess.refresh()
      } catch (error) {
        if (isSessionInvalidFailure(error)) {
          authStore.clearLocalSession()
          next({ path: '/login', query: { reason: 'session_expired' } })
        } else {
          next({ path: isForbiddenFailure(error) ? '/403' : '/service-unavailable', query: { redirect: to.fullPath } })
        }
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
          next({ path: '/login', query: { reason: 'session_expired' } })
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
        // 未命中任何菜单/自定义页面的 /supply-chain/* 地址保持 404。
        if (customPageDeepLink) {
          next()
          return
        }
        if (to.path === '/supply-chain') {
          const firstAccessible = (nodes: ReturnType<typeof navigationStore.getNavigation>): string | undefined => {
            for (const node of nodes) {
              if (!node.visible) continue
              if (node.routePath && node.routePath !== to.path) {
                const required = router.resolve(node.routePath).meta.permission as string | undefined
                const allowed = !required || (supplyAccess?.context?.mode === 'ACTIVE' || required.startsWith('supply:')
                  ? supplyAccess?.can(required) : authStore.hasPermission(required))
                if (allowed) return node.routePath
              }
              const child = firstAccessible(node.children)
              if (child) return child
            }
          }
          const landing = firstAccessible(navigationStore.getNavigation(applicationCode))
          if (landing) { next({ path: landing, replace: true }); return }
        }
        next({ path: '/403' })
        return
      }
      if (customPageDeepLink) {
        // 路由记录已注册，按路径重新解析，命中后台配置的自定义页面组件。
        const resolved = router.resolve({ path: to.path, query: to.query, hash: to.hash })
        if (resolved.name && resolved.name !== 'NotFound') {
          next({ path: to.path, query: to.query, hash: to.hash, replace: true })
          return
        }
        // 菜单里有该地址但路由仍未命中（组件未编译或注册失败）：保持 404，避免重定向死循环。
        next()
        return
      }
    }

    // 权限检查 → 403
    const permission = to.meta?.permission as string | undefined
    const usesSupplyPermission = supplyAccess && (permission?.startsWith('supply:') || supplyAccess.context?.mode === 'ACTIVE')
    const permitted = !permission || (usesSupplyPermission
      ? supplyAccess.can(permission) || (!supplyAccess.context?.initialized && supplyAccess.context?.canInitialize === true)
      : authStore.hasPermission(permission))
    if (!permitted) {
      devWarn('路由权限不足，跳转403页面', { path: to.fullPath, permission })
      next({ path: '/403' })
      return
    }

    if (applicationCode === 'SUPPLY_CHAIN') {
      const name = supplyPageName(useNavigationStore().getNavigation(applicationCode), to.path)
      document.title = `${name || title} - 瑞盖供应链数字化平台`
    }

    devInfo('路由权限校验通过', { path: to.fullPath, applicationCode })
    next()
  })
}
