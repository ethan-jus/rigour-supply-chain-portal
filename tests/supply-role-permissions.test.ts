import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent, h } from 'vue'
import ElementPlus, { ElMessage, ElTree } from 'element-plus'
import RoleView from '@/views/supply-chain/settings/RoleView.vue'
import {
  supplyAccessApi,
  supplySettingsApi,
  type SupplyMenuNode,
  type SupplyRole,
  type ScopeRule,
} from '@/api/core/supply-settings'
import { useSupplyAuthorizationStore } from '@/stores/supply-authorization'
vi.mock('@/stores/navigation', () => ({
  useNavigationStore: () => ({
    invalidate: vi.fn(),
    fetchNavigation: vi.fn().mockResolvedValue([]),
  }),
}))
vi.mock('@/api/core/supply-settings', () => ({
  supplyAccessApi: { roles: vi.fn(), menus: vi.fn(), saveRole: vi.fn() },
  supplySettingsApi: { context: vi.fn() },
}))
const Select = defineComponent({
  props: ['modelValue', 'disabled'],
  emits: ['update:modelValue', 'change'],
  setup:
    (p, { slots, emit }) =>
    () =>
      h(
        'select',
        {
          value: p.modelValue,
          disabled: p.disabled,
          onChange: (e: Event) => {
            const v = (e.target as HTMLSelectElement).value
            emit('update:modelValue', v)
            emit('change', v)
          },
        },
        slots.default?.(),
      ),
})
const Option = defineComponent({
  props: ['value', 'label'],
  setup: (p) => () => h('option', { value: p.value }, p.label),
})
const node = (
  id: string,
  parentId: string | null,
  name: string,
  permissionCode: string | null = null,
): SupplyMenuNode => ({
  id,
  parentId,
  name,
  permissionCode,
  type: permissionCode ? 'BUTTON' : 'MENU',
  resourceId: permissionCode ? id : null,
  iconKey: null,
  sortOrder: 1,
  visible: true,
  status: 'ACTIVE',
  protectedNode: false,
  version: 0,
  resourceCode: null,
  routeKey: null,
  routePath: null,
  componentPath: null,
})
const menus = [
  node('root', null, 'ERP'),
  node('stock', 'root', '库存管理'),
  node('read', 'stock', '查看库存', 'erp:stock:read'),
  node('write', 'stock', '出库', 'erp:stock-out:confirm'),
  { ...node('off', 'root', '停用功能', 'erp:disabled:read'), status: 'DISABLED' as const },
]
const rule = (): ScopeRule => ({
  id: 'rule1',
  actionCode: 'erp:stock:read',
  objectType: 'INVENTORY',
  scopeMode: 'WAREHOUSE',
  departmentMode: 'NONE',
  regionMode: 'NONE',
  warehouseMode: 'MEMBER',
  includeDescendants: false,
  references: {},
})
let wrapper: VueWrapper
const button = (text: string) => wrapper.findAll('button').find((b) => b.text() === text)!
const tree = () => wrapper.getComponent(ElTree)
async function render(role?: Partial<SupplyRole>, selectScope = true) {
  const pinia = createPinia()
  vi.mocked(supplyAccessApi.roles).mockResolvedValue(
    role
      ? [
          {
            id: 'r1',
            code: 'CITY',
            name: '城市总',
            description: null,
            status: 'ACTIVE',
            protectedRole: false,
            version: 2,
            userCount: 0,
            menuNodeIds: [],
            rules: [],
            ...role,
          },
        ]
      : [],
  )
  wrapper = mount(RoleView, {
    attachTo: document.body,
    global: {
      plugins: [pinia, ElementPlus],
      stubs: { teleport: true, ElSelect: Select, ElOption: Option, ScopeReferencePicker: true },
    },
  })
  await useSupplyAuthorizationStore(pinia).refresh()
  await flushPromises()
  await button(role ? '编辑授权' : '新增角色').trigger('click')
  await flushPromises()
  if (selectScope) {
    await scopes()
    await wrapper.get('.scope-options input[value="SELF"]').setValue(true)
    await wrapper.get('[id="tab-menus"]').trigger('click')
    await flushPromises()
  }
}
async function check(id: string, value: boolean) {
  const target = tree().find(`[data-key="${id}"] > .el-tree-node__content input[type="checkbox"]`)
  await target.setValue(value)
  await flushPromises()
}
async function save() {
  const inputs = wrapper.findAll('.el-drawer .el-input__inner')
  await inputs[0].setValue('城市总')
  await inputs[1].setValue('CITY')
  await button('保存角色及授权').trigger('click')
  await flushPromises()
}
async function scopes() {
  await wrapper.get('[id="tab-scopes"]').trigger('click')
  await flushPromises()
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(supplyAccessApi.menus).mockResolvedValue(menus)
  vi.mocked(supplyAccessApi.saveRole).mockResolvedValue({} as SupplyRole)
  vi.mocked(supplySettingsApi.context).mockResolvedValue({
    initialized: true,
    canInitialize: false,
    mode: 'PREPARING',
    version: 1,
    permissions: ['supply:role:create', 'supply:role:update', 'supply:role:grant'],
  })
  for (const level of ['warning', 'success', 'info'] as const)
    vi.spyOn(ElMessage, level).mockImplementation(() => ({ close: vi.fn() }))
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})
describe('角色真实权限树与数据范围', () => {
  it('小写角色编码保存为大写，保留全部勾选授权', async () => {
    await render()
    await check('root', true)
    const inputs = wrapper.findAll('.el-drawer .el-input__inner')
    await inputs[0].setValue('系统开发者')
    await inputs[1].setValue('sys_dev')
    await button('保存角色及授权').trigger('click')
    await flushPromises()
    expect(supplyAccessApi.saveRole).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        code: 'SYS_DEV',
        name: '系统开发者',
        menuNodeIds: expect.arrayContaining(['root', 'stock', 'read', 'write']),
      }),
    )
  })
  it('保存失败在抽屉内持续显示后端原因，保留输入和勾选并允许重试', async () => {
    await render()
    await check('root', true)
    vi.mocked(supplyAccessApi.saveRole).mockRejectedValueOnce({
      code: 'CONFLICT',
      message: '角色编码已存在，请换一个编码',
    })
    await save()
    expect(wrapper.get('.role-save-error').text()).toContain('角色编码已存在，请换一个编码')
    expect(tree().vm.getCheckedKeys()).toContain('read')
    expect(button('保存角色及授权').attributes('disabled')).toBeUndefined()
    await button('保存角色及授权').trigger('click')
    await flushPromises()
    expect(supplyAccessApi.saveRole).toHaveBeenCalledTimes(2)
  })
  it('非法角色编码在页面就地提示，不发出保存请求', async () => {
    await render()
    const inputs = wrapper.findAll('.el-drawer .el-input__inner')
    await inputs[0].setValue('系统开发者')
    await inputs[1].setValue('123bad')
    await button('保存角色及授权').trigger('click')
    await flushPromises()
    expect(supplyAccessApi.saveRole).not.toHaveBeenCalled()
    expect(wrapper.get('.role-save-error').text()).toContain('以字母开头')
  })
  it('勾选父级包含全部启用下级，取消父级清空下级', async () => {
    await render()
    await check('root', true)
    expect(tree().vm.getCheckedKeys()).toEqual(
      expect.arrayContaining(['root', 'stock', 'read', 'write']),
    )
    expect(tree().vm.getCheckedKeys()).not.toContain('off')
    await check('root', false)
    expect(tree().vm.getCheckedKeys()).toEqual([])
    await save()
    expect(supplyAccessApi.saveRole).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ menuNodeIds: [] }),
    )
  })
  it('重新打开半选父级不会授予未选中的兄弟按钮，保存保留父级导航', async () => {
    await render({ menuNodeIds: ['root', 'stock', 'read'], rules: [rule()] })
    expect(tree().vm.getCheckedKeys()).toContain('read')
    expect(tree().vm.getCheckedKeys()).not.toContain('write')
    expect(tree().vm.getHalfCheckedKeys()).toEqual(expect.arrayContaining(['root', 'stock']))
    await button('保存角色及授权').trigger('click')
    await flushPromises()
    const payload = vi.mocked(supplyAccessApi.saveRole).mock.calls[0][1]
    expect(payload.menuNodeIds.sort()).toEqual(['read', 'root', 'stock'])
    expect(payload.rules).toEqual([])
    expect(payload.dataScope).toEqual({ mode: 'SELF', departmentIds: [] })
  })
  it('撤销父级同时移除对应数据规则，避免保存失效规则', async () => {
    await render({ menuNodeIds: ['root', 'stock', 'read', 'write'], rules: [rule()] })
    await check('root', false)
    await button('保存角色及授权').trigger('click')
    await flushPromises()
    expect(supplyAccessApi.saveRole).toHaveBeenCalledWith(
      'r1',
      expect.objectContaining({ menuNodeIds: [], rules: [] }),
    )
  })
  it('全部菜单勾选全部启用节点，虚拟根节点不保存到数据库', async () => {
    await render()
    await check('__all_menus__', true)
    await save()
    const payload = vi.mocked(supplyAccessApi.saveRole).mock.calls[0][1]
    expect(payload.menuNodeIds.sort()).toEqual(['read', 'root', 'stock', 'write'])
    expect(payload.menuNodeIds).not.toContain('__all_menus__')
    expect(payload.menuNodeIds).not.toContain('off')
  })
  it('新增角色默认全部数据，保存后不再需要启用', async () => {
    await render(undefined, false)
    await check('__all_menus__', true)
    await save()
    expect(supplyAccessApi.saveRole).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ dataScope: { mode: 'ALL', departmentIds: [] } }),
    )
    expect(wrapper.text()).not.toContain('数据范围尚未启用')
  })
  it('只有四个范围，选择部门不能为空，切换到全部时清除旧部门', async () => {
    await render(undefined, false)
    await scopes()
    expect(wrapper.findAll('.scope-options input')).toHaveLength(4)
    await wrapper.get('.scope-options input[value="CUSTOM"]').setValue(true)
    await save()
    expect(supplyAccessApi.saveRole).not.toHaveBeenCalled()
    expect(wrapper.get('.role-save-error').text()).toContain('请至少选择一个部门')
    const picker = wrapper.findComponent({ name: 'ScopeReferencePicker' })
    picker.vm.$emit('update:modelValue', ['10', '20'])
    await flushPromises()
    await save()
    expect(supplyAccessApi.saveRole).toHaveBeenLastCalledWith(
      null,
      expect.objectContaining({
        dataScope: { mode: 'CUSTOM', departmentIds: ['10', '20'] },
        rules: [],
      }),
    )
  })
  it('重新编辑回显数据库范围，切换范围清除指定部门', async () => {
    await render({ dataScope: { mode: 'CUSTOM', departmentIds: ['10'] } }, false)
    await scopes()
    expect(
      wrapper.get<HTMLInputElement>('.scope-options input[value="CUSTOM"]').element.checked,
    ).toBe(true)
    await wrapper.get('.scope-options input[value="ALL"]').setValue(true)
    await save()
    expect(supplyAccessApi.saveRole).toHaveBeenLastCalledWith(
      'r1',
      expect.objectContaining({ dataScope: { mode: 'ALL', departmentIds: [] } }),
    )
    expect(wrapper.text()).not.toContain('仓库范围')
  })
})
