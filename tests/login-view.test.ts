import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginView from '@/views/login/LoginView.vue'

const mocks = vi.hoisted(() => ({
  login: vi.fn(), replace: vi.fn(), query: {} as Record<string, string>,
}))
vi.mock('@/stores', () => ({ useAuthStore: () => ({ isAuthenticated: false, login: mocks.login }) }))
vi.mock('@/auth/oidc', () => ({ consumeLogoutPending: () => false }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: mocks.query }), useRouter: () => ({ replace: mocks.replace }) }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.query = {}
  mocks.login.mockRejectedValue(new Error('unavailable'))
})

describe('login retry parameters', () => {
  it('initial login is silent; a real retry click explicitly forces login with a boolean', async () => {
    mocks.query.redirect = '/supply-chain/bi'
    const wrapper = mount(LoginView)
    await flushPromises()
    expect(mocks.login).toHaveBeenLastCalledWith('/supply-chain/bi', false)
    await wrapper.get('button.retry').trigger('click')
    await flushPromises()
    expect(mocks.login).toHaveBeenLastCalledWith('/supply-chain/bi', true)
    expect(mocks.login).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('callback failure waits for manual retry without an automatic login loop', async () => {
    mocks.query.reason = 'oidc_callback_failed'
    const wrapper = mount(LoginView)
    await flushPromises()
    expect(mocks.login).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain('回调校验失败')
    await wrapper.get('button.retry').trigger('click')
    await flushPromises()
    expect(mocks.login).toHaveBeenCalledWith('/apps', true)
    wrapper.unmount()
  })
})
