import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent, h } from 'vue'
import ElementPlus, { ElMessage, ElMessageBox } from 'element-plus'
import Editor from '@/views/supply-chain/hr/HrEmployeeEditor.vue'
import Employees from '@/views/supply-chain/hr/HrEmployeeManagementView.vue'
import ReviewDrawer from '@/views/supply-chain/hr/DhbBindingReviewDrawer.vue'
import Sidebar from '@/components/supply/DepartmentSidebar.vue'
import {
  getHrEmployee,
  getDhbBindingRisks,
  confirmDhbBinding,
  getHrEmployees,
  hrOrganizationApi,
  getHrPositions,
  type HrEmployeeRecord,
} from '@/api/core/hr'
vi.mock('@/api/core/hr', () => ({
  getHrEmployee: vi.fn(),
  getDhbBindingRisks: vi.fn(),
  confirmDhbBinding: vi.fn(),
  getHrEmployees: vi.fn(),
  getHrPositions: vi.fn(),
  hrOrganizationApi: { employeeDepartments: vi.fn(), saveEmployee: vi.fn(), assignments: vi.fn() },
}))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
}))
vi.mock('@/stores/navigation', () => ({ useNavigationStore: () => ({ getNavigation: () => [] }) }))
const Dialog = defineComponent({
  props: ['modelValue'],
  setup:
    (p, { slots }) =>
    () =>
      p.modelValue ? h('div', { role: 'dialog' }, [slots.default?.(), slots.footer?.()]) : null,
})
let wrapper: VueWrapper | undefined
const deps = [
  { id: 1, parentId: null, departmentName: '总公司', statusCode: 'ACTIVE', sortOrder: 0 },
  { id: 2, parentId: 1, departmentName: '杭州', statusCode: 'ACTIVE', sortOrder: 0 },
]
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getDhbBindingRisks).mockResolvedValue([])
  vi.mocked(hrOrganizationApi.employeeDepartments).mockResolvedValue(deps)
  vi.mocked(getHrPositions).mockResolvedValue({
    items: [{ positionCode: 'SALES', positionName: '业务员' }],
    total: 1,
  } as never)
  vi.mocked(getHrEmployees).mockResolvedValue({ items: [], total: 0, begin: 0, step: 20 })
  vi.spyOn(ElMessage, 'success').mockReturnValue({ close: vi.fn() })
  vi.spyOn(ElMessageBox, 'confirm').mockResolvedValue('confirm' as never)
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})
const field = (label: string) =>
  wrapper!.findAll('.el-form-item').find((f) => f.find('label').text() === label)!
