export interface BrowserSession {
  authenticated: boolean
  csrfParameter: string
  csrfToken: string
}

export interface LoginCredentials {
  tenantCode: string
  username: string
  password: string
}

const UNAVAILABLE = '登录服务暂时不可用，请确认后端服务已启动后重试。'

async function request(path: string, options: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(`/auth/scdp/${path}`, {
      ...options, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    })
  } catch {
    throw new Error(UNAVAILABLE)
  }
}

export async function readBrowserSession(): Promise<BrowserSession> {
  const response = await request('session', { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(UNAVAILABLE)
  let session: BrowserSession
  try { session = await response.json() as BrowserSession } catch { throw new Error(UNAVAILABLE) }
  if (typeof session.authenticated !== 'boolean' || session.csrfParameter !== '_csrf'
    || typeof session.csrfToken !== 'string' || !session.csrfToken) throw new Error(UNAVAILABLE)
  return session
}

/** 只建立 HttpOnly 会话，业务 Token 仍由 OIDC Code + PKCE 签发。 */
export async function submitBrowserLogin(credentials: LoginCredentials): Promise<void> {
  const session = await readBrowserSession()
  const response = await request('login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ ...credentials, [session.csrfParameter]: session.csrfToken }),
  })
  if (response.status === 401) throw new Error('企业编码、用户名或密码不正确，请重新输入。')
  if (response.status === 403) throw new Error('登录页面已过期，请重新提交。')
  if (response.status !== 204) throw new Error(UNAVAILABLE)
}

/** 退出直接撤销后端浏览器会话，不依赖内存中是否仍有 ID Token。 */
export async function logoutBrowserSession(): Promise<void> {
  const session = await readBrowserSession()
  const response = await request('logout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ [session.csrfParameter]: session.csrfToken }),
  })
  if (response.status !== 204) throw new Error('退出未完成，请稍后重试。')
}
