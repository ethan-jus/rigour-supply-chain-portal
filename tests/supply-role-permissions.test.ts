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
vi.mock('@/stores/navigation', () => ({ useNavigationStore: () => ({ invalidate: vi.fn() }) }))
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
async function render(role?: Partial<SupplyRole>) {
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
    expect(payload.rules).toHaveLength(1)
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
  it('未选功能解释空列表并禁用新增规则，准备阶段明确未生效', async () => {
    await render()
    await scopes()
    expect(wrapper.text()).toContain('当前处于配置准备阶段')
    expect(wrapper.text()).toContain('尚未选择可配置数据范围的功能')
    expect(button('新增数据规则').attributes('disabled')).toBeDefined()
  })
  it('选父级后操作可选，并且仓库操作仅显示相符的数据范围', async () => {
    await render()
    await check('root', true)
    await scopes()
    await button('新增数据规则').trigger('click')
    await flushPromises()
    const action = wrapper.get('.rule select')
    expect(action.text()).toContain('ERP / 库存管理 / 查看库存')
    await action.setValue('erp:stock:read')
    await flushPromises()
    const mode = wrapper.findAll('.rule select')[1]
    expect(mode.text()).toContain('仓库范围')
    expect(mode.text()).not.toContain('部门范围')
    await mode.setValue('WAREHOUSE')
    await flushPromises()
    expect(wrapper.findAll<HTMLSelectElement>('.rule select')[2].element.value).toBe('MEMBER')
    expect(wrapper.findAll('.rule select')[2].text()).not.toContain('不额外限制')
    await save()
    expect(supplyAccessApi.saveRole).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        rules: [
          expect.objectContaining({
            actionCode: 'erp:stock:read',
            scopeMode: 'WAREHOUSE',
            warehouseMode: 'MEMBER',
          }),
        ],
      }),
    )
  })
  it('空规则不保存，也不会擅自赋予全部数据权限', async () => {
    await render()
    await check('root', true)
    await scopes()
    await button('新增数据规则').trigger('click')
    await flushPromises()
    await save()
    expect(supplyAccessApi.saveRole).not.toHaveBeenCalled()
    expect(ElMessage.warning).toHaveBeenCalledWith('请为每条数据规则选择操作，或删除空规则')
  })
})
