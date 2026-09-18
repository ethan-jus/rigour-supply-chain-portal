import { afterEach, describe, expect, it, vi } from 'vitest'
import { readBrowserSession, submitBrowserLogin, logoutBrowserSession } from '@/auth/browser-session'
import { assertOidcBrowserOrigin, beginOidcLogin, takeOidcLandingPath } from '@/auth/oidc'

const session = { authenticated: false, csrfParameter: '_csrf', csrfToken: 'masked-token' }
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('Web 同源认证边界', () => {
  it('携带 CSRF 和同源会话 cookie 登录，不使用密码换取 Token', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(session)).mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetcher)
    await submitBrowserLogin({ tenantCode: 'tenant', username: 'user', password: 'password' })
    expect(fetcher.mock.calls[0]![0]).toBe('/auth/scdp/session')
    const [url, options] = fetcher.mock.calls[1]!
    expect(url).toBe('/auth/scdp/login')
    expect(options.credentials).toBe('same-origin')
    expect(options.redirect).toBe('error')
    expect(options.body.get('_csrf')).toBe('masked-token')
    expect(options.body.get('grant_type')).toBeNull()
  })
  it('即使没有内存 Token，退出仍携带 CSRF 撤销服务器会话', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json(session)).mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetcher)
    await logoutBrowserSession()
    const [url, options] = fetcher.mock.calls[1]!
    expect(url).toBe('/auth/scdp/logout')
    expect(options.body.get('_csrf')).toBe('masked-token')
    expect(options.credentials).toBe('same-origin')
  })
  it.each([[401, '不正确'], [403, '已过期'], [500, '暂时不可用']])('失败状态 %s 给出可理解的提示', async (status, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json(session)).mockResolvedValueOnce(new Response(null, { status })))
    await expect(submitBrowserLogin({ tenantCode: 't', username: 'u', password: 'p' })).rejects.toThrow(message)
  })
  it('未知代理路径返回的 HTML 不能当作成功会话', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Web</html>')))
    await expect(readBrowserSession()).rejects.toThrow('暂时不可用')
  })
  it('端口漂移时在写入 PKCE 状态和离开页面之前拒绝登录', async () => {
    vi.stubEnv('VITE_OIDC_ISSUER', 'https://iam.example')
    vi.stubEnv('VITE_OIDC_CLIENT_ID', 'scdp-browser')
    vi.stubEnv('VITE_OIDC_REDIRECT_URI', 'http://localhost:5100/oidc/callback')
    expect(() => assertOidcBrowserOrigin()).toThrow('http://localhost:5100/')
    await expect(beginOidcLogin()).rejects.toThrow('地址与登录配置不一致')
  })
  it('授权只走 Web 地址并保留 state、nonce 和 S256，不附加旧强制重登参数', async () => {
    const assign = vi.fn()
    vi.stubGlobal('window', { location: { origin: 'https://scdp.example', assign } })
    vi.stubEnv('VITE_OIDC_ISSUER', 'https://iam.example')
    vi.stubEnv('VITE_OIDC_CLIENT_ID', 'scdp-browser')
    vi.stubEnv('VITE_OIDC_REDIRECT_URI', 'https://scdp.example/oidc/callback')
    await beginOidcLogin()
    const url = new URL(assign.mock.calls[0]![0])
    expect(url.origin).toBe('https://scdp.example')
    expect(url.pathname).toBe('/auth/oauth2/authorize')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('state')).toBeTruthy()
    expect(url.searchParams.get('nonce')).toBeTruthy()
    expect(url.searchParams.has('prompt')).toBe(false)
    expect(takeOidcLandingPath()).toBe('/supply-chain')
  })
  it.each(['/supply-chain/hr/employees?keyword=test', 'https://evil.example/', '//evil.example/', '/login', '/supply-chain\\evil'])('恢复地址 %s 只接受供应链站内地址且使用后清除', async path => {
    vi.stubGlobal('window', { location: { origin: 'https://scdp.example', assign: vi.fn() } })
    vi.stubEnv('VITE_OIDC_ISSUER', 'https://iam.example')
    vi.stubEnv('VITE_OIDC_CLIENT_ID', 'scdp-browser')
    vi.stubEnv('VITE_OIDC_REDIRECT_URI', 'https://scdp.example/oidc/callback')
    await beginOidcLogin(path)
    expect(takeOidcLandingPath()).toBe(path === '/supply-chain/hr/employees?keyword=test' ? path : '/supply-chain')
    expect(takeOidcLandingPath()).toBe('/supply-chain')
  })
})
