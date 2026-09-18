import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { apiClient, registerUnauthorizedSessionHandler } from '@/api/core/client'
import { clearOidcTokens, completeOidcCallback, ensureAccessToken, getAccessToken, hasRefreshToken } from '@/auth/oidc'
import { useAuthStore } from '@/stores/auth'
import { setupPermissionGuard } from '@/router/permissionGuard'
import { verifyRs256 } from '@/auth/oidc-crypto'

vi.mock('@/auth/oidc-crypto', async importOriginal => ({
  ...await importOriginal<object>(), verifyRs256: vi.fn().mockResolvedValue(true),
}))

const now = Date.parse('2026-09-16T08:00:00Z')
const originalAdapter = apiClient.defaults.adapter
let stopHandler: (() => void) | undefined
const body = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
const tokens = (n = 2) => ({ access_token: `access-${n}`, refresh_token: `refresh-${n}`, token_type: 'Bearer', expires_in: 900 })
const part = (data: object) => btoa(JSON.stringify(data)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
const denied = (config: InternalAxiosRequestConfig, code = 'IAM_TOKEN_INVALID', status = 401) =>
  new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, undefined, {
    config, status, statusText: 'Unauthorized', headers: new AxiosHeaders(), data: { code },
  })
const ok = (config: InternalAxiosRequestConfig) => ({
  config, status: 200, statusText: 'OK', headers: new AxiosHeaders(), data: { value: 'ok' },
})

async function login() {
  const idToken = [
    part({ alg: 'RS256', kid: 'key' }),
    part({ iss: 'https://iam.test.rigour.local', sub: 'user', aud: 'scdp-test', nonce: 'nonce',
      exp: now / 1000 + 900, iat: now / 1000 }), 'AQ',
  ].join('.')
  sessionStorage.setItem('rigour_oidc_state', 'state')
  sessionStorage.setItem('rigour_oidc_code_verifier', 'verifier')
  sessionStorage.setItem('rigour_oidc_nonce', 'nonce')
  window.history.replaceState({}, '', '/oidc/callback?code=code&state=state')
  const fetch = vi.fn()
    .mockResolvedValueOnce(body({ ...tokens(1), id_token: idToken }))
    .mockResolvedValueOnce(body({ issuer: 'https://iam.test.rigour.local', jwks_uri: 'https://iam.test.rigour.local/oauth2/jwks' }))
    .mockResolvedValueOnce(body({ keys: [{ kid: 'key', kty: 'RSA' }] }))
  vi.stubGlobal('fetch', fetch)
  await completeOidcCallback()
  window.history.replaceState({}, '', '/#/supply-chain/orders?tab=pending')
  fetch.mockReset()
  return fetch
}

