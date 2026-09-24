import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElMessageBox, ElMessage } from 'element-plus'
import RoleMembersDrawer from '@/views/supply-chain/settings/RoleMembersDrawer.vue'
import RoleAssignmentEditor from '@/views/supply-chain/settings/RoleAssignmentEditor.vue'
import { supplyAccessApi, type SupplyRole, type SupplyMember } from '@/api/core/supply-settings'
const access = vi.hoisted(() => ({ can: vi.fn(() => true), refresh: vi.fn() }))
vi.mock('@/stores/supply-authorization', () => ({ useSupplyAuthorizationStore: () => access }))
vi.mock('@/api/core/supply-settings', () => ({
  supplyAccessApi: {
    members: vi.fn(),
    previewBatch: vi.fn(),
    assignBatch: vi.fn(),
    references: vi.fn(),
  },
}))
const role: SupplyRole = {
  id: 'role',
  name: '城市经理',
  code: 'CITY',
  description: null,
  status: 'ACTIVE',
  protectedRole: false,
  version: 3,
  userCount: 0,
  menuNodeIds: [],
  rules: [],
}
const member = (id: string, assigned = false) =>
  ({
    id,
    name: id,
    username: id,
    kind: 'BUSINESS',
    status: 'ACTIVE',
    version: 8,
    roles: assigned
      ? [{ roleId: 'role', parameters: {} }]
      : [{ roleId: 'other-role', parameters: {} }],
  }) as SupplyMember
let wrapper: VueWrapper
const button = () => wrapper.findAll('button').find((b) => b.text() === '预览并确认分配')!
async function open(value = role) {
  wrapper = mount(RoleMembersDrawer, {
    attachTo: document.body,
    global: {
      plugins: [ElementPlus],
      stubs: {
        teleport: true,
        ElSelect: { template: '<div><slot /></div>' },
        ElOption: true,
      },
    },
  })
  await (wrapper.vm as unknown as { open: (r: SupplyRole) => Promise<void> }).open(value)
  await flushPromises()
}
async function selectFirst() {
  const checkbox = wrapper.find('.el-table__body input[type="checkbox"]')
  await checkbox.setValue(true)
  await flushPromises()
}
beforeEach(() => {
  vi.clearAllMocks()
  access.can.mockReturnValue(true)
  vi.mocked(supplyAccessApi.members).mockResolvedValue({
    items: [member('张三')],
    total: 1,
    page: 1,
    pageSize: 20,
  })
  vi.mocked(supplyAccessApi.previewBatch).mockImplementation(async (c) => ({
    members: c.members,
    mode: c.mode,
    roleCount: c.roles.length,
    applicationVersion: 27,
  }))
  vi.mocked(supplyAccessApi.assignBatch).mockResolvedValue(undefined)
  vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue(
    'confirm' as Awaited<ReturnType<typeof ElMessageBox.confirm>>,
  )
  vi.spyOn(ElMessage, 'success').mockImplementation(() => ({ close: vi.fn() }))
})
afterEach(() => {
  wrapper?.unmount()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})
it('从角色给用户追加角色，携带用户版本及预览版本，保留其他角色', async () => {
  await open()
  await selectFirst()
  await button().trigger('click')
  await flushPromises()
  expect(supplyAccessApi.previewBatch).toHaveBeenCalledWith({
    mode: 'APPEND',
    members: [{ id: '张三', version: 8 }],
    roles: [{ roleId: 'role', parameters: {} }],
    applicationVersion: 0,
  })
  expect(supplyAccessApi.assignBatch).toHaveBeenCalledWith(
    expect.objectContaining({ mode: 'APPEND', applicationVersion: 27 }),
  )
  expect(access.refresh).toHaveBeenCalledOnce()
  expect(wrapper.emitted('saved')).toHaveLength(1)
})
it('停用角色只能移除，解除关联后可走角色删除流程', async () => {
  vi.mocked(supplyAccessApi.members).mockResolvedValue({
    items: [member('李四', true)],
    total: 1,
    page: 1,
    pageSize: 20,
  })
  await open({ ...role, status: 'DISABLED' })
  await selectFirst()
  await button().trigger('click')
  await flushPromises()
  expect(supplyAccessApi.assignBatch).toHaveBeenCalledWith(
    expect.objectContaining({ mode: 'REMOVE', roles: [{ roleId: 'role', parameters: {} }] }),
  )
})
it('版本冲突保留选择并显示原因，取消预览不发送写入', async () => {
  vi.mocked(supplyAccessApi.assignBatch).mockRejectedValueOnce({
    message: '授权配置已变化，请重新预览',
  })
  await open()
  await selectFirst()
  await button().trigger('click')
  await flushPromises()
  expect(wrapper.get('.role-members-error').text()).toContain('授权配置已变化')
  expect(wrapper.text()).toContain('本页已选择 1 人')
  vi.mocked(ElMessageBox.confirm).mockRejectedValueOnce('cancel')
  await button().trigger('click')
  await flushPromises()
  expect(supplyAccessApi.assignBatch).toHaveBeenCalledTimes(1)
})
it('已关联用户和受保护管理员不能被追加覆盖，缺少分配权限不打开', async () => {
  vi.mocked(supplyAccessApi.members).mockResolvedValue({
    items: [member('已关联', true), { ...member('恢复管理员'), kind: 'PROTECTED' }],
    total: 2,
    page: 1,
    pageSize: 20,
  })
  await open()
  const checkboxes = wrapper.findAll('.el-table__body input[type="checkbox"]')
  expect(checkboxes).toHaveLength(2)
  expect(checkboxes.every((c) => c.attributes('disabled') !== undefined)).toBe(true)
  wrapper.unmount()
  access.can.mockReturnValue(false)
  await open()
  expect(supplyAccessApi.members).toHaveBeenCalledTimes(1)
})
it('公共角色选择器在移除模式允许选择停用角色，追加模式禁选', async () => {
  wrapper = mount(RoleAssignmentEditor, {
    props: { modelValue: [], roles: [{ ...role, status: 'DISABLED' }], removeOnly: true },
    global: {
      plugins: [ElementPlus],
      stubs: {
        ElSelect: { template: '<div><slot /></div>' },
        ElOption: { props: ['disabled'], template: '<button :disabled="disabled">role</button>' },
      },
    },
  })
  expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
  await wrapper.setProps({ removeOnly: false })
  expect(wrapper.get('button').attributes('disabled')).toBeDefined()
})

it('批量分配只提交角色，范围随角色生效，预览不通过时不写入', async () => {
  await open({
    ...role,
    rules: [
      {
        id: 'scope-rule',
        actionCode: 'order:read',
        objectType: 'ORDER',
        scopeMode: 'DEPARTMENT',
        departmentMode: 'MANAGED',
        regionMode: 'ALL',
        warehouseMode: 'ALL',
        includeDescendants: false,
        references: {},
      },
    ],
  })
  await selectFirst()
  vi.mocked(supplyAccessApi.previewBatch).mockRejectedValueOnce({
    message: '用户部门范围超出可委派范围',
  })
  await button().trigger('click')
  await flushPromises()
  expect(supplyAccessApi.previewBatch).toHaveBeenCalledWith(
    expect.objectContaining({ roles: [{ roleId: 'role', parameters: {} }] }),
  )
  expect(wrapper.get('.role-members-error').text()).toContain('用户部门范围超出可委派范围')
  expect(supplyAccessApi.assignBatch).not.toHaveBeenCalled()
  expect(ElMessageBox.confirm).not.toHaveBeenCalled()
})
