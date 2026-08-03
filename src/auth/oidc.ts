import { devInfo, devWarn } from '@/utils/dev-log'

interface OidcTokenResponse {
  access_token: string
  id_token: string
  token_type: string
  expires_in: number
}

const STATE_KEY = 'rigour_oidc_state'
const VERIFIER_KEY = 'rigour_oidc_code_verifier'
const REDIRECT_KEY = 'rigour_oidc_return_path'
const NONCE_KEY = 'rigour_oidc_nonce'
const LOGOUT_PENDING_KEY = 'rigour_oidc_logout_pending'

let accessToken: string | null = null
let idToken: string | null = null

export interface OidcLoginOptions {
  /** 要求IAM重新显示登录表单，避免退出后复用旧浏览器会话。 */
  prompt?: 'login'
}

function config() {
  const issuer = import.meta.env.VITE_OIDC_ISSUER?.replace(/\/$/, '')
  const clientId = import.meta.env.VITE_OIDC_CLIENT_ID
  const redirectUri = import.meta.env.VITE_OIDC_REDIRECT_URI || `${window.location.origin}/oidc/callback`
  const postLogoutRedirectUri =
    import.meta.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI || `${window.location.origin}/`
  if (!issuer || !clientId || !isAllowedOidcUrl(issuer) || !isAllowedOidcUrl(redirectUri)
    || !isAllowedOidcUrl(postLogoutRedirectUri)) {
    throw new Error('OIDC 配置不完整：仅允许 HTTPS，开发模式额外允许 localhost loopback HTTP')
  }
  return { issuer, clientId, redirectUri, postLogoutRedirectUri }
}

function isAllowedOidcUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol === 'https:') return true
    return import.meta.env.DEV && url.protocol === 'http:'
      && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  } catch {
    return false
  }
}

function randomUrlSafe(bytes: number): string {
  const value = new Uint8Array(bytes)
  crypto.getRandomValues(value)
  return base64Url(value)
}

function base64Url(value: Uint8Array): string {
  let binary = ''
  value.forEach((item) => {
    binary += String.fromCharCode(item)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const verifier = randomUrlSafe(48)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return { verifier, challenge: base64Url(new Uint8Array(digest)) }
}

export function safeReturnPath(value: string | null | undefined): string {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/apps'
}

export async function beginOidcLogin(
  returnPath = '/apps',
  options: OidcLoginOptions = {},
): Promise<void> {
  // 用户明确点击重新登录时，解除退出后的暂停标记。
  sessionStorage.removeItem(LOGOUT_PENDING_KEY)
  const { issuer, clientId, redirectUri } = config()
  devInfo('开始OIDC登录', {
    issuer,
    clientId,
    redirectUri,
    returnPath: safeReturnPath(returnPath),
    prompt: options.prompt ?? '-',
  })
  const state = randomUrlSafe(32)
  const nonce = randomUrlSafe(32)
  const { verifier, challenge } = await createPkcePair()
  sessionStorage.setItem(STATE_KEY, state)
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(REDIRECT_KEY, safeReturnPath(returnPath))
  sessionStorage.setItem(NONCE_KEY, nonce)
  const url = new URL(`${issuer}/oauth2/authorize`)
  const parameters = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    nonce,
  })
  if (options.prompt) parameters.set('prompt', options.prompt)
  url.search = parameters.toString()
  window.location.assign(url)
}

export function isOidcCallback(): boolean {
  return window.location.pathname.endsWith('/oidc/callback')
}

export async function completeOidcCallback(): Promise<string | null> {
  if (!isOidcCallback()) return null
  devInfo('开始处理OIDC回调')
  const parameters = new URLSearchParams(window.location.search)
  const expectedState = sessionStorage.getItem(STATE_KEY)
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  const expectedNonce = sessionStorage.getItem(NONCE_KEY)
  const code = parameters.get('code')
  const state = parameters.get('state')
  const error = parameters.get('error')
  try {
    if (error || !code || !state || state !== expectedState || !verifier || !expectedNonce) {
      throw new Error('OIDC 回调校验失败')
    }
    const { issuer, clientId, redirectUri } = config()
    const response = await fetch(`${issuer}/oauth2/token`, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        redirect_uri: redirectUri,
        code,
        code_verifier: verifier,
      }),
    })
    if (!response.ok) throw new Error(`OIDC Token 交换失败：${response.status}`)
    const tokens = (await response.json()) as OidcTokenResponse
    if (!tokens.access_token || !tokens.id_token || tokens.token_type.toLowerCase() !== 'bearer') {
      throw new Error('OIDC Token 响应不完整')
    }
    await validateIdToken(tokens.id_token, issuer, clientId, expectedNonce)
    accessToken = tokens.access_token
    idToken = tokens.id_token
    devInfo('OIDC回调完成，Token已保存在当前页面内存')
    return safeReturnPath(sessionStorage.getItem(REDIRECT_KEY))
  } catch (error) {
    devWarn('OIDC回调处理失败', { message: error instanceof Error ? error.message : error })
    throw error
  } finally {
    sessionStorage.removeItem(STATE_KEY)
    sessionStorage.removeItem(VERIFIER_KEY)
    sessionStorage.removeItem(REDIRECT_KEY)
    sessionStorage.removeItem(NONCE_KEY)
  }
}

