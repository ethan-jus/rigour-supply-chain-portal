import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const oidcMocks = vi.hoisted(() => ({
  calls: [] as string[],
  beginOidcLogin: vi.fn(),
  beginOidcLogout: vi.fn(() => oidcMocks.calls.push('iam-logout')),
}))

const tokenMocks = vi.hoisted(() => ({
  getToken: vi.fn(() => null),
  removeToken: vi.fn(() => oidcMocks.calls.push('local-clear')),
}))

vi.mock('@/auth/oidc', () => ({
  beginOidcLogin: oidcMocks.beginOidcLogin,
  beginOidcLogout: oidcMocks.beginOidcLogout,
}))

vi.mock('@/utils/token', () => ({
  getToken: tokenMocks.getToken,
  removeToken: tokenMocks.removeToken,
}))

import { useAuthStore } from '@/stores/auth'

describe('认证Store退出链路', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    oidcMocks.calls.length = 0
    oidcMocks.beginOidcLogout.mockClear()
    tokenMocks.removeToken.mockClear()
  })

  it('先发起IAM OIDC退出再清理Portal本地会话', () => {
    const authStore = useAuthStore()
    authStore.user = {
      id: 'tenant-user-1', principalScope: 'TENANT', username: 'tenant-admin',
      displayName: '租户管理员', roles: ['SUPER_ADMIN'], permissions: ['*:*:*'],
      tenantId: 'tenant-1', tenantName: '测试租户',
    }
    ;(authStore as unknown as Record<string, boolean>).isAuthenticated = true

    authStore.logout()

    expect(oidcMocks.calls).toEqual(['iam-logout', 'local-clear'])
    expect(authStore.isAuthenticated).toBe(false)
    expect(authStore.user).toBeNull()
  })
})
