import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus, { ElMessage } from 'element-plus'
import { defineComponent, h } from 'vue'
import MemberCustomersDrawer from '@/views/supply-chain/settings/MemberCustomersDrawer.vue'
import { memberCustomerApi, type MemberCustomer } from '@/api/core/member-customer-responsibility'
import type { SupplyMember } from '@/api/core/supply-settings'
const grants = vi.hoisted(() => ({ write: true }))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => grants.write }),
}))
vi.mock('@/api/core/member-customer-responsibility', () => ({
  memberCustomerApi: { list: vi.fn(), preview: vi.fn(), apply: vi.fn() },
}))
const member = { id: 'u1', name: '张三', username: 'zhangsan', employeeCode: 'E1' } as SupplyMember
const target = { userId: 'u1', employeeCode: 'E1', employeeName: '张三' }
const customer = (id: string, revision = 1): MemberCustomer => ({
  customerId: id,
  customerName: `客户${id}`,
  customerCode: id,
  customerType: null,
  status: 'ACTIVE',
  regionCode: 'HZ',
  regionName: '杭州',
  employeeCode: 'E2',
  employeeName: '李四',
  revision,
})
// jsdom does not position Element Plus poppers; retain the real v-model contract.
const SelectStub = defineComponent({
  props: ['modelValue', 'disabled'],
  emits: ['update:modelValue'],
  setup:
    (props, { emit, slots }) =>
    () =>
      h(
        'select',
        {
          value: props.modelValue,
          disabled: props.disabled,
          onChange: (event: Event) =>
            emit('update:modelValue', (event.target as HTMLSelectElement).value),
        },
        slots.default?.(),
      ),
})
const OptionStub = defineComponent({
  props: ['value', 'label'],
  setup: (props) => () => h('option', { value: props.value }, props.label),
})
let wrapper: VueWrapper
const button = (text: string) => wrapper.findAll('button').find((b) => b.text() === text)!
async function render() {
  wrapper = mount(MemberCustomersDrawer, {
    attachTo: document.body,
    global: {
      plugins: [ElementPlus],
      stubs: { teleport: true, ElSelect: SelectStub, ElOption: OptionStub },
    },
  })
  await (wrapper.vm as unknown as { open: (m: SupplyMember) => Promise<void> }).open(member)
  await flushPromises()
}
beforeEach(() => {
  vi.clearAllMocks()
  grants.write = true
  vi.spyOn(ElMessage, 'error').mockImplementation(() => ({ close: vi.fn() }))
  vi.spyOn(ElMessage, 'success').mockImplementation(() => ({ close: vi.fn() }))
  vi.mocked(memberCustomerApi.list).mockImplementation(async (_id, query) => ({
    items: [customer(String(query.page))],
    total: 21,
    page: query.page,
    size: 20,
    target,
    filters: {
      customerTypes: [{ code: 'T1', name: '批发客户' }],
      regions: [{ code: 'HZ', name: '杭州市' }],
      statuses: [{ code: 'ACTIVE', name: '启用' }],
    },
  }))
  vi.mocked(memberCustomerApi.preview).mockResolvedValue({
    previewToken: 'proof-1',
    expiresAt: '2026-09-16T12:00:00Z',
    target,
    operation: 'ASSIGN',
    count: 2,
    items: ['1', '2'].map((id) => ({
      customerId: id,
      customerName: `客户${id}`,
      regionCode: 'HZ',
      regionName: '杭州',
      oldEmployeeCode: 'E2',
      oldEmployeeName: '李四',
      newEmployeeCode: 'E1',
      newEmployeeName: '张三',
      revision: 1,
    })),
  })
  vi.mocked(memberCustomerApi.apply).mockResolvedValue({ affectedCount: 2 })
})
afterEach(() => {
  wrapper?.unmount()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})
