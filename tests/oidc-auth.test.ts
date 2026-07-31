import { beforeEach, describe, expect, it } from 'vitest'
import { clearOidcTokens, createPkcePair, getAccessToken, safeReturnPath, validateIdTokenClaims } from '@/auth/oidc'
import { getToken, removeToken } from '@/utils/token'

describe('OIDC PKCE 与Token存储边界', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    clearOidcTokens()
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
})
