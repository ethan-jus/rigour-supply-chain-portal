import { devInfo, devWarn } from '@/utils/dev-log'
import { allowDevelopmentHttp, sha256, verifyRs256 } from './oidc-crypto'

interface OidcTokenResponse {
  access_token: string
  refresh_token: string
  id_token?: string
  token_type: string
  expires_in: number
}

const STATE_KEY = 'rigour_oidc_state'
const VERIFIER_KEY = 'rigour_oidc_code_verifier'
const NONCE_KEY = 'rigour_oidc_nonce'
const LANDING_PATH_KEY = 'rigour_oidc_landing_path'
const ACCESS_TOKEN_EXPIRY_SAFETY_WINDOW_MS = 5_000

let accessToken: string | null = null
let accessTokenExpiresAt: number | null = null
let refreshToken: string | null = null
let tokenGeneration = 0
let refreshInFlight: Promise<string> | null = null
let refreshController: AbortController | null = null

export class TokenRefreshError extends Error {
  constructor(
    public readonly code: 'IAM_TOKEN_INVALID' | 'IAM_UNAVAILABLE' | 'REQUEST_CANCELLED',
    message: string,
  ) {
    super(message)
    this.name = 'TokenRefreshError'
  }
}

function validTokens(tokens: Partial<OidcTokenResponse>): tokens is OidcTokenResponse {
  return typeof tokens.access_token === 'string' && !!tokens.access_token
    && typeof tokens.refresh_token === 'string' && !!tokens.refresh_token
    && typeof tokens.token_type === 'string' && tokens.token_type.toLowerCase() === 'bearer'
    && typeof tokens.expires_in === 'number' && Number.isFinite(tokens.expires_in) && tokens.expires_in > 0
}

function saveTokens(tokens: OidcTokenResponse, requestedAt: number): void {
  accessToken = tokens.access_token
  refreshToken = tokens.refresh_token
  accessTokenExpiresAt = requestedAt + tokens.expires_in * 1000
}

function config() {
  const issuer = import.meta.env.VITE_OIDC_ISSUER?.replace(/\/$/, '')
  const clientId = import.meta.env.VITE_OIDC_CLIENT_ID
  const redirectUri = import.meta.env.VITE_OIDC_REDIRECT_URI || `${window.location.origin}/oidc/callback`
  if (!issuer || !clientId || !isAllowedOidcUrl(issuer) || !isAllowedOidcUrl(redirectUri)) {
    throw new Error('OIDC 配置不完整：开发环境允许 HTTP，正式环境需要 HTTPS')
  }
  return { issuer, clientId, redirectUri }
}

/** 回调地址不可跨 Web 实例，否则 state 和 PKCE verifier 会落在另一个端口。 */
export function assertOidcBrowserOrigin(): void {
  const { redirectUri } = config()
  if (new URL(redirectUri).origin !== window.location.origin) {
    throw new Error(`当前访问地址与登录配置不一致，请从 ${new URL(redirectUri).origin}/ 打开系统。`)
  }
}

function browserAuthUrl(path: string): string {
  return new URL(`/auth${path}`, window.location.origin).toString()
}

export function isAllowedOidcUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.username || url.password || url.hash) return false
    if (url.protocol === 'https:') return true
    return allowDevelopmentHttp() && url.protocol === 'http:'
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
  return { verifier, challenge: base64Url(await sha256(verifier)) }
}

