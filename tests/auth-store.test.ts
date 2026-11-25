import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
const mocks = vi.hoisted(() => ({ logout: vi.fn(), remove: vi.fn(), error: vi.fn() }))
vi.mock('@/auth/browser-session', () => ({ logoutBrowserSession: mocks.logout }))
vi.mock('@/utils/token', () => ({ getToken: () => null, removeToken: mocks.remove }))
vi.mock('element-plus', () => ({ ElMessage: { error: mocks.error } }))
import { useAuthStore } from '@/stores/auth'
import { useSupplyAuthorizationStore } from '@/stores/supply-authorization'
import {
  copyPayrollInterval,
  copyPayrollIntervalGroup,
  readCopiedPayrollInterval,
  readCopiedPayrollIntervalGroup,
} from '@/utils/payroll-coefficient-clipboard'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  window.history.replaceState({}, '', '/')
})
describe('退出与后端会话一致', () => {
  it('后端撤销会话成功后清理本地状态并进入登录页', async () => {
    const auth = useAuthStore()
    const interval = {
      lower: 0,
      upper: null,
      lowerInclusive: true,
      upperInclusive: false,
      mode: 'FIXED',
      coefficient: 1.9,
    }
    copyPayrollInterval(interval)
    copyPayrollIntervalGroup([interval])
    const calls: string[] = []
    mocks.logout.mockImplementation(async () => {
      calls.push('revoke-session')
    })
    mocks.remove.mockImplementation(() => {
      calls.push('clear-local')
    })
    await auth.logout()
    expect(calls).toEqual(['revoke-session', 'clear-local'])
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.user).toBeNull()
    expect(readCopiedPayrollInterval()).toBeNull()
    expect(readCopiedPayrollIntervalGroup()).toBeNull()
    expect(window.location.hash).toBe('#/login?reason=logout')
  })
  it('撤销失败时提示重试，不假装退出成功', async () => {
    mocks.logout.mockRejectedValue(new Error('offline'))
    await useAuthStore().logout()
    expect(mocks.error).toHaveBeenCalledOnce()
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(window.location.hash).toBe('')
  })
})

it('授权上下文刷新后，当前会话显示关联员工的新姓名', () => {
  const auth = useAuthStore()
  const supply = useSupplyAuthorizationStore()
  auth.user = { id: 'employee', username: 'login', displayName: '旧姓名', principalScope: 'TENANT', tenantId: 'tenant', tenantName: '公司', roles: [], permissions: [] }
  supply.context = { initialized: true, canInitialize: false, mode: 'ACTIVE', version: 1, permissions: [], memberDisplayName: '关联员工姓名' }
  expect(auth.user?.displayName).toBe('关联员工姓名')
  supply.context = { ...supply.context, memberDisplayName: '改名后的员工' }
  expect(auth.user?.displayName).toBe('改名后的员工')
})
