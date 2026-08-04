/** 兼容API层的内存Access Token门面；禁止把Token写入Web Storage。 */
import { clearOidcTokens, getAccessToken } from '@/auth/oidc'

export function getToken(): string | null {
  return getAccessToken()
}

/** 为所有受保护的 Portal API 请求生成统一认证头。 */
export function getAuthorizationHeader(): string | null {
  const token = getToken()
  return token ? `Bearer ${token}` : null
}

export function removeToken(): void {
  clearOidcTokens()
}
