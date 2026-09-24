import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElMessage } from 'element-plus'
import { defineComponent, h } from 'vue'
import UserView from '@/views/supply-chain/settings/UserView.vue'
import { supplyAccessApi, type SupplyEmployee } from '@/api/core/supply-settings'

vi.mock('@/stores/auth', () => ({ useAuthStore: () => ({ user: { id: 'admin' } }) }))
vi.mock('@/stores/supply-authorization', () => ({
  useSupplyAuthorizationStore: () => ({ can: () => true }),
}))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => false }),
}))
vi.mock('@/api/core/supply-settings', () => ({
  supplySettingsApi: {},
  supplyAccessApi: {
    members: vi.fn(), memberRoles: vi.fn(), references: vi.fn(),
    employees: vi.fn(), accounts: vi.fn(),
  },
}))
const employee = (employeeCode: string, employeeName: string) => ({
  employeeCode, employeeName, departmentName: '销售部', usable: true,
}) as SupplyEmployee
const page = (items: SupplyEmployee[]) => ({ items, total: items.length, begin: 0, step: 20 })
const oldEmployee = employee('E1', '黄测试')
const zhao = employee('E2', '赵测试')
// 不依赖 jsdom 下拉定位；保留远程检索与异步结果的页面契约。
const Select = defineComponent({
  props: ['placeholder', 'remoteMethod', 'loading', 'modelValue'],
  setup: (_, { slots }) => () => h('div', slots.default?.()),
})
const Option = defineComponent({
  props: ['label'],
  setup: p => () => h('div', { class: 'employee-option' }, p.label),
})
let wrapper: VueWrapper
const select = () => wrapper.findAllComponents(Select)
  .find(s => s.props('placeholder') === '按姓名或编码搜索已维护的员工')!
const search = (keyword: string) => select().props('remoteMethod')!(keyword)
const options = () => wrapper.findAll('.employee-option').map(o => o.text())

beforeEach(async () => {
  vi.clearAllMocks()
  vi.spyOn(ElMessage, 'error').mockImplementation(() => ({ close: vi.fn() }))
  vi.mocked(supplyAccessApi.members).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 })
  vi.mocked(supplyAccessApi.memberRoles).mockResolvedValue([])
  vi.mocked(supplyAccessApi.references).mockResolvedValue([])
  vi.mocked(supplyAccessApi.accounts).mockResolvedValue([])
  vi.mocked(supplyAccessApi.employees).mockResolvedValue(page([oldEmployee]))
  wrapper = mount(UserView, {
    attachTo: document.body,
    global: {
      plugins: [ElementPlus],
      stubs: { teleport: true, ElSelect: Select, ElOption: Option, ScopeReferencePicker: true, RoleAssignmentEditor: true,
        MemberCustomersDrawer: true, DepartmentSidebar: true },
    },
  })
  await flushPromises()
  await wrapper.findAll('button').find(b => b.text() === '新增用户')!.trigger('click')
  await flushPromises()
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML = ''; vi.restoreAllMocks() })

it('中文搜索把关键词传给真实检索边界，并替换默认员工列表', async () => {
  vi.mocked(supplyAccessApi.employees).mockResolvedValue(page([zhao]))
  await search('赵')
  await flushPromises()
  expect(supplyAccessApi.employees).toHaveBeenLastCalledWith('赵')
  expect(options().join()).toContain('赵测试')
  expect(options().join()).not.toContain('黄测试')
})

it('检索失败清除旧候选并持续显示错误，不能把默认名单当成搜索结果', async () => {
  vi.mocked(supplyAccessApi.employees).mockRejectedValue(new Error('HR 身份暂时无法核验'))
  await search('赵')
  await flushPromises()
  expect(options().join()).not.toContain('黄测试')
  expect(wrapper.text()).toContain('HR 身份暂时无法核验')
  expect(select().props('loading')).toBe(false)
})

it('迟到的旧查询不会覆盖较新的员工结果或关闭其加载状态', async () => {
  let finishOld!: (value: ReturnType<typeof page>) => void
  let finishNew!: (value: ReturnType<typeof page>) => void
  vi.mocked(supplyAccessApi.employees)
    .mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
    .mockImplementationOnce(() => new Promise(resolve => { finishNew = resolve }))
  const oldRequest = search('黄')
  const newRequest = search('赵')
  finishOld(page([oldEmployee]))
  await oldRequest
  await flushPromises()
  expect(select().props('loading')).toBe(true)
  finishNew(page([zhao]))
  await newRequest
  await flushPromises()
  expect(options().join()).toContain('赵测试')
  expect(options().join()).not.toContain('黄测试')
})
