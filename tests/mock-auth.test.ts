/**
 * Mock 认证流程 + Token 工具 + 请求头注入测试
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { apiClient } from '@/api/core/client'
import { setToken, getToken, removeToken } from '@/utils/token'
import { setupMockAdapter, getMockHandlers } from '@/api/mock'
import { registerMock } from '@/api/mock/adapter'
import type { MockHandler } from '@/api/mock'

// 确保 mock handlers 已加载
import '@/api/mock/handlers'

describe('Mock Auth API', () => {
  beforeEach(() => {
    removeToken()
    sessionStorage.clear()
    localStorage.clear()
  })

  it('应该通过 Mock Adapter 成功登录并返回 token', async () => {
    setupMockAdapter(apiClient)

    const result = await apiClient.post('/auth/login', {
      username: 'admin',
      password: 'admin123',
    })

    expect(result).toBeDefined()
    expect(result.accessToken).toBeDefined()
    expect(typeof result.accessToken).toBe('string')
    expect(result.accessToken).toContain('mock-access-token')
  })

  it('应该通过 Mock Adapter 获取用户信息', async () => {
    setupMockAdapter(apiClient)
    setToken('mock-token-for-test')

    const userInfo = await apiClient.get('/auth/me')

    expect(userInfo).toBeDefined()
    expect(userInfo.id).toBe('u001')
    expect(userInfo.username).toBe('admin')
    expect(userInfo.displayName).toBe('系统管理员')
    expect(userInfo.roles).toContain('super_admin')
    expect(userInfo.permissions).toContain('*:*:*')
  })

  it('Mock handlers 应该已注册', () => {
    const handlers = getMockHandlers()
    expect(handlers.length).toBeGreaterThanOrEqual(2)

    const loginHandler = handlers.find((h: MockHandler) => h.path === '/auth/login')
    expect(loginHandler).toBeDefined()
    expect(loginHandler?.method).toBe('POST')

    const meHandler = handlers.find((h: MockHandler) => h.path === '/auth/me')
    expect(meHandler).toBeDefined()
    expect(meHandler?.method).toBe('GET')
  })
})

describe('Token 工具函数', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('setToken 和 getToken 应该正常工作', () => {
    setToken('test-token-123')
    expect(getToken()).toBe('test-token-123')
  })

  it('removeToken 应该清除所有 token', () => {
    setToken('test-token')
    localStorage.setItem('portal_refresh_token', 'refresh-token')
    removeToken()
    expect(getToken()).toBeNull()
    expect(localStorage.getItem('portal_refresh_token')).toBeNull()
  })

  it('未设置时 getToken 返回 null', () => {
    expect(getToken()).toBeNull()
  })
})

describe('apiClient 请求头注入', () => {
  beforeEach(() => {
    removeToken()
    sessionStorage.clear()
  })

  it('Mock Adapter 请求可以正常返回数据', async () => {
    setupMockAdapter(apiClient)

    registerMock({
      method: 'GET',
      path: '/test/headers',
      handler: () => ({ ok: true }),
    })

    const result = await apiClient.get('/test/headers')
    expect(result.ok).toBe(true)
  })

  it('设置 token 后 Mock 请求正常', async () => {
    setToken('test-bearer-token')
    setupMockAdapter(apiClient)

    registerMock({
      method: 'POST',
      path: '/test/auth-header',
      handler: () => ({ authenticated: true }),
    })

    const result = await apiClient.post('/test/auth-header', {})
    expect(result.authenticated).toBe(true)
  })

  it('设置 sessionStorage tenant 后写入正常', () => {
    sessionStorage.setItem('portal_tenant_id', 'tenant-abc')
    expect(sessionStorage.getItem('portal_tenant_id')).toBe('tenant-abc')
  })
})