export function safeReturnPath(value: string | null | undefined): string {
  return value && /^\/supply-chain(?:[/?#]|$)/.test(value) && !value.includes('\\')
    ? value : '/supply-chain'
}

/** 只由启动阶段恢复既有会话时传入站内地址；主动登录默认进入首页。 */
export async function beginOidcLogin(restorePath?: string): Promise<void> {
  assertOidcBrowserOrigin()
  const { issuer, clientId, redirectUri } = config()
  devInfo('开始OIDC登录', {
    issuer,
    clientId,
    redirectUri,
  })
  const state = randomUrlSafe(32)
  const nonce = randomUrlSafe(32)
  const { verifier, challenge } = await createPkcePair()
  sessionStorage.setItem(STATE_KEY, state)
  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(NONCE_KEY, nonce)
  sessionStorage.setItem(LANDING_PATH_KEY, safeReturnPath(restorePath))
  const url = new URL(browserAuthUrl('/oauth2/authorize'))
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
  url.search = parameters.toString()
  window.location.assign(url)
}

export function takeOidcLandingPath(): string {
  const path = safeReturnPath(sessionStorage.getItem(LANDING_PATH_KEY))
  sessionStorage.removeItem(LANDING_PATH_KEY)
  return path
}

export function isOidcCallback(): boolean {
  return window.location.pathname.endsWith('/oidc/callback')
}

export async function completeOidcCallback(): Promise<boolean> {
  if (!isOidcCallback()) return false
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
    const generation = tokenGeneration
    const requestedAt = Date.now()
    const response = await fetch(browserAuthUrl('/oauth2/token'), {
      method: 'POST',
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
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
    if (!tokens || !validTokens(tokens) || typeof tokens.id_token !== 'string' || !tokens.id_token) {
      throw new Error('OIDC Token 响应不完整')
    }
    await validateIdToken(tokens.id_token, issuer, clientId, expectedNonce)
    if (generation !== tokenGeneration) throw new TokenRefreshError('REQUEST_CANCELLED', '登录操作已取消')
    saveTokens(tokens, requestedAt)
    devInfo('OIDC回调完成，Token已保存在当前页面内存')
    return true
  } catch (error) {
    sessionStorage.removeItem(LANDING_PATH_KEY)
    devWarn('OIDC回调处理失败', { message: error instanceof Error ? error.message : error })
    throw error
  } finally {
    sessionStorage.removeItem(STATE_KEY)
    sessionStorage.removeItem(VERIFIER_KEY)
    sessionStorage.removeItem(NONCE_KEY)
  }
}

interface OidcDiscovery {
  issuer: string
  jwks_uri: string
}

interface JsonWebKeySet {
  keys: (JsonWebKey & { kid?: string })[]
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

  const discoveryResponse = await fetch(browserAuthUrl('/.well-known/openid-configuration'), {
    headers: { Accept: 'application/json' }, credentials: 'omit',
  })
  if (!discoveryResponse.ok) throw new Error('无法读取OIDC Discovery')
  const discovery = (await discoveryResponse.json()) as OidcDiscovery
  if (discovery.issuer !== issuer || !isAllowedJwksUri(discovery.jwks_uri, issuer)) {
    throw new Error('OIDC Discovery不可信')
  }
  if (new URL(discovery.jwks_uri).pathname !== '/oauth2/jwks') throw new Error('OIDC JWKS路径不可信')
  const jwksResponse = await fetch(browserAuthUrl('/oauth2/jwks'), { headers: { Accept: 'application/json' }, credentials: 'omit' })
  if (!jwksResponse.ok) throw new Error('无法读取OIDC JWKS')
  const jwks = (await jwksResponse.json()) as JsonWebKeySet
  const jwk = jwks.keys.find((key) => key.kid === header.kid && key.kty === 'RSA'
    && (!key.alg || key.alg === 'RS256') && (!key.use || key.use === 'sig'))
  if (!jwk) throw new Error('找不到ID Token签名公钥')
  const valid = await verifyRs256(jwk, decodeBase64Url(parts[2]!), `${parts[0]}.${parts[1]}`)
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
  if (accessToken && accessTokenExpiresAt !== null
    && Date.now() >= accessTokenExpiresAt - ACCESS_TOKEN_EXPIRY_SAFETY_WINDOW_MS) {
    return null
  }
  return accessToken
}

export function hasRefreshToken(): boolean {
  return refreshToken !== null
}

/** 轮换 Token 不改变代次；退出后旧请求不能再操作新登录会话。 */
export function getSessionGeneration(): number {
  return tokenGeneration
}

/**
 * 请求及路由共用同一次刷新；迟到的旧 Token 401 直接使用已更新的 Token。
 * 不使用定时心跳延长闲置登录，也不把任何 Token 写入 Web Storage。
 */
export async function ensureAccessToken(rejectedToken?: string): Promise<string | null> {
  const current = getAccessToken()
  if (current && (!rejectedToken || current !== rejectedToken)) return current
  if (refreshInFlight) return refreshInFlight
  if (!refreshToken) return null

  const generation = tokenGeneration
  const previousRefreshToken = refreshToken
  const controller = new AbortController()
  refreshController = controller
  const timeout = setTimeout(() => controller.abort(), 10_000)
  const requestedAt = Date.now()
  const pending = (async () => {
    try {
      const response = await fetch(browserAuthUrl('/oauth2/token'), {
        method: 'POST', credentials: 'omit', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({
          grant_type: 'refresh_token', client_id: config().clientId, refresh_token: previousRefreshToken,
        }),
      })
      const tokens = await response.json()
      if (generation !== tokenGeneration) throw new TokenRefreshError('REQUEST_CANCELLED', '会话已变更')
      if (!response.ok) {
        if (response.status === 400 && tokens?.error === 'invalid_grant') {
          clearOidcTokens()
          throw new TokenRefreshError('IAM_TOKEN_INVALID', '登录状态已过期，请重新登录。')
        }
        throw new TokenRefreshError('IAM_UNAVAILABLE', '登录续期暂时不可用，请稍后重试。')
      }
      if (!tokens || !validTokens(tokens) || tokens.refresh_token === previousRefreshToken) {
        throw new TokenRefreshError('IAM_UNAVAILABLE', '登录续期响应无效，请联系管理员。')
      }
      saveTokens(tokens, requestedAt)
      return tokens.access_token
    } catch (error) {
      if (error instanceof TokenRefreshError) throw error
      if (generation !== tokenGeneration) throw new TokenRefreshError('REQUEST_CANCELLED', '会话已变更')
      throw new TokenRefreshError('IAM_UNAVAILABLE', '登录续期暂时不可用，请检查网络后重试。')
    }
  })().finally(() => {
    clearTimeout(timeout)
    if (generation === tokenGeneration) {
      refreshInFlight = null
      refreshController = null
    }
  })
  refreshInFlight = pending
  return pending
}

export function clearOidcTokens(): void {
  tokenGeneration++
  refreshController?.abort()
  refreshController = null
  refreshInFlight = null
  accessToken = null
  accessTokenExpiresAt = null
  refreshToken = null
}
