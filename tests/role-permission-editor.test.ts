import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ElementPlus from 'element-plus'
import RolePermissionView from '@/views/admin/roles/IndexView.vue'

const permission = vi.hoisted(() => ({ manage: true }))
const api = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), post: vi.fn() }))
vi.mock('@/api', () => ({ apiClient: api }))
vi.mock('@/stores', () => ({ useAuthStore: () => ({ hasPermission: () => permission.manage }) }))

const root = '/management/tenant/role-permissions'
const resource = (id: string, name: string, parentId: string | null = null) => ({
  id, applicationId: 'supply', applicationCode: 'SUPPLY_CHAIN', applicationName: '供应链',
  parentId, code: id, type: parentId ? 'API' : 'MENU', permissionCode: parentId ? `analytics:${id}:write` : null,
  displayName: name, sortOrder: 1, status: 'ACTIVE', routePath: null, routeKey: null,
  visible: true, keepAlive: false, iconKey: null,
})
const resources = [resource('bi', '数据看板'), resource('targets', '维护经营目标', 'bi'),
  resource('operations', '维护运营跟进', 'bi'), resource('reconciliation', '生成来源数据复核', 'bi')]
const custom = { id: 'r1', code: 'ROLE1', name: '城市运营', description: null,
  type: 'CUSTOM', status: 'ACTIVE', version: 4, updatedAt: null,
  resourceIds: ['bi', 'operations'], permissionMode: 'EXPLICIT' }
let roles: object[]
let wrapper: VueWrapper

beforeEach(() => {
  vi.clearAllMocks()
  permission.manage = true
  roles = [custom]
  api.get.mockImplementation((url: string) => Promise.resolve(url.endsWith('/roles') ? roles : resources))
  api.put.mockResolvedValue(custom)
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = '' })
async function open(label = '配置') {
  wrapper = mount(RolePermissionView, { attachTo: document.body,
    global: { plugins: [ElementPlus], stubs: {
      ElDialog: { props: ['modelValue'], template: '<section v-if="modelValue"><slot /><slot name="footer" /></section>' },
      ElSelect: { props: ['modelValue'], emits: ['update:modelValue'], template: '<select :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value)"><slot /></select>' },
      ElOption: { props: ['value', 'label'], template: '<option :value="value">{{ label }}</option>' },
    } } })
  await flushPromises()
  await button(label)
}
async function button(label: string) {
  await wrapper.findAll('button').find(item => item.text() === label)!.trigger('click')
  await flushPromises()
}

describe('角色权限实际配置交互', () => {
  it('管理员显示服务端自动全量模式且不能手动删减', async () => {
    roles = [{ ...custom, type: 'SYSTEM', name: '管理员', permissionMode: 'ALL_ENTITLED', resourceIds: resources.map(item => item.id) }]
    await open('查看')
    expect(wrapper.text()).toContain('全部可用权限（自动）')
    expect(wrapper.text()).toContain('新增权限自动生效')
    expect(wrapper.get('[aria-label="维护经营目标"] input[type="checkbox"]').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('button').some(item => item.text() === '保存')).toBe(false)
    expect(api.put).not.toHaveBeenCalled()
  })

  it('搜索具体BI权限后勾选，保存到当前普通角色并保留其他既有权限', async () => {
    await open()
    await wrapper.get('input[aria-label="搜索权限"]').setValue('经营目标')
    expect(wrapper.find('[aria-label="维护运营跟进"] input[type="checkbox"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="数据看板"] input[type="checkbox"]').exists()).toBe(true)
    await wrapper.get('[aria-label="维护经营目标"] input[type="checkbox"]').setValue(true)
    await button('保存')
    expect(api.put).toHaveBeenCalledWith(`${root}/roles/r1`, expect.objectContaining({
      version: 4, resourceIds: expect.arrayContaining(['bi', 'operations', 'targets']),
    }))
    expect(api.put.mock.calls[0][1].resourceIds).toHaveLength(3)
    expect(api.put.mock.calls[0][1]).not.toHaveProperty('permissionMode')
    expect(api.put.mock.calls[0][1]).not.toHaveProperty('code')
  })

  it('取消父级同时去掉子权限，不保留不可达的操作授权', async () => {
    await open()
    await wrapper.get('[aria-label="数据看板"] input[type="checkbox"]').setValue(false)
    await button('保存')
    expect(api.put.mock.calls[0][1].resourceIds).toEqual([])
  })

  it('保存冲突保留编辑内容并显示服务端原因', async () => {
    api.put.mockRejectedValueOnce({ code: 'CONFLICT', message: '角色已被其他管理员修改，请刷新后重试' })
    await open()
    await wrapper.get('input[aria-label="角色名称"]').setValue('城市运营主管')
    await wrapper.get('[aria-label="维护经营目标"] input[type="checkbox"]').setValue(true)
    await button('保存')
    expect(wrapper.text()).toContain('角色已被其他管理员修改')
    expect((wrapper.get('input[aria-label="角色名称"]').element as HTMLInputElement).value).toBe('城市运营主管')
    expect((wrapper.get('[aria-label="维护经营目标"] input[type="checkbox"]').element as HTMLInputElement).checked).toBe(true)
  })

  it('没有角色配置权限时只读，不能保存或勾选', async () => {
    permission.manage = false
    await open('查看')
    expect(wrapper.findAll('button').some(item => item.text() === '新增角色')).toBe(false)
    expect(wrapper.get('[aria-label="维护经营目标"] input[type="checkbox"]').attributes('disabled')).toBeDefined()
    expect(api.put).not.toHaveBeenCalled()
  })

  it('重新加载失败后清掉旧角色和授权资源，呈现真实错误', async () => {
    await open()
    await button('取消')
    api.get.mockRejectedValueOnce({ message: '当前账号无权读取可授权资源' })
    await button('刷新')
    expect(wrapper.text()).toContain('当前账号无权读取可授权资源')
    expect(wrapper.text()).not.toContain('城市运营')
  })
})
