import type { App } from 'vue'
import type { Pinia } from 'pinia'
import type { Router } from 'vue-router'
import { registerUnauthorizedSessionHandler } from '@/api'
import { beginOidcLogin, completeOidcCallback, getAccessToken, safeReturnPath, takeOidcLandingPath } from '@/auth/oidc'
import { readBrowserSession } from '@/auth/browser-session'
import { useAuthStore } from '@/stores'
import { devInfo, devWarn } from '@/utils/dev-log'

interface ScdpBootstrapOptions {
  completeCallback?: () => Promise<boolean>
  mountTarget?: string
}

type ScdpRouterFactory = () => Router

/**
 * OIDC callback必须在Router启动前完成。
 *
 * Hash Router一旦安装就会立即触发初始导航；若此时内存Token尚未恢复，
 * 守卫会把OIDC callback误判为未登录并重复进入登录页。
 */
export async function bootstrapScdp(
  app: App,
  pinia: Pinia,
  createRouter: ScdpRouterFactory,
  options: ScdpBootstrapOptions = {},
): Promise<void> {
  const completeCallback = options.completeCallback || completeOidcCallback
  let loginCompleted = false
  let callbackFailed = false
  try {
    loginCompleted = await completeCallback()
  } catch (error) {
    callbackFailed = true
    devWarn('SCDP启动阶段OIDC回调失败，回到登录页', {
      message: error instanceof Error ? error.message : error,
    })
    window.history.replaceState({}, '', `${import.meta.env.BASE_URL}#/login?reason=oidc_callback_failed`)
  }

  // 刷新受保护页面时先恢复有效的 HttpOnly 会话，避免先渲染登录页、
  // 再丢弃原页面回到首页。真正未登录或显式退出仍显示正常登录表单。
  const currentPath = window.location.hash.slice(1)
  const canRestore = !currentPath || currentPath === '/'
    || /^\/supply-chain(?:[/?#]|$)/.test(currentPath)
  if (!loginCompleted && !callbackFailed && !getAccessToken() && canRestore) {
    try {
      const session = await readBrowserSession()
      if (session.authenticated) {
        await beginOidcLogin(safeReturnPath(currentPath))
        return
      }
    } catch (error) {
      devWarn('启动阶段无法恢复会话，交由登录页面展示状态', {
        message: error instanceof Error ? error.message : error,
      })
    }
  }

  const authStore = useAuthStore(pinia)
  authStore.synchronizeTokenState()
  if (loginCompleted) {
    const landingPath = takeOidcLandingPath()
    devInfo('SCDP登录完成', { path: landingPath })
    window.history.replaceState({}, '', `${import.meta.env.BASE_URL}#${landingPath}`)
  }

  // Hash Router 在创建时读取地址，必须晚于认证回调清理与页面定位。
  const router = createRouter()

  registerUnauthorizedSessionHandler(async () => {
    authStore.clearLocalSession()
    if (router.currentRoute.value.path === '/login') return
    try {
      await router.replace({
        path: '/login',
        query: { reason: 'session_expired' },
      })
    } catch (error) {
      devWarn('会话失效时Router跳转失败，改用Hash导航返回登录页', {
        message: error instanceof Error ? error.message : error,
      })
      window.location.hash = '/login?reason=session_expired'
    }
  })

  app.use(router)
  await router.isReady()
  app.mount(options.mountTarget || '#app')
}
