import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearOidcTokens,
  completeOidcCallback,
  consumeLogoutPending,
  createPkcePair,
  getAccessToken,
  safeReturnPath,
  validateIdTokenClaims,
} from '@/auth/oidc'
import { getToken, removeToken } from '@/utils/token'

function jwtPart(value: object): string {
  return btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

describe('OIDC PKCE 与Token存储边界', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    clearOidcTokens()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    window.history.replaceState({}, '', '/')
  })

  it('生成S256所需的高熵verifier和challenge', async () => {
    const first = await createPkcePair()
    const second = await createPkcePair()
    expect(first.verifier.length).toBeGreaterThanOrEqual(43)
    expect(first.challenge).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(first).not.toEqual(second)
  })

  it('拒绝外部和协议相对返回地址', () => {
    expect(safeReturnPath('/supply-chain')).toBe('/supply-chain')
    expect(safeReturnPath('//evil.example')).toBe('/apps')
    expect(safeReturnPath('https://evil.example')).toBe('/apps')
  })

  it('永远不从localStorage读取旧Token', () => {
    localStorage.setItem('portal_access_token', 'stale-access-token')
    localStorage.setItem('portal_refresh_token', 'stale-refresh-token')
    expect(getToken()).toBeNull()
    expect(getAccessToken()).toBeNull()
    removeToken()
    expect(getToken()).toBeNull()
  })

  it('退出标记只消费一次，避免退出后自动重新登录', () => {
    sessionStorage.setItem('rigour_oidc_logout_pending', '1')
    expect(consumeLogoutPending()).toBe(true)
    expect(consumeLogoutPending()).toBe(false)
  })

  it('校验ID Token issuer audience nonce和时间', () => {
    const now = 1_800_000_000
    expect(() => validateIdTokenClaims({
      iss: 'https://iam.test.rigour.local', sub: 'user-1', aud: 'portal-test',
      exp: now + 300, iat: now, nonce: 'nonce-1',
    }, 'https://iam.test.rigour.local', 'portal-test', 'nonce-1', now)).not.toThrow()
    expect(() => validateIdTokenClaims({
      iss: 'https://iam.test.rigour.local', sub: 'user-1', aud: 'portal-test',
      exp: now + 300, iat: now, nonce: 'wrong',
    }, 'https://iam.test.rigour.local', 'portal-test', 'nonce-1', now)).toThrow('ID Token声明校验失败')
  })

  it('保存expires_in并在过期前5秒安全窗口内停止使用Access Token', async () => {
    vi.useFakeTimers()
    const now = new Date('2026-08-17T08:00:00Z')
    vi.setSystemTime(now)
    const nowSeconds = Math.floor(now.getTime() / 1000)
    const idToken = [
      jwtPart({ alg: 'RS256', kid: 'key-1' }),
      jwtPart({
        iss: 'https://iam.test.rigour.local',
        sub: 'user-1',
        aud: 'portal-test',
        exp: nowSeconds + 300,
        iat: nowSeconds,
        nonce: 'nonce-1',
      }),
      'AQ',
    ].join('.')
    sessionStorage.setItem('rigour_oidc_state', 'state-1')
    sessionStorage.setItem('rigour_oidc_code_verifier', 'verifier-1')
    sessionStorage.setItem('rigour_oidc_return_path', '/supply-chain/order/sales-orders?tab=pending')
    sessionStorage.setItem('rigour_oidc_nonce', 'nonce-1')
    window.history.replaceState({}, '', '/oidc/callback?code=code-1&state=state-1')

    vi.spyOn(crypto.subtle, 'importKey').mockResolvedValue({} as CryptoKey)
    vi.spyOn(crypto.subtle, 'verify').mockResolvedValue(true)
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: 'access-token-1',
        id_token: idToken,
        token_type: 'Bearer',
        expires_in: 60,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        issuer: 'https://iam.test.rigour.local',
        jwks_uri: 'https://iam.test.rigour.local/oauth2/jwks',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        keys: [{ kid: 'key-1', kty: 'RSA', alg: 'RS256', use: 'sig', n: 'AQAB', e: 'AQAB' }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })))

    await expect(completeOidcCallback()).resolves.toBe('/supply-chain/order/sales-orders?tab=pending')
    expect(getAccessToken()).toBe('access-token-1')

    vi.setSystemTime(now.getTime() + 56_000)
    expect(getAccessToken()).toBeNull()
  })
})
