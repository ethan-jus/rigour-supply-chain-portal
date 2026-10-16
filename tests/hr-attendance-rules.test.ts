import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
vi.mock('@/views/supply-chain/hr/PayrollComponentView.vue', () => ({
  default: { template: '<div>薪资考勤规则</div>' },
}))
import Rules from '@/views/supply-chain/hr/HrAttendanceRuleView.vue'
import * as api from '@/api/core/hr-attendance'
const permissions = vi.hoisted(() => ({ write: true }))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => permissions.write }),
}))
vi.mock('@/api/core/hr-attendance', () => ({
  attendanceMonth: () => '2026-10',
  getAttendanceDepartments: vi.fn(),
  getAttendanceRules: vi.fn(),
  getAttendanceRule: vi.fn(),
  saveAttendanceRule: vi.fn(),
}))
const list = (): api.AttendanceRuleList => ({
  month: '2026-10',
  companyExpectedDays: 26,
  configuredDepartmentIds: [0, 2],
  lockedDepartmentIds: [],
  page: {
    total: 2,
    begin: 0,
    step: 20,
    items: [
      {
        month: '2026-10',
        departmentId: null,
        departmentName: '公司默认',
        expectedDays: 26,
        revision: 1,
        locked: false,
        updatedTime: '2026-10-13T02:00:00Z',
      },
      {
        month: '2026-10',
        departmentId: 2,
        departmentName: '销售一部',
        expectedDays: 24,
        revision: 3,
        locked: false,
        updatedTime: '2026-10-13T03:00:00Z',
      },
    ],
  },
})
let wrapper: VueWrapper
beforeEach(() => {
  vi.resetAllMocks()
  permissions.write = true
  vi.mocked(api.getAttendanceDepartments).mockResolvedValue([
    { id: 1, parentId: null, departmentName: '销售部', sortOrder: 0 },
    { id: 2, parentId: 1, departmentName: '销售一部', sortOrder: 0 },
    { id: 3, parentId: 1, departmentName: '销售二部', sortOrder: 1 },
  ])
  vi.mocked(api.getAttendanceRules).mockResolvedValue(list())
  vi.mocked(api.getAttendanceRule).mockImplementation(async (month, departmentId = null) => ({
    month,
    departmentId,
    expectedDays: departmentId === 2 ? 24 : departmentId == null ? 26 : null,
    companyExpectedDays: 26,
    revision: departmentId === 2 ? 3 : departmentId == null ? 1 : 0,
    locked: false,
  }))
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})
async function open() {
  wrapper = mount(Rules, { attachTo: document.body, global: { plugins: [ElementPlus] } })
  await flushPromises()
  wrapper.getComponent({ name: 'ElTabs' }).vm.$emit('update:modelValue', 'expected')
  await flushPromises()
  return wrapper
}
async function click(text: string) {
  const button = [...document.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === text,
  )!
  button.click()
  await flushPromises()
}
const dialog = () => wrapper.get('.el-dialog')
async function setDays(value: string) {
  const field = wrapper.get('input[aria-label="应出勤天数"]')
  await field.setValue(value)
  await field.trigger('change')
}
async function chooseDepartment(id: number) {
  wrapper
    .findAllComponents({ name: 'ElTreeSelect' })
    .find((c) => c.props('ariaLabel') === '规则部门')!
    .vm.$emit('update:modelValue', id)
  await flushPromises()
}

