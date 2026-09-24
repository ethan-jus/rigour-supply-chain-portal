import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import ConsoleAccountMenu from '@/components/console/ConsoleAccountMenu.vue'

const mocks = vi.hoisted(() => ({ post: vi.fn(), logout: vi.fn(), clear: vi.fn() }))
vi.mock('@/api/core', () => ({ apiClient: { post: mocks.post } }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { displayName: '管理员' }, logout: mocks.logout, clearLocalSession: mocks.clear }) }))
let wrapper: VueWrapper
beforeEach(() => {
  vi.resetAllMocks()
  window.history.replaceState({}, '', '/')
  wrapper = mount(ConsoleAccountMenu, { attachTo: document.body, global: { plugins: [ElementPlus] } })
})
afterEach(() => { wrapper.unmount(); document.body.innerHTML = '' })
async function openPassword() {
  await wrapper.get('[aria-label="账号菜单"]').trigger('click')
  await flushPromises()
  const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(el => el.textContent?.includes('修改密码'))!
  item.click()
  await flushPromises()
}
async function fill(index: number, value: string) {
  const input = document.querySelectorAll<HTMLInputElement>('.el-dialog input')[index]!
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
}
async function submit() {
  const button = [...document.querySelectorAll<HTMLButtonElement>('.el-dialog button')].find(el => el.textContent?.includes('确认修改'))!
  button.click()
  await flushPromises()
}

describe('账号菜单和个人修改密码', () => {
  it('点击账号才显示选项，退出复用现有会话退出流程', async () => {
    expect(wrapper.get('[aria-label="账号菜单"]').attributes('aria-expanded')).toBe('false')
    await wrapper.get('[aria-label="账号菜单"]').trigger('click')
    await flushPromises()
    const items = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    expect(items.map(el => el.textContent?.trim())).toEqual(['修改密码', '退出登录'])
    items[1]!.click()
    expect(mocks.logout).toHaveBeenCalledOnce()
  })
  it('确认密码不一致时留在弹窗，阻止提交', async () => {
    await openPassword()
    await fill(0, 'Old!1234'); await fill(1, 'New!5678'); await fill(2, 'New!5679')
    await submit()
    expect(document.body.textContent).toContain('两次输入的新密码不一致')
    expect(mocks.post).not.toHaveBeenCalled()
  })
  it('后端错误显示在弹窗内且不清除登录状态', async () => {
    mocks.post.mockRejectedValue({ code: 'VALIDATION_ERROR', message: '原密码不正确' })
    await openPassword()
    await fill(0, 'Old!1234'); await fill(1, 'New!5678'); await fill(2, 'New!5678')
    await submit()
    expect(document.body.textContent).toContain('原密码不正确')
    expect(mocks.clear).not.toHaveBeenCalled()
  })
  it('修改成功清理本地会话，回到登录页', async () => {
    mocks.post.mockResolvedValue(undefined)
    await openPassword()
    await fill(0, 'Old!1234'); await fill(1, 'New!5678'); await fill(2, 'New!5678')
    await submit()
    expect(mocks.post).toHaveBeenCalledWith('/scdp/password', { currentPassword: 'Old!1234', newPassword: 'New!5678' })
    expect(mocks.clear).toHaveBeenCalledOnce()
    expect(window.location.hash).toBe('#/login?reason=password_changed')
  })
})
