import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LoginView from '@/views/login/LoginView.vue'

const mocks = vi.hoisted(() => ({
  login: vi.fn(), replace: vi.fn(), session: vi.fn(), submit: vi.fn(), origin: vi.fn(),
  query: {} as Record<string, string>, authenticated: false,
}))
vi.mock('@/stores', () => ({ useAuthStore: () => ({ isAuthenticated: mocks.authenticated, login: mocks.login }) }))
vi.mock('@/auth/oidc', () => ({ assertOidcBrowserOrigin: mocks.origin }))
vi.mock('@/auth/browser-session', () => ({ readBrowserSession: mocks.session, submitBrowserLogin: mocks.submit }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: mocks.query }), useRouter: () => ({ replace: mocks.replace }) }))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.query = {}; mocks.authenticated = false
  mocks.session.mockResolvedValue({ authenticated: false })
})

async function fillAndSubmit(wrapper: ReturnType<typeof mount>) {
  await wrapper.get('input[name="tenantCode"]').setValue('test-tenant')
  await wrapper.get('input[name="username"]').setValue('sales')
  await wrapper.get('input[name="password"]').setValue('test-password')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

describe('SCDP 常规登录流程', () => {
  it('首次访问直接显示前端登录表单，不发起授权跳转', async () => {
    const wrapper = mount(LoginView); await flushPromises()
    expect(wrapper.findAll('input')).toHaveLength(3)
    expect(wrapper.text()).toContain('瑞盖供应链数字化平台')
    expect(mocks.login).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('后端未启动仍能显示表单和错误提示', async () => {
    mocks.session.mockRejectedValue(new Error('登录服务暂时不可用'))
    const wrapper = mount(LoginView); await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('暂时不可用')
    expect(wrapper.find('form').exists()).toBe(true)
    expect(mocks.login).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('密码校验成功后才完成授权，忽略旧跳转目标并清空密码', async () => {
    mocks.query.redirect = '/supply-chain/bi'
    const wrapper = mount(LoginView); await flushPromises(); await fillAndSubmit(wrapper)
    expect(mocks.submit).toHaveBeenCalledWith({ tenantCode: 'test-tenant', username: 'sales', password: 'test-password' })
    expect(mocks.login).toHaveBeenCalledWith()
    expect((wrapper.get('input[name="password"]').element as HTMLInputElement).value).toBe('')
    wrapper.unmount()
  })
  it('账号错误停留在表单，清空密码且不发起授权', async () => {
    mocks.submit.mockRejectedValue(new Error('企业编码、用户名或密码不正确'))
    const wrapper = mount(LoginView); await flushPromises(); await fillAndSubmit(wrapper)
    expect(wrapper.get('[role="alert"]').text()).toContain('不正确')
    expect(mocks.login).not.toHaveBeenCalled()
    expect((wrapper.get('input[name="password"]').element as HTMLInputElement).value).toBe('')
    wrapper.unmount()
  })
  it('有效服务器会话可恢复登录，无需重新填写密码', async () => {
    mocks.session.mockResolvedValue({ authenticated: true })
    const wrapper = mount(LoginView); await flushPromises()
    expect(mocks.login).toHaveBeenCalledOnce()
    expect(mocks.submit).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('内存中已有登录状态时直接进入首页', async () => {
    mocks.authenticated = true
    const wrapper = mount(LoginView); await flushPromises()
    expect(mocks.replace).toHaveBeenCalledWith('/supply-chain')
    expect(mocks.login).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it.each(['logout', 'oidc_callback_failed', 'reauthenticate', 'session_expired', 'service_unavailable'])('%s 后停留在表单，不自动重登或循环', async (reason) => {
    mocks.query.reason = reason; mocks.session.mockResolvedValue({ authenticated: true })
    const wrapper = mount(LoginView); await flushPromises()
    expect(mocks.login).not.toHaveBeenCalled()
    wrapper.unmount()
  })
  it('访问端口与回调地址不一致时不提交密码', async () => {
    mocks.origin.mockImplementation(() => { throw new Error('当前访问地址与登录配置不一致') })
    const wrapper = mount(LoginView); await flushPromises(); await fillAndSubmit(wrapper)
    expect(wrapper.get('[role="alert"]').text()).toContain('地址与登录配置不一致')
    expect(mocks.submit).not.toHaveBeenCalled()
    expect(mocks.login).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