describe('考勤规则列表', () => {
  it('shows rule records and independently filters company default, month and lock state', async () => {
    await open()
    expect(wrapper.text()).toContain('2026-10 考勤规则')
    expect(wrapper.text()).toContain('销售一部')
    expect(wrapper.text()).toContain('2026/10/13 10:00')
    wrapper.getComponent({ name: 'ElTreeSelect' }).vm.$emit('update:modelValue', 0)
    wrapper
      .findAllComponents({ name: 'ElSelect' })
      .find((c) => c.props('ariaLabel') === '规则状态')!
      .vm.$emit('update:modelValue', 'LOCKED')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(api.getAttendanceRules).toHaveBeenLastCalledWith({
      month: '2026-10',
      departmentId: 0,
      status: 'LOCKED',
      begin: 0,
      step: 20,
    })
    await click('重置')
    expect(api.getAttendanceRules).toHaveBeenLastCalledWith({
      month: '2026-10',
      departmentId: undefined,
      status: '',
      begin: 0,
      step: 20,
    })
  })
  it('keeps applied filters during pagination and ignores stale list responses', async () => {
    const rows = list()
    rows.page.total = 45
    vi.mocked(api.getAttendanceRules).mockResolvedValue(rows)
    await open()
    wrapper.getComponent({ name: 'ElDatePicker' }).vm.$emit('update:modelValue', '2026-09')
    let finish!: (data: api.AttendanceRuleList) => void
    vi.mocked(api.getAttendanceRules).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    await wrapper.get('.el-pagination .btn-next').trigger('click')
    await flushPromises()
    expect(api.getAttendanceRules).toHaveBeenLastCalledWith(
      expect.objectContaining({ month: '2026-10', begin: 20 }),
    )
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    finish({ ...rows, month: '2026-10' })
    await flushPromises()
    expect(wrapper.text()).toContain('2026-09 考勤规则')
    expect(wrapper.get('.el-pagination .is-active').text()).toBe('1')
  })
  it('shows an empty month and missing-default warning without inventing rows', async () => {
    const empty = list()
    empty.companyExpectedDays = null
    empty.configuredDepartmentIds = []
    empty.page = { total: 0, begin: 0, step: 20, items: [] }
    vi.mocked(api.getAttendanceRules).mockResolvedValue(empty)
    await open()
    expect(wrapper.text()).toContain('本月尚未设置考勤规则')
    expect(wrapper.text()).toContain('新增本月规则')
    const partial = list()
    partial.companyExpectedDays = null
    partial.configuredDepartmentIds = [2]
    partial.page.items = partial.page.items.slice(1)
    vi.mocked(api.getAttendanceRules).mockResolvedValue(partial)
    await click('刷新')
    expect(wrapper.text()).toContain('未单独设置规则的部门暂无应出勤标准')
  })
  it('disables configured departments and creates an explicit zero-day rule', async () => {
    await open()
    await click('新增规则')
    const options = wrapper
      .findAllComponents({ name: 'ElTreeSelect' })
      .find((c) => c.props('ariaLabel') === '规则部门')!
      .props('data')
    expect(options[0]).toMatchObject({
      id: 0,
      disabled: true,
      departmentName: '公司默认（已设置）',
    })
    expect(options[1].children[0]).toMatchObject({ id: 2, disabled: true })
    await chooseDepartment(3)
    expect((wrapper.get('input[aria-label="应出勤天数"]').element as HTMLInputElement).value).toBe(
      '',
    )
    await setDays('0')
    await click('保存规则')
    expect(api.saveAttendanceRule).toHaveBeenCalledWith({
      month: '2026-10',
      departmentId: 3,
      expectedDays: 0,
      revision: 0,
    })
    expect(api.getAttendanceRules).toHaveBeenLastCalledWith(
      expect.objectContaining({ month: '2026-10', begin: 0, step: 20 }),
    )
  })
  it('locks identifying fields while editing and restores company default using the current revision', async () => {
    await open()
    await wrapper.get('button[aria-label="修改销售一部考勤规则"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('input[aria-label="规则月份"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('input[aria-label="规则部门"]').attributes('disabled')).toBeDefined()
    await setDays('22')
    await click('保存修改')
    expect(api.saveAttendanceRule).toHaveBeenLastCalledWith({
      month: '2026-10',
      departmentId: 2,
      expectedDays: 22,
      revision: 3,
    })
    await wrapper.get('button[aria-label="修改销售一部考勤规则"]').trigger('click')
    await flushPromises()
    await click('恢复公司默认')
    expect(api.saveAttendanceRule).toHaveBeenLastCalledWith({
      month: '2026-10',
      departmentId: 2,
      expectedDays: null,
      revision: 3,
    })
  })
  it('shows locked records as read-only with a reason', async () => {
    const rows = list()
    rows.page.items[1]!.locked = true
    rows.lockedDepartmentIds = [2]
    vi.mocked(api.getAttendanceRules).mockResolvedValue(rows)
    vi.mocked(api.getAttendanceRule).mockResolvedValue({
      month: '2026-10',
      departmentId: 2,
      expectedDays: 24,
      revision: 3,
      companyExpectedDays: 26,
      locked: true,
    })
    await open()
    expect(wrapper.find('button[aria-label="修改销售一部考勤规则"]').exists()).toBe(false)
    await wrapper.get('button[aria-label="查看销售一部考勤规则"]').trigger('click')
    await flushPromises()
    expect(dialog().text()).toContain('本部门当月已有员工确认考勤')
    expect(wrapper.get('input[aria-label="应出勤天数"]').attributes('disabled')).toBeDefined()
    expect(dialog().text()).not.toContain('保存修改')
    expect(api.saveAttendanceRule).not.toHaveBeenCalled()
  })
  it('reloads a rule locked by another user and stops further edits after a conflict', async () => {
    await open()
    await wrapper.get('button[aria-label="修改销售一部考勤规则"]').trigger('click')
    await flushPromises()
    await setDays('22')
    vi.mocked(api.saveAttendanceRule).mockRejectedValueOnce(new Error('对应规则已锁定'))
    vi.mocked(api.getAttendanceRule).mockResolvedValueOnce({
      month: '2026-10',
      departmentId: 2,
      expectedDays: 24,
      revision: 3,
      companyExpectedDays: 26,
      locked: true,
    })
    await click('保存修改')
    expect(dialog().text()).toContain('对应规则已锁定')
    expect(dialog().text()).toContain('查看考勤规则')
    expect(wrapper.get('input[aria-label="应出勤天数"]').attributes('disabled')).toBeDefined()
  })
  it('blocks a duplicate discovered after opening the create dialog', async () => {
    await open()
    await click('新增规则')
    vi.mocked(api.getAttendanceRule).mockResolvedValueOnce({
      month: '2026-10',
      departmentId: 3,
      expectedDays: 24,
      revision: 1,
      companyExpectedDays: 26,
      locked: false,
    })
    await chooseDepartment(3)
    expect(dialog().text()).toContain('不能重复新增')
    expect(wrapper.get('input[aria-label="应出勤天数"]').attributes('disabled')).toBeDefined()
    await click('保存规则')
    expect(api.saveAttendanceRule).not.toHaveBeenCalled()
  })
  it('ignores older dialog responses after the month changes', async () => {
    await open()
    await click('新增规则')
    await chooseDepartment(3)
    let finish!: (value: api.AttendanceRule) => void
    vi.mocked(api.getAttendanceRule).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    wrapper
      .findAllComponents({ name: 'ElDatePicker' })
      .find((c) => c.props('ariaLabel') === '规则月份')!
      .vm.$emit('update:modelValue', '2026-09')
    await flushPromises()
    wrapper
      .findAllComponents({ name: 'ElDatePicker' })
      .find((c) => c.props('ariaLabel') === '规则月份')!
      .vm.$emit('update:modelValue', '2026-08')
    await flushPromises()
    finish({
      month: '2026-09',
      departmentId: 3,
      expectedDays: 20,
      revision: 1,
      companyExpectedDays: 26,
      locked: false,
    })
    await flushPromises()
    await setDays('23')
    await click('保存规则')
    expect(api.saveAttendanceRule).toHaveBeenLastCalledWith({
      month: '2026-08',
      departmentId: 3,
      expectedDays: 23,
      revision: 0,
    })
  })
  it('keeps readers read-only and shows retry feedback for failed list requests', async () => {
    permissions.write = false
    await open()
    expect(wrapper.text()).not.toContain('新增规则')
    expect(wrapper.text()).not.toContain('修改公司默认考勤规则')
    await wrapper.get('button[aria-label="查看公司默认考勤规则"]').trigger('click')
    await flushPromises()
    expect(dialog().text()).not.toContain('保存规则')
    expect(wrapper.get('input[aria-label="应出勤天数"]').attributes('disabled')).toBeDefined()
    await click('关闭')
    vi.mocked(api.getAttendanceRules).mockRejectedValueOnce(new Error('列表暂不可用'))
    await click('刷新')
    expect(wrapper.text()).toContain('列表暂不可用')
  })
})
