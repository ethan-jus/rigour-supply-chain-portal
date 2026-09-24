import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElMessage, ElMessageBox } from 'element-plus'
import UserView from '@/views/supply-chain/settings/UserView.vue'
import RoleMembersDrawer from '@/views/supply-chain/settings/RoleMembersDrawer.vue'
import RoleView from '@/views/supply-chain/settings/RoleView.vue'
import {
  supplyAccessApi,
  type SupplyMember,
  type SupplyRole,
  type SupplyRoleImpact,
} from '@/api/core/supply-settings'
const access = vi.hoisted(() => ({
  can: vi.fn().mockReturnValue(true),
  refresh: vi.fn(),
  context: { mode: 'ACTIVE' },
}))
vi.mock('@/stores/supply-authorization', () => ({ useSupplyAuthorizationStore: () => access }))
vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { id: 'self' } }) }))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => false }),
}))
vi.mock('@/api/core/supply-settings', () => ({
  supplySettingsApi: {},
  supplyAccessApi: {
    members: vi.fn(),
    references: vi.fn(),
    memberRoles: vi.fn(),
    roles: vi.fn(),
    menus: vi.fn(),
    saveRole: vi.fn(),
    roleImpact: vi.fn(),
    deleteRole: vi.fn(),
    memberStatus: vi.fn(),
    deleteMember: vi.fn(),
    saveMember: vi.fn(),
  },
}))
let wrapper: VueWrapper
const role: SupplyRole = {
  id: 'r1',
  code: 'SALES',
  name: '销售',
  description: null,
  status: 'ACTIVE',
  version: 2,
  protectedRole: false,
  userCount: 1,
  menuNodeIds: [],
  rules: [],
}
const member = {
  id: 'self',
  username: 'admin',
  name: '当前管理员',
  employeeCode: 'E1',
  status: 'ACTIVE',
  kind: 'BUSINESS',
  version: 2,
  roles: [{ roleId: 'r1', parameters: {} }],
} as unknown as SupplyMember
const impact: SupplyRoleImpact = {
  id: 'r1',
  version: 2,
  status: 'ACTIVE',
  userCount: 1,
  usernames: ['zhangsan'],
  activeUserCount: 1,
  lastRoleUsernames: [],
  managementEntryUsernames: [],
  canDisable: true,
  canDelete: false,
}
async function render(component: typeof UserView | typeof RoleView) {
  wrapper = mount(component, {
    attachTo: document.body,
    global: {
      plugins: [ElementPlus],
      stubs: {
        teleport: true,
        SupplyPageTitle: { template: '<h1><slot /></h1>' },
        ScopeReferencePicker: true,
        RoleAssignmentEditor: true,
        MemberCustomersDrawer: true,
        RoleMembersDrawer: true,
        ElSelect: { template: '<div><slot /></div>' },
        ElOption: true,
      },
    },
  })
  await flushPromises()
}
const button = (label: string) =>
  wrapper
    .findAll('button')
    .find((x) => x.text() === label && !x.element.closest('.hidden-columns'))!
beforeEach(() => {
  vi.clearAllMocks()
  access.can.mockReturnValue(true)
  vi.mocked(supplyAccessApi.references).mockResolvedValue([])
  vi.mocked(supplyAccessApi.roles).mockResolvedValue([role])
  vi.mocked(supplyAccessApi.memberRoles).mockResolvedValue([role])
  vi.mocked(supplyAccessApi.menus).mockResolvedValue([])
  vi.mocked(supplyAccessApi.members).mockResolvedValue({
    items: [member],
    total: 1,
    page: 1,
    pageSize: 20,
  })
  vi.mocked(supplyAccessApi.roleImpact).mockResolvedValue({ ...impact })
  vi.spyOn(ElMessage, 'warning').mockImplementation(() => ({ close: vi.fn() }))
  vi.spyOn(ElMessage, 'success').mockImplementation(() => ({ close: vi.fn() }))
  vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue(
    'confirm' as Awaited<ReturnType<typeof ElMessageBox.confirm>>,
  )
})
afterEach(() => {
  wrapper?.unmount()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})
