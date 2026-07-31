/** 兼容API层的内存Access Token门面；禁止把Token写入Web Storage。 */
import { clearOidcTokens, getAccessToken } from '@/auth/oidc'

export function getToken(): string | null {
  return getAccessToken()
}

export function removeToken(): void {
  clearOidcTokens()
}