async function renderEditor(record: HrEmployeeRecord | null = null) {
  wrapper = mount(Editor, {
    props: { modelValue: false, record },
    global: { plugins: [ElementPlus], stubs: { ElDialog: Dialog } },
  })
  await wrapper.setProps({ modelValue: true })
  await flushPromises()
}
it('居中弹窗选择部门岗位，离职日期必填，提交全部个人资料但不发送审计身份', async () => {
  await renderEditor()
  field('部门').getComponent({ name: 'ElTreeSelect' }).vm.$emit('update:modelValue', 2)
  field('岗位').getComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', 'SALES')
  await field('姓名').get('input').setValue('测试员工')
  await field('身份证号').get('input').setValue('11010519491231002X')
  expect(field('出生日期').get('input').element.value).toBe('1949-12-31')
  field('在职状态').getComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', 'LEFT')
  await flushPromises()
  await wrapper!
    .findAll('button')
    .find((b) => b.text() === '确定')!
    .trigger('click')
  expect(hrOrganizationApi.saveEmployee).not.toHaveBeenCalled()
  expect(wrapper!.text()).toContain('离职员工必须填写离职日期')
  field('离职日期')
    .getComponent({ name: 'ElDatePicker' })
    .vm.$emit('update:modelValue', '2026-09-16')
  field('入职日期')
    .getComponent({ name: 'ElDatePicker' })
    .vm.$emit('update:modelValue', '2020-01-01')
  field('参保状态').getComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', '公积金')
  await field('银行卡号').get('input').setValue('000000000000')
  await field('转正薪资').get('input').setValue('8000+8000')
  await field('毕业院校').get('input').setValue('测试大学')
  await wrapper!
    .findAll('button')
    .find((b) => b.text() === '确定')!
    .trigger('click')
  await flushPromises()
  const command = vi.mocked(hrOrganizationApi.saveEmployee).mock.calls[0][1]
  expect(command).toMatchObject({
    departmentId: 2,
    positionCode: 'SALES',
    jobGrade: 'S1',
    leaveDate: '2026-09-16T00:00:00+08:00',
    profile: {
      socialInsurance: '公积金',
      bankAccount: '000000000000',
      regularSalary: '8000+8000',
      graduationSchool: '测试大学',
    },
  })
  expect(command).not.toHaveProperty('createdBy')
  expect(command).not.toHaveProperty('createdTime')
})
it('编辑先取详情，避免把列表未返回的个人信息清空', async () => {
  const row = {
    id: '9',
    employeeCode: 'EMP9',
    employeeName: '测试',
    employmentStatus: 'ACTIVE',
    revision: 4,
    departmentId: 2,
    positionCode: 'SALES',
  } as HrEmployeeRecord
  vi.mocked(getHrEmployee).mockResolvedValue({
    ...row,
    profile: {
      idNumber: null,
      bankName: '原银行',
      bankAccount: '000000000000',
      socialInsurance: '五险',
    } as never,
  })
  await renderEditor(row)
  expect(getHrEmployee).toHaveBeenCalledWith('9')
  expect(field('开户行').get('input').element.value).toBe('原银行')
  await wrapper!
    .findAll('button')
    .find((b) => b.text() === '确定')!
    .trigger('click')
  await flushPromises()
  expect(hrOrganizationApi.saveEmployee).toHaveBeenCalledWith(
    '9',
    expect.objectContaining({
      revision: 4,
      profile: expect.objectContaining({ bankName: '原银行' }),
    }),
  )
})
describe('员工部门筛选', () => {
  it('默认真实根部门、部门切换和重置、账号搜索与服务端排序', async () => {
    vi.mocked(getHrEmployees).mockResolvedValue({
      items: [
        {
          id: '9',
          employeeCode: 'EMP009',
          employeeName: '测试业务员',
          employmentStatus: 'ACTIVE',
          dhbStaffIds: ['source-009'],
          dhbAccountNames: ['sales.login'],
        } as HrEmployeeRecord,
      ],
      total: 1,
      begin: 0,
      step: 20,
    })
    wrapper = mount(Employees, {
      global: {
        plugins: [ElementPlus, createPinia()],
        stubs: { HrEmployeeEditor: true, ElDialog: Dialog },
      },
    })
    await flushPromises()
    expect(wrapper.getComponent(Sidebar).text()).not.toContain('全部部门')
    expect(getHrEmployees).toHaveBeenLastCalledWith(
      expect.objectContaining({ departmentId: 1, includeSubDepartments: true }),
    )
    wrapper.getComponent(Sidebar).vm.$emit('update:modelValue', 2)
    await flushPromises()
    expect(getHrEmployees).toHaveBeenLastCalledWith(
      expect.objectContaining({ departmentId: 2, begin: 0 }),
    )
    await wrapper
      .findAll('button')
      .find((b) => b.text() === '重置')!
      .trigger('click')
    await flushPromises()
    expect(getHrEmployees).toHaveBeenLastCalledWith(
      expect.objectContaining({ departmentId: 1, begin: 0 }),
    )
    wrapper.findAllComponents({ name: 'ElSelect' })[0]!.vm.$emit('update:modelValue', 'SALES')
    await wrapper.get('input[aria-label="职级"]').setValue('S1')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(getHrEmployees).toHaveBeenLastCalledWith(
      expect.objectContaining({ positionCode: 'SALES', jobGrade: 'S1', begin: 0 }),
    )
    const headings = wrapper.findAll('th').map((h) => h.text())
    expect(headings).toEqual([
      '员工编号',
      '姓名',
      '部门',
      '手机号',
      '订货宝账号',
      '岗位',
      '入职时间',
      '创建时间',
      '关联状态',
      '操作',
    ])
    wrapper
      .getComponent({ name: 'ElTable' })
      .vm.$emit('sort-change', { prop: 'employeeName', order: 'ascending' })
    await flushPromises()
    expect(getHrEmployees).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: 'employeeName', sortDirection: 'asc', begin: 0 }),
    )
    expect(headings).not.toContain('身份证号')
    expect(headings).not.toContain('银行卡号')
    expect(wrapper.text()).toContain('sales.login')
    expect(wrapper.text()).not.toContain('source-009')
    await wrapper.get('input[aria-label="关键词"]').setValue('sales.login')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(getHrEmployees).toHaveBeenLastCalledWith(
      expect.objectContaining({ keyword: 'sales.login' }),
    )
  })
})

describe('关联风险确认', () => {
  const risk = {
    bindingId: 12,
    version: 3,
    employeeId: '9',
    employeeCode: 'EMP9',
    employeeName: '测试员工',
    mobile: '13800000000',
    departmentName: '运营部',
    sourceStaffId: 'source-9',
    accountName: 'sales.login',
    sourceEmployeeName: '（测试）员工',
    sourceMobile: '13800000000',
    reason: '来源姓名不一致',
  }
  async function renderReview() {
    wrapper = mount(ReviewDrawer, {
      props: { modelValue: true, risks: [risk], employeeId: '9' },
      global: { plugins: [ElementPlus], stubs: { ElDrawer: Dialog } },
    })
    await flushPromises()
  }
  it('确认携带核对版本，成功后才解除提示', async () => {
    vi.mocked(confirmDhbBinding).mockResolvedValue(true)
    await renderReview()
    expect(wrapper!.text()).toContain('sales.login')
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === '确认关联')!
      .trigger('click')
    await flushPromises()
    expect(confirmDhbBinding).toHaveBeenCalledWith(12, 3, '9')
    expect(wrapper!.emitted('resolved')).toHaveLength(1)
    expect(wrapper!.emitted('update:modelValue')).toEqual([[false]])
  })
  it('版本冲突保留风险和抽屉，不误报成功', async () => {
    vi.mocked(confirmDhbBinding).mockRejectedValue(new Error('关联已更新，请刷新后重新核对'))
    await renderReview()
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === '确认关联')!
      .trigger('click')
    await flushPromises()
    expect(wrapper!.text()).toContain('关联已更新，请刷新后重新核对')
    expect(wrapper!.emitted('resolved')).toBeUndefined()
    expect(ElMessage.success).not.toHaveBeenCalled()
  })
})
