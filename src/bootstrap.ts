import type { App } from 'vue'
import type { Pinia } from 'pinia'
import type { Router } from 'vue-router'
import { registerUnauthorizedSessionHandler } from '@/api'
import { completeOidcCallback, safeReturnPath } from '@/auth/oidc'
import { useAuthStore } from '@/stores'
import { devInfo, devWarn } from '@/utils/dev-log'

interface PortalBootstrapOptions {
  completeCallback?: () => Promise<string | null>
  mountTarget?: string
}

type PortalRouterFactory = () => Router

function currentReturnPath(router: Router): string {
  const current = router.currentRoute.value
  if (current.path === '/login' && typeof current.query.redirect === 'string') {
    return safeReturnPath(current.query.redirect)
  }
  return safeReturnPath(current.fullPath)
}

/**
 * OIDC callback必须在Router启动前完成。
 *
 * Hash Router一旦安装就会立即触发初始导航；若此时内存Token尚未恢复，
 * 守卫会把OIDC callback误判为未登录并丢失原始returnPath。
 */
export async function bootstrapPortal(
  app: App,
  pinia: Pinia,
  createRouter: PortalRouterFactory,
  options: PortalBootstrapOptions = {},
): Promise<void> {
  const completeCallback = options.completeCallback || completeOidcCallback
  let returnPath: string | null = null
  try {
    returnPath = await completeCallback()
  } catch (error) {
    devWarn('门户启动阶段OIDC回调失败，回到登录页', {
      message: error instanceof Error ? error.message : error,
    })
    window.history.replaceState({}, '', `${import.meta.env.BASE_URL}#/login?reason=oidc_callback_failed`)
  }

  const authStore = useAuthStore(pinia)
  authStore.synchronizeTokenState()
  if (returnPath) {
    devInfo('门户准备进入登录前目标页面', { returnPath })
    window.history.replaceState({}, '', `${import.meta.env.BASE_URL}#${returnPath}`)
  }

  // createWebHashHistory会缓存创建瞬间的Hash位置，必须在上面的returnPath
  // 恢复之后才创建Router，否则其首次导航仍可能把页面带回旧的“/”→/apps。
  const router = createRouter()

  registerUnauthorizedSessionHandler(async () => {
    const redirect = currentReturnPath(router)
    authStore.clearLocalSession()
    if (router.currentRoute.value.path === '/login') return
    try {
      await router.replace({
        path: '/login',
        query: { redirect, reason: 'session_expired' },
      })
    } catch (error) {
      const query = new URLSearchParams({ redirect, reason: 'session_expired' })
      devWarn('会话失效时Router跳转失败，改用Hash导航返回登录页', {
        message: error instanceof Error ? error.message : error,
      })
      window.location.hash = `/login?${query.toString()}`
    }
  })

  app.use(router)
  await router.isReady()
  app.mount(options.mountTarget || '#app')
}
