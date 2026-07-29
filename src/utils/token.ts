/**
 * Token 存取工具（过渡方案）
 *
 * ⚠️ 安全风险：
 * localStorage 存储 token 受 XSS 攻击影响。
 * 生产环境应使用 HttpOnly + SameSite=Strict Cookie，由后端 Set-Cookie 管理。
 * 本模块仅用于开发、测试和 MVP 过渡阶段，接入统一认证后应废弃。
 *
 * 职责：提供 token 的存取接口，隔离存储实现细节。
 * 边界：不处理 token 过期判断、刷新逻辑，这些在 authStore 中实现。
 */

const TOKEN_KEY = 'portal_access_token'
const REFRESH_TOKEN_KEY = 'portal_refresh_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token)
}