interface OidcDiscovery {
  issuer: string
  jwks_uri: string
}

interface JsonWebKeySet {
  keys: JsonWebKey[]
}

interface IdTokenClaims {
  iss?: string
  sub?: string
  aud?: string | string[]
  azp?: string
  exp?: number
  iat?: number
  nonce?: string
}

async function validateIdToken(token: string, issuer: string, clientId: string, nonce: string): Promise<void> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('ID Token 格式无效')
  const header = decodeJwtPart<{ alg?: string; kid?: string }>(parts[0]!)
  const claims = decodeJwtPart<IdTokenClaims>(parts[1]!)
  if (header.alg !== 'RS256' || !header.kid) throw new Error('ID Token 签名算法无效')
  validateIdTokenClaims(claims, issuer, clientId, nonce, Math.floor(Date.now() / 1000))

  const discoveryResponse = await fetch(`${issuer}/.well-known/openid-configuration`, {
    headers: { Accept: 'application/json' }, credentials: 'omit',
  })
  if (!discoveryResponse.ok) throw new Error('无法读取OIDC Discovery')
  const discovery = (await discoveryResponse.json()) as OidcDiscovery
  if (discovery.issuer !== issuer || !isAllowedJwksUri(discovery.jwks_uri, issuer)) {
    throw new Error('OIDC Discovery不可信')
  }
  const jwksResponse = await fetch(discovery.jwks_uri, { headers: { Accept: 'application/json' }, credentials: 'omit' })
  if (!jwksResponse.ok) throw new Error('无法读取OIDC JWKS')
  const jwks = (await jwksResponse.json()) as JsonWebKeySet
  const jwk = jwks.keys.find((key) => key.kid === header.kid && key.kty === 'RSA'
    && (!key.alg || key.alg === 'RS256') && (!key.use || key.use === 'sig'))
  if (!jwk) throw new Error('找不到ID Token签名公钥')
  const key = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'],
  )
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', key, decodeBase64Url(parts[2]!),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  )
  if (!valid) throw new Error('ID Token签名无效')
}

export function validateIdTokenClaims(
  claims: IdTokenClaims, issuer: string, clientId: string, nonce: string, now: number,
): void {
  const audiences = typeof claims.aud === 'string' ? [claims.aud] : claims.aud
  if (claims.iss !== issuer || !claims.sub || !audiences?.includes(clientId)
    || (audiences.length > 1 && claims.azp !== clientId)
    || typeof claims.exp !== 'number' || claims.exp <= now
    || typeof claims.iat !== 'number' || claims.iat > now + 60
    || claims.nonce !== nonce) {
    throw new Error('ID Token声明校验失败')
  }
}

function isAllowedJwksUri(value: string, issuer: string): boolean {
  try {
    const jwks = new URL(value)
    const configuredIssuer = new URL(issuer)
    return jwks.origin === configuredIssuer.origin && isAllowedOidcUrl(jwks.toString())
  } catch {
    return false
  }
}

function decodeJwtPart<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

export function getAccessToken(): string | null {
  return accessToken
}

export function clearOidcTokens(): void {
  accessToken = null
  idToken = null
}

/** 标记一次跨域OIDC退出，防止退出回到Portal后立即静默重新登录。 */
function markLogoutPending(): void {
  sessionStorage.setItem(LOGOUT_PENDING_KEY, '1')
}

/** 仅消费一次退出标记；刷新登录页不会重复显示退出提示。 */
export function consumeLogoutPending(): boolean {
  const pending = sessionStorage.getItem(LOGOUT_PENDING_KEY) === '1'
  sessionStorage.removeItem(LOGOUT_PENDING_KEY)
  return pending
}

export function beginOidcLogout(): void {
  const { issuer, postLogoutRedirectUri } = config()
  const currentIdToken = idToken
  markLogoutPending()
  clearOidcTokens()
  if (!currentIdToken) {
    window.location.assign('/#/login?reason=logout')
    return
  }
  const url = new URL(`${issuer}/connect/logout`)
  url.search = new URLSearchParams({
    id_token_hint: currentIdToken,
    post_logout_redirect_uri: postLogoutRedirectUri,
  }).toString()
  window.location.assign(url)
}