beforeEach(() => {
  vi.mocked(verifyRs256).mockResolvedValue(true)
  clearOidcTokens()
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
  vi.spyOn(Date, 'now').mockReturnValue(now)
})
afterEach(() => {
  vi.useRealTimers()
  stopHandler?.()
  clearOidcTokens()
  apiClient.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

describe('标准双 Token 自动续期', () => {
  it('超过 15 分钟的并发请求只刷新一次，使用新 Token 且不离开页面', async () => {
    const fetch = await login()
    vi.mocked(Date.now).mockReturnValue(now + 901_000)
    expect(getAccessToken()).toBeNull()
    expect(hasRefreshToken()).toBe(true)
    fetch.mockResolvedValue(body(tokens()))
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => {
      expect(config.headers.Authorization).toBe('Bearer access-2')
      return ok(config)
    })
    apiClient.defaults.adapter = adapter
    await Promise.all([apiClient.get('/one'), apiClient.get('/two'), ensureAccessToken()])
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, request] = fetch.mock.calls[0]!
    expect(url).toContain('/auth/oauth2/token')
    expect(request.body.get('grant_type')).toBe('refresh_token')
    expect(request.body.get('refresh_token')).toBe('refresh-1')
    expect(request.body.get('client_id')).toBe('scdp-test')
    expect(request.credentials).toBe('omit')
    expect(window.location.hash).toBe('#/supply-chain/orders?tab=pending')
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
    // 下一轮必须提交轮换后的令牌。
    vi.mocked(Date.now).mockReturnValue(now + 1_802_000)
    fetch.mockResolvedValue(body(tokens(3)))
    await ensureAccessToken()
    expect(fetch.mock.calls[1]![1].body.get('refresh_token')).toBe('refresh-2')
  })

  it('迟到的旧 Token 401 复用已刷新的 Token，不再次轮换', async () => {
    const fetch = await login()
    fetch.mockResolvedValue(body(tokens()))
    const rejected: (() => void)[] = []
    apiClient.defaults.adapter = async config => {
      if (config.headers.Authorization === 'Bearer access-1') {
        return new Promise((_, reject) => rejected.push(() => reject(denied(config))))
      }
      return ok(config)
    }
    const first = apiClient.get('/first')
    const late = apiClient.get('/late')
    await vi.waitFor(() => expect(rejected).toHaveLength(2))
    rejected[0]!()
    await first
    rejected[1]!()
    await late
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('刷新后仍然 401 只重试一次，然后通知登录失效', async () => {
    const fetch = await login()
    fetch.mockResolvedValue(body(tokens()))
    const expired = vi.fn(() => clearOidcTokens())
    stopHandler = registerUnauthorizedSessionHandler(expired)
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => { throw denied(config) })
    apiClient.defaults.adapter = adapter
    await expect(apiClient.get('/me')).rejects.toMatchObject({ code: 'IAM_TOKEN_INVALID' })
    expect(adapter).toHaveBeenCalledTimes(2)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(expired).toHaveBeenCalledTimes(1)
    expect(hasRefreshToken()).toBe(false)
  })

  it.each([['BUSINESS_UNAUTHORIZED', 401], ['IAM_FORBIDDEN', 403], ['IAM_UNAVAILABLE', 503]])(
    '业务错误 %s 不刷新也不退出', async (code, status) => {
      const fetch = await login()
      const expired = vi.fn()
      stopHandler = registerUnauthorizedSessionHandler(expired)
      apiClient.defaults.adapter = async config => { throw denied(config, code as string, status as number) }
      await expect(apiClient.get('/order')).rejects.toBeDefined()
      expect(fetch).not.toHaveBeenCalled()
      expect(expired).not.toHaveBeenCalled()
      expect(hasRefreshToken()).toBe(true)
    })

  it('刷新令牌失效时，并发请求只通知一次，不发送无凭证业务请求', async () => {
    const fetch = await login()
    vi.mocked(Date.now).mockReturnValue(now + 901_000)
    fetch.mockResolvedValue(body({ error: 'invalid_grant' }, 400))
    const expired = vi.fn()
    stopHandler = registerUnauthorizedSessionHandler(expired)
    const adapter = vi.fn()
    apiClient.defaults.adapter = adapter
    const results = await Promise.allSettled([apiClient.get('/one'), apiClient.get('/two')])
    expect(results.every(result => result.status === 'rejected')).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(expired).toHaveBeenCalledTimes(1)
    expect(adapter).not.toHaveBeenCalled()
    expect(hasRefreshToken()).toBe(false)
  })

  it.each(['network', '503', 'invalid-response'])('刷新遇到 %s 保留会话并报告可重试错误', async kind => {
    const fetch = await login()
    vi.mocked(Date.now).mockReturnValue(now + 901_000)
    if (kind === 'network') fetch.mockRejectedValue(new TypeError('offline'))
    else fetch.mockResolvedValue(kind === '503' ? body({ error: 'server_error' }, 503) : body({ access_token: 'incomplete' }))
    await expect(ensureAccessToken()).rejects.toMatchObject({ code: 'IAM_UNAVAILABLE' })
    expect(hasRefreshToken()).toBe(true)
    fetch.mockResolvedValue(body(tokens()))
    await expect(ensureAccessToken()).resolves.toBe('access-2')
  })

  it('退出后迟到的刷新响应不能恢复登录', async () => {
    const fetch = await login()
    vi.mocked(Date.now).mockReturnValue(now + 901_000)
    let finish!: (response: Response) => void
    fetch.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const pending = ensureAccessToken()
    clearOidcTokens()
    finish(body(tokens()))
    await expect(pending).rejects.toMatchObject({ code: 'REQUEST_CANCELLED' })
    expect(getAccessToken()).toBeNull()
    expect(hasRefreshToken()).toBe(false)
  })

  it('退出再登录后，旧请求迟到的 401 不能清理新会话或重发业务请求', async () => {
    await login()
    let rejectOld!: () => void
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) =>
      new Promise<never>((_, reject) => { rejectOld = () => reject(denied(config)) }))
    apiClient.defaults.adapter = adapter
    const pending = apiClient.get('/old-session-order')
    const cancelled = expect(pending).rejects.toMatchObject({ code: 'REQUEST_CANCELLED' })
    await vi.waitFor(() => expect(adapter).toHaveBeenCalledTimes(1))
    clearOidcTokens()
    const fetch = await login()
    const expired = vi.fn()
    stopHandler = registerUnauthorizedSessionHandler(expired)
    rejectOld()
    await cancelled
    expect(getAccessToken()).toBe('access-1')
    expect(expired).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(adapter).toHaveBeenCalledTimes(1)
  })

  it('刷新超时结束等待但不清除会话', async () => {
    const fetch = await login()
    vi.mocked(Date.now).mockReturnValue(now + 901_000)
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    fetch.mockImplementation((_url, options) => new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
    }))
    const rejected = expect(ensureAccessToken()).rejects.toMatchObject({ code: 'IAM_UNAVAILABLE' })
    await vi.advanceTimersByTimeAsync(10_000)
    await rejected
    expect(hasRefreshToken()).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('路由切换时先续期，保留目标页面和查询条件', async () => {
    const fetch = await login()
    fetch.mockResolvedValue(body(tokens()))
    const auth = useAuthStore()
    auth.user = { id: 'user', principalScope: 'TENANT', username: 'test', displayName: '测试', roles: [], permissions: [],
      tenantId: 'tenant', tenantName: '测试企业' }
    vi.mocked(Date.now).mockReturnValue(now + 901_000)
    const router = createRouter({ history: createMemoryHistory(), routes: [
      { path: '/supply-chain/orders', component: {}, meta: { title: '订单', requiresAuth: true } },
      { path: '/login', component: {} }, { path: '/service-unavailable', component: {} },
    ] })
    setupPermissionGuard(router)
    await router.push('/supply-chain/orders?tab=pending')
    expect(router.currentRoute.value.fullPath).toBe('/supply-chain/orders?tab=pending')
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.token).toBe('access-2')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
