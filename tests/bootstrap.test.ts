import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h } from 'vue'
import type { App } from 'vue'
import type { Pinia } from 'pinia'
import type { Router } from 'vue-router'

const mocks = vi.hoisted(() => ({
  authStore: {
    synchronizeTokenState: vi.fn(),
    clearLocalSession: vi.fn(),
  },
  registerUnauthorizedSessionHandler: vi.fn(),
}))

vi.mock('@/api', () => ({
  registerUnauthorizedSessionHandler: mocks.registerUnauthorizedSessionHandler,
}))

vi.mock('@/stores', () => ({
  useAuthStore: () => mocks.authStore,
}))

vi.mock('@/auth/oidc', () => ({
  completeOidcCallback: vi.fn().mockResolvedValue(null),
  safeReturnPath: (value: string | null | undefined) =>
    value?.startsWith('/') && !value.startsWith('//') ? value : '/apps',
}))

vi.mock('@/router/permissionGuard', () => ({
  setupPermissionGuard: vi.fn(),
}))

import { bootstrapPortal } from '@/bootstrap'
import { createPortalRouter } from '@/router'

type UnauthorizedHandler = () => void | Promise<void>

function createHarness(path = '/apps', fullPath = path) {
  const events: string[] = []
  const app = {
    use: vi.fn(() => { events.push('router-installed'); return app }),
    mount: vi.fn(() => { events.push('mounted') }),
  } as unknown as App
  const router = {
    currentRoute: { value: { path, fullPath, query: {} } },
    isReady: vi.fn(async () => { events.push('router-ready') }),
    replace: vi.fn().mockResolvedValue(undefined),
  } as unknown as Router
  return { app, router, events }
}

describe('Portal启动顺序与会话失效恢复', () => {
  let unauthorizedHandler: UnauthorizedHandler | undefined

  beforeEach(() => {
    unauthorizedHandler = undefined
    mocks.authStore.synchronizeTokenState.mockReset()
    mocks.authStore.clearLocalSession.mockReset()
    mocks.registerUnauthorizedSessionHandler.mockReset()
    mocks.registerUnauthorizedSessionHandler.mockImplementation((handler: UnauthorizedHandler) => {
      unauthorizedHandler = handler
      return vi.fn()
    })
    window.history.replaceState({}, '', '/')
  })

  afterEach(() => {
    window.history.replaceState({}, '', '/')
  })

  it('先完成OIDC callback与Token同步，再安装Router、等待并挂载', async () => {
    const { app, router, events } = createHarness()
    const completeCallback = vi.fn(async () => {
      events.push('oidc-callback')
      return '/system-admin/users?tab=enabled'
    })
    mocks.authStore.synchronizeTokenState.mockImplementation(() => { events.push('token-synchronized') })
    const createRouter = vi.fn(() => {
      events.push('router-created')
      return router
    })

    await bootstrapPortal(app, {} as Pinia, createRouter, { completeCallback, mountTarget: '#portal' })

    expect(events).toEqual([
      'oidc-callback',
      'token-synchronized',
      'router-created',
      'router-installed',
      'router-ready',
      'mounted',
    ])
    expect(window.location.hash).toBe('#/system-admin/users?tab=enabled')
    expect(app.mount).toHaveBeenCalledWith('#portal')
  })

  it.each([
    '/supply-chain/order/sales-orders?tab=pending',
    '/supply-chain/crm/customers/areas?from=order',
  ])('真实Hash Router在callback后从目标路由启动，不回落/apps：%s', async (returnPath) => {
    window.history.replaceState({}, '', '/#/')
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    const host = document.createElement('div')
    host.id = 'portal-bootstrap-integration'
    document.body.append(host)
    const app = createApp({ render: () => h('div', 'portal-ready') })
    let router: Router | undefined
    const createRouter = vi.fn(() => {
      expect(window.location.hash).toBe(`#${returnPath}`)
      router = createPortalRouter()
      return router
    })

    try {
      await bootstrapPortal(app, {} as Pinia, createRouter, {
        completeCallback: async () => returnPath,
        mountTarget: '#portal-bootstrap-integration',
      })

      expect(createRouter).toHaveBeenCalledOnce()
      expect(router?.currentRoute.value.fullPath).toBe(returnPath)
      expect(router?.currentRoute.value.fullPath).not.toBe('/apps')
    } finally {
      app.unmount()
      host.remove()
      scrollTo.mockRestore()
    }
  })

  it('router.replace失败时使用Hash导航回登录页并保留当前fullPath', async () => {
    const currentPath = '/supply-chain/order/sales-orders?tab=pending'
    const { app, router } = createHarness('/supply-chain/order/sales-orders', currentPath)
    vi.mocked(router.replace).mockRejectedValueOnce(new Error('navigation aborted'))
    await bootstrapPortal(app, {} as Pinia, () => router, { completeCallback: async () => null })

    await unauthorizedHandler?.()

    expect(mocks.authStore.clearLocalSession).toHaveBeenCalledOnce()
    expect(router.replace).toHaveBeenCalledWith({
      path: '/login',
      query: { redirect: currentPath, reason: 'session_expired' },
    })
    expect(window.location.hash).toBe(
      '#/login?redirect=%2Fsupply-chain%2Forder%2Fsales-orders%3Ftab%3Dpending&reason=session_expired',
    )
  })
})