describe('用户负责客户独立变更', () => {
  it('从受限查询结果加载可读筛选选项，并把筛选传给同一个目标用户查询', async () => {
    await render()
    const selects = wrapper.findAll('select')
    expect(selects[0].text()).toContain('批发客户')
    expect(selects[1].text()).toContain('杭州市')
    await selects[0].setValue('T1')
    await selects[1].setValue('HZ')
    await selects[2].setValue('ACTIVE')
    await button('查询').trigger('submit')
    await flushPromises()
    expect(memberCustomerApi.list).toHaveBeenLastCalledWith('u1', {
      mode: 'OWNED',
      keyword: '',
      page: 1,
      size: 20,
      customerType: 'T1',
      regionCode: 'HZ',
      status: 'ACTIVE',
    })
  })

  it('预览请求期间不能切到另一用户，说明与提交的命令快照一致', async () => {
    let complete!: (value: Awaited<ReturnType<typeof memberCustomerApi.preview>>) => void
    const savedPreview = await memberCustomerApi.preview('fixture', {
      operation: 'RELEASE',
      customers: [],
      reason: '',
    })
    vi.mocked(memberCustomerApi.preview).mockClear()
    vi.mocked(memberCustomerApi.preview).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    await render()
    await wrapper.find('.el-table__body .el-checkbox__original').setValue(true)
    await wrapper.get('textarea').setValue('原始原因')
    await button('预览解除主责').trigger('click')
    await flushPromises()
    expect(wrapper.get('textarea').attributes('disabled')).toBeDefined()
    await (wrapper.vm as unknown as { open: (m: SupplyMember) => Promise<void> }).open({
      ...member,
      id: 'another',
      name: '李四',
    })
    expect(memberCustomerApi.list).not.toHaveBeenCalledWith('another', expect.anything())
    complete(savedPreview)
    await flushPromises()
    expect(wrapper.text()).toContain('变更原因：原始原因')
    expect(memberCustomerApi.apply).not.toHaveBeenCalled()
  })

  it('只读查询真实主责，不展示分配或解除操作', async () => {
    grants.write = false
    await render()
    expect(memberCustomerApi.list).toHaveBeenCalledWith('u1', {
      mode: 'OWNED',
      keyword: '',
      page: 1,
      size: 20,
    })
    expect(wrapper.text()).toContain('客户1')
    expect(wrapper.text()).not.toContain('选择分配客户')
    expect(wrapper.text()).not.toContain('预览解除主责')
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(memberCustomerApi.apply).not.toHaveBeenCalled()
  })
  it('跨页保留选择，预览显示移交，显式确认才提交凭证', async () => {
    await render()
    await wrapper.findAll('input[type="radio"]')[1].setValue(true)
    await flushPromises()
    await wrapper.find('.el-table__body .el-checkbox__original').setValue(true)
    await wrapper.get('.btn-next').trigger('click')
    await flushPromises()
    await wrapper.find('.el-table__body .el-checkbox__original').setValue(true)
    expect(wrapper.text()).toContain('已勾选 2 个客户')
    await wrapper.get('textarea').setValue('城市团队移交')
    await button('预览分配 / 移交').trigger('click')
    await flushPromises()
    expect(memberCustomerApi.preview).toHaveBeenCalledWith('u1', {
      operation: 'ASSIGN',
      customers: [
        { customerId: '1', revision: 1 },
        { customerId: '2', revision: 1 },
      ],
      reason: '城市团队移交',
    })
    expect(memberCustomerApi.apply).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('原主责')
    expect(wrapper.text()).toContain('历史订单归属保留')
    await button('确认执行本批次').trigger('click')
    await flushPromises()
    expect(memberCustomerApi.apply).toHaveBeenCalledWith('u1', 'proof-1')
    expect(wrapper.text()).toContain('已勾选 0 个客户')
  })
  it('清空勾选不会解除主责，解除也须预览后独立执行', async () => {
    await render()
    await wrapper.find('.el-table__body .el-checkbox__original').setValue(true)
    await button('清空勾选').trigger('click')
    expect(memberCustomerApi.preview).not.toHaveBeenCalled()
    expect(memberCustomerApi.apply).not.toHaveBeenCalled()
    await wrapper.find('.el-table__body .el-checkbox__original').setValue(true)
    await wrapper.get('textarea').setValue('暂时解除')
    await button('预览解除主责').trigger('click')
    await flushPromises()
    expect(memberCustomerApi.preview).toHaveBeenCalledWith('u1', {
      operation: 'RELEASE',
      customers: [{ customerId: '1', revision: 1 }],
      reason: '暂时解除',
    })
    expect(memberCustomerApi.apply).not.toHaveBeenCalled()
  })
})