describe('供应链生命周期前端保护', () => {
  it('重新启用还需分配角色权限，单有禁用权限不能重新授权', async () => {
    access.can.mockImplementation((action: string) => action !== 'supply:user:assign-role')
    vi.mocked(supplyAccessApi.members).mockResolvedValue({
      items: [{ ...member, id: 'another', status: 'DISABLED' }],
      total: 1,
      page: 1,
      pageSize: 20,
    })
    await render(UserView)
    expect(button('启用').attributes('disabled')).toBeDefined()
    await button('编辑').trigger('click')
    await flushPromises()
    const statusField = wrapper
      .findAll('.el-form-item')
      .find((f) => f.text().includes('供应链账号状态'))!
    expect(
      statusField
        .findAll('input[type="radio"]')
        .find((input) => input.attributes('value') === 'ACTIVE')!
        .attributes('disabled'),
    ).toBeDefined()
  })

  it('只删除已停用且解除关联的角色，不发送撤销关联捷径', async () => {
    vi.mocked(supplyAccessApi.roles).mockResolvedValue([
      { ...role, status: 'DISABLED', userCount: 0 },
    ])
    vi.mocked(supplyAccessApi.roleImpact).mockResolvedValue({
      ...impact,
      status: 'DISABLED',
      userCount: 0,
      activeUserCount: 0,
      usernames: [],
      canDelete: true,
    })
    await render(RoleView)
    await button('删除').trigger('click')
    await flushPromises()
    expect(supplyAccessApi.deleteRole).toHaveBeenCalledWith('r1', 2)
  })

  it('当前登录用户不能禁用删除，编辑中的状态也不可改', async () => {
    await render(UserView)
    expect(button('禁用').attributes('disabled')).toBeDefined()
    expect(button('删除').attributes('disabled')).toBeDefined()
    await button('禁用').trigger('click')
    await button('删除').trigger('click')
    expect(supplyAccessApi.memberStatus).not.toHaveBeenCalled()
    expect(supplyAccessApi.deleteMember).not.toHaveBeenCalled()
    await button('编辑').trigger('click')
    await flushPromises()
    const statusField = wrapper
      .findAll('.el-form-item')
      .find((f) => f.text().includes('供应链账号状态'))!
    expect(
      statusField
        .findAll('input[type="radio"]')
        .every((input) => input.attributes('disabled') !== undefined),
    ).toBe(true)
  })
  it('停用先显示具体影响，失去最后角色的用户未交接前不能提交', async () => {
    vi.mocked(supplyAccessApi.roleImpact).mockResolvedValue({
      ...impact,
      lastRoleUsernames: ['zhangsan'],
      canDisable: false,
    })
    await render(RoleView)
    expect(button('删除').attributes('disabled')).toBeDefined()
    await button('编辑授权').trigger('click')
    await flushPromises()
    await wrapper
      .findAll('input[type="radio"]')
      .find((x) => x.attributes('value') === 'DISABLED')!
      .setValue(true)
    await button('保存角色及授权').trigger('click')
    await flushPromises()
    expect(supplyAccessApi.roleImpact).toHaveBeenCalledWith('r1')
    expect(wrapper.text()).toContain('最后一个有效角色')
    expect(wrapper.text()).toContain('zhangsan')
    expect(button('确认停用并保存').attributes('disabled')).toBeDefined()
    expect(supplyAccessApi.saveRole).not.toHaveBeenCalled()
    expect(supplyAccessApi.deleteRole).not.toHaveBeenCalled()
  })
  it('影响预览通过后仍需明确确认，随后保存原版本角色', async () => {
    await render(RoleView)
    await button('编辑授权').trigger('click')
    await flushPromises()
    await wrapper
      .findAll('input[type="radio"]')
      .find((x) => x.attributes('value') === 'DISABLED')!
      .setValue(true)
    await button('保存角色及授权').trigger('click')
    await flushPromises()
    expect(supplyAccessApi.saveRole).not.toHaveBeenCalled()
    await button('确认停用并保存').trigger('click')
    await flushPromises()
    expect(supplyAccessApi.saveRole).toHaveBeenCalledWith(
      'r1',
      expect.objectContaining({ version: 2, status: 'DISABLED' }),
    )
  })
})

it('启用用户不能直接删除，禁用后携带版本删除资格', async () => {
  vi.mocked(supplyAccessApi.members).mockResolvedValue({
    items: [{ ...member, id: 'another' }],
    total: 1,
    page: 1,
    pageSize: 20,
  })
  await render(UserView)
  expect(button('删除').attributes('disabled')).toBeDefined()
  wrapper.unmount()
  vi.mocked(supplyAccessApi.members).mockResolvedValue({
    items: [{ ...member, id: 'another', status: 'DISABLED' }],
    total: 1,
    page: 1,
    pageSize: 20,
  })
  await render(UserView)
  await button('删除').trigger('click')
  await flushPromises()
  expect(supplyAccessApi.deleteMember).toHaveBeenCalledWith('another', 2)
})
it('禁用用户允许清空角色并保存，后端失败保留表单并显示明确原因', async () => {
  vi.mocked(supplyAccessApi.members).mockResolvedValue({
    items: [{ ...member, id: 'another', status: 'DISABLED', roles: [] }],
    total: 1,
    page: 1,
    pageSize: 20,
  })
  vi.mocked(supplyAccessApi.saveMember).mockRejectedValueOnce({
    message: '用户已被修改，请重新读取',
  })
  await render(UserView)
  await button('编辑').trigger('click')
  await flushPromises()
  await button('保存用户').trigger('click')
  await flushPromises()
  expect(supplyAccessApi.saveMember).toHaveBeenCalledWith(
    'another',
    expect.objectContaining({ status: 'DISABLED', roles: [], version: 2, employeeCode: 'E1' }),
  )
  expect(wrapper.get('.user-save-error').text()).toContain('用户已被修改，请重新读取')
  expect(wrapper.text()).toContain('编辑供应链用户')
  await button('保存用户').trigger('click')
  await flushPromises()
  expect(supplyAccessApi.saveMember).toHaveBeenCalledTimes(2)
})
it('启用用户没有角色时就地提醒且不发送保存请求', async () => {
  vi.mocked(supplyAccessApi.members).mockResolvedValue({
    items: [{ ...member, id: 'another', roles: [] }],
    total: 1,
    page: 1,
    pageSize: 20,
  })
  await render(UserView)
  await button('编辑').trigger('click')
  await flushPromises()
  await button('保存用户').trigger('click')
  await flushPromises()
  expect(wrapper.get('.user-save-error').text()).toContain('启用用户至少分配一个角色')
  expect(supplyAccessApi.saveMember).not.toHaveBeenCalled()
})

it('角色列表提供统一分配用户入口，并将所选角色交给分配抽屉', async () => {
  await render(RoleView)
  const drawer = wrapper.getComponent(RoleMembersDrawer)
  const open = vi.fn()
  Object.assign(drawer.vm, { open })
  await button('分配用户').trigger('click')
  expect(open).toHaveBeenCalledWith(role)
  access.can.mockImplementation((action: string) => action !== 'supply:user:assign-role')
  wrapper.unmount()
  await render(RoleView)
  expect(wrapper.findAll('button').some((b) => b.text() === '分配用户')).toBe(false)
})
