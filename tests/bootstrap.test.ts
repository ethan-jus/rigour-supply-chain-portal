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
  readSession: vi.fn(), beginLogin: vi.fn(), landingPath: vi.fn(), token: vi.fn(),
}))

vi.mock('@/api', () => ({
  registerUnauthorizedSessionHandler: mocks.registerUnauthorizedSessionHandler,
}))

vi.mock('@/stores', () => ({
  useAuthStore: () => mocks.authStore,
}))

vi.mock('@/auth/oidc', () => ({
  completeOidcCallback: vi.fn().mockResolvedValue(false),
  beginOidcLogin: mocks.beginLogin,
  getAccessToken: mocks.token,
  takeOidcLandingPath: mocks.landingPath,
  safeReturnPath: (value: string) => value || '/supply-chain',
}))
vi.mock('@/auth/browser-session', () => ({ readBrowserSession: mocks.readSession }))

vi.mock('@/router/permissionGuard', () => ({
  setupPermissionGuard: vi.fn(),
}))

import { bootstrapScdp } from '@/bootstrap'
import { createScdpRouter } from '@/router'

type UnauthorizedHandler = () => void | Promise<void>

function createHarness(path = '/supply-chain', fullPath = path) {
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

describe('Scdp启动顺序与会话失效恢复', () => {
  let unauthorizedHandler: UnauthorizedHandler | undefined

  beforeEach(() => {
    unauthorizedHandler = undefined
    mocks.readSession.mockReset().mockResolvedValue({ authenticated: false })
    mocks.beginLogin.mockReset().mockResolvedValue(undefined)
    mocks.landingPath.mockReset().mockReturnValue('/supply-chain')
    mocks.token.mockReset().mockReturnValue(null)
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
      return true
    })
    mocks.authStore.synchronizeTokenState.mockImplementation(() => { events.push('token-synchronized') })
    const createRouter = vi.fn(() => {
      events.push('router-created')
      return router
    })

    await bootstrapScdp(app, {} as Pinia, createRouter, { completeCallback, mountTarget: '#scdp' })

    expect(events).toEqual([
      'oidc-callback',
      'token-synchronized',
      'router-created',
      'router-installed',
      'router-ready',
      'mounted',
    ])
    expect(window.location.hash).toBe('#/supply-chain')
    expect(app.mount).toHaveBeenCalledWith('#scdp')
  })

  it.each([
    '/supply-chain/order/sales-orders?tab=pending',
    '/supply-chain/crm/customers/areas?from=order',
  ])('真实Hash Router在callback后统一进入首页，忽略旧目标路由：%s', async (returnPath) => {
    window.history.replaceState({}, '', `/#${returnPath}`)
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    const host = document.createElement('div')
    host.id = 'scdp-bootstrap-integration'
    document.body.append(host)
    const app = createApp({ render: () => h('div', 'scdp-ready') })
    let router: Router | undefined
    const createRouter = vi.fn(() => {
      expect(window.location.hash).toBe('#/supply-chain')
      router = createScdpRouter()
      return router
    })

    try {
      await bootstrapScdp(app, {} as Pinia, createRouter, {
        completeCallback: async () => true,
        mountTarget: '#scdp-bootstrap-integration',
      })

      expect(createRouter).toHaveBeenCalledOnce()
      expect(router?.currentRoute.value.fullPath).toBe('/supply-chain')
    } finally {
      app.unmount()
      host.remove()
      scrollTo.mockRestore()
    }
  })

  it('router.replace失败时使用Hash导航回登录页且不自动重登', async () => {
    const currentPath = '/supply-chain/order/sales-orders?tab=pending'
    const { app, router } = createHarness('/supply-chain/order/sales-orders', currentPath)
    vi.mocked(router.replace).mockRejectedValueOnce(new Error('navigation aborted'))
    await bootstrapScdp(app, {} as Pinia, () => router, { completeCallback: async () => false })

    await unauthorizedHandler?.()

    expect(mocks.authStore.clearLocalSession).toHaveBeenCalledOnce()
    expect(router.replace).toHaveBeenCalledWith({
      path: '/login',
      query: { reason: 'session_expired' },
    })
    expect(window.location.hash).toBe(
      '#/login?reason=session_expired',
    )
  })

  it('刷新业务页先恢复现有服务器会话，不挂载登录页且保留完整站内地址', async () => {
    window.history.replaceState({}, '', '/#/supply-chain/hr/employees?keyword=zhang')
    mocks.readSession.mockResolvedValue({ authenticated: true })
    const { app, router } = createHarness()
    const createRouter = vi.fn(() => router)
    await bootstrapScdp(app, {} as Pinia, createRouter)
    expect(mocks.beginLogin).toHaveBeenCalledWith('/supply-chain/hr/employees?keyword=zhang')
    expect(createRouter).not.toHaveBeenCalled()
    expect(app.mount).not.toHaveBeenCalled()
  })

  it('会话恢复回调返回原页面，交由权限守卫重新校验', async () => {
    mocks.landingPath.mockReturnValue('/supply-chain/erp/master-data/products?keyword=test')
    const { app, router } = createHarness()
    await bootstrapScdp(app, {} as Pinia, () => router, { completeCallback: async () => true })
    expect(window.location.hash).toBe('#/supply-chain/erp/master-data/products?keyword=test')
    expect(mocks.readSession).not.toHaveBeenCalled()
  })

  it.each(['/#/login?reason=logout', '/#/login?reason=session_expired', '/#/login?reason=reauthenticate'])('显式登录状态 %s 不自动恢复', async path => {
    window.history.replaceState({}, '', path)
    mocks.readSession.mockResolvedValue({ authenticated: true })
    const { app, router } = createHarness()
    await bootstrapScdp(app, {} as Pinia, () => router)
    expect(mocks.beginLogin).not.toHaveBeenCalled()
    expect(mocks.readSession).not.toHaveBeenCalled()
    expect(app.mount).toHaveBeenCalled()
  })

  it('回调校验失败不发起第二次授权，停留在登录表单', async () => {
    mocks.readSession.mockResolvedValue({ authenticated: true })
    const { app, router } = createHarness()
    await bootstrapScdp(app, {} as Pinia, () => router, { completeCallback: async () => { throw new Error('invalid state') } })
    expect(mocks.beginLogin).not.toHaveBeenCalled()
    expect(window.location.hash).toBe('#/login?reason=oidc_callback_failed')
  })

  it('首次未登录访问不发起自动授权', async () => {
    const { app, router } = createHarness()
    await bootstrapScdp(app, {} as Pinia, () => router)
    expect(mocks.beginLogin).not.toHaveBeenCalled()
    expect(app.mount).toHaveBeenCalled()
  })
})
