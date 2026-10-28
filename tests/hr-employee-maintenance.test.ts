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
vi.mock('@/views/supply-chain/hr/PayrollComponentView.vue', () => ({
  default: { template: '<div>员工薪资标准</div>' },
}))
vi.mock('@/views/supply-chain/hr/components/EmployeeCityScope.vue', () => ({
  default: {
    props: ['employee'],
    template: '<div class="employee-city-scope">管辖城市：{{ employee.employeeName }}</div>',
  },
}))
const links = vi.hoisted(() => ({ query: {} as Record<string, string>, canUpdate: true }))
vi.mock('vue-router', () => ({ useRoute: () => links }))
vi.mock('@/api/core/hr', () => ({
  getHrEmployee: vi.fn(),
  getDhbBindingRisks: vi.fn(),
  confirmDhbBinding: vi.fn(),
  getHrEmployees: vi.fn(),
  getHrPositions: vi.fn(),
  hrOrganizationApi: { employeeDepartments: vi.fn(), saveEmployee: vi.fn(), assignments: vi.fn() },
}))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({
    can: (permission: string) => (permission === 'hr:employee:update' ? links.canUpdate : true),
  }),
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
  {
    id: 2,
    parentId: 1,
    departmentName: '杭州',
    statusCode: 'ACTIVE',
    sortOrder: 0,
    leaderEmployeeCode: 'EMP009',
  },
]
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn()
  vi.resetAllMocks()
  links.query = {}
  links.canUpdate = true
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

it('城市总汇总跳转直接打开同一份员工档案的管辖页签，不要求员工基本资料修改权限', async () => {
  links.query = { cityScopeEmployeeCode: 'M1' }
  links.canUpdate = false
  const row = {
    id: '9',
    employeeCode: 'M1',
    employeeName: '测试城市总',
    positionName: '城市总',
    employmentStatus: 'ACTIVE',
  } as HrEmployeeRecord
  vi.mocked(getHrEmployees).mockImplementation(async (params) => ({
    items: params.employeeCode ? [row] : [],
    total: params.employeeCode ? 1 : 0,
    begin: 0,
    step: params.step,
  }))
  vi.mocked(getHrEmployee).mockResolvedValue(row)
  vi.mocked(hrOrganizationApi.assignments).mockResolvedValue([])
  wrapper = mount(Employees, {
    global: {
      plugins: [ElementPlus, createPinia()],
      stubs: { HrEmployeeEditor: true, ElDialog: Dialog },
    },
  })
  await flushPromises()
  expect(getHrEmployees).toHaveBeenCalledWith({ begin: 0, step: 2, employeeCode: 'M1' })
  expect(wrapper.get('.employee-city-scope').text()).toContain('管辖城市：测试城市总')
  expect(wrapper.findAllComponents({ name: 'ElTabs' })[0]!.props('modelValue')).toBe('city-scope')
  expect(hrOrganizationApi.saveEmployee).not.toHaveBeenCalled()
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
  field('薪酬类别').getComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', 'HEADQUARTERS')
  await field('手机号').get('input').setValue('13800000000')
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
    regularized: false,
    payrollCategory: 'HEADQUARTERS',
    mobile: '13800000000',
    entryDate: '2020-01-01T00:00:00+08:00',
    profile: {
      idNumber: '11010519491231002X',
      probationPeriod: '3个月',
      bankName: '原银行',
      bankAccount: '000000000000',
      socialInsurance: '五险',
    } as never,
  })
  await renderEditor(row)
  expect(getHrEmployee).toHaveBeenCalledWith('9')
  expect(field('开户行').get('input').element.value).toBe('原银行')
  expect(field('试用期').get('input').element.value).toBe('3')
  expect(field('试用期').text()).toContain('个月')
  await wrapper!
    .findAll('button')
    .find((b) => b.text() === '确定')!
    .trigger('click')
  await flushPromises()
  expect(hrOrganizationApi.saveEmployee).toHaveBeenCalledWith(
    '9',
    expect.objectContaining({
      revision: 4,
      profile: expect.objectContaining({ bankName: '原银行', probationPeriod: '3' }),
    }),
  )
})
it('员工资料不再重复维护金额，新建后在薪资标准页签录入', async () => {
  await renderEditor()
  field('部门').getComponent({ name: 'ElTreeSelect' }).vm.$emit('update:modelValue', 2)
  field('岗位').getComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', 'SALES')
  await field('姓名').get('input').setValue('薪资测试员工')
  await field('手机号').get('input').setValue('13800000000')
  await field('身份证号').get('input').setValue('11010519491231002X')
  field('入职日期')
    .getComponent({ name: 'ElDatePicker' })
    .vm.$emit('update:modelValue', '2026-01-01')
  field('薪酬类别').getComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', 'SALES')
  field('是否转正').getComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', true)
  await flushPromises()
  field('转正日期')
    .getComponent({ name: 'ElDatePicker' })
    .vm.$emit('update:modelValue', '2026-09-01')
  expect(wrapper!.text()).not.toContain('转正底薪（元 / 月）')
  await wrapper!
    .findAll('button')
    .find((b) => b.text() === '确定')!
    .trigger('click')
  await flushPromises()
  expect(hrOrganizationApi.saveEmployee).toHaveBeenCalledWith(
    null,
    expect.objectContaining({
      payrollCategory: 'SALES',
      regularized: true,
      regularizationDate: '2026-09-01',
    }),
  )
})

it.each(['新增', '编辑'])(
  '%s提交时一次展示全部基础资料缺项，修改后逐项消除错误且不清空已填数据',
  async (mode) => {
    const record =
      mode === '编辑'
        ? ({
            id: '9',
            employeeCode: 'EMP9',
            employeeName: '',
            departmentId: null,
            positionCode: '',
            employmentStatus: 'ACTIVE',
            regularized: false,
            payrollCategory: null,
            mobile: null,
            entryDate: null,
            profile: null,
            revision: 4,
          } as unknown as HrEmployeeRecord)
        : null
    if (record) vi.mocked(getHrEmployee).mockResolvedValue(record)
    await renderEditor(record)
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === '确定')!
      .trigger('click')
    await flushPromises()
    const summary = wrapper!.get('[aria-label="员工资料校验问题"]')
    for (const text of ['姓名', '部门', '岗位', '手机号', '身份证号', '入职日期', '薪酬类别'])
      expect(summary.text()).toContain(text)
    expect(wrapper!.text()).not.toMatch(/is required|must be|validation failed/i)
    expect(hrOrganizationApi.saveEmployee).not.toHaveBeenCalled()
    await field('姓名').get('input').setValue('已填写的姓名')
    expect(summary.text()).not.toContain('请填写姓名')
    expect(summary.text()).toContain('请填写手机号')
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === '确定')!
      .trigger('click')
    expect(field('姓名').get('input').element.value).toBe('已填写的姓名')
    expect(hrOrganizationApi.saveEmployee).not.toHaveBeenCalled()
  },
)

it('薪酬类别清空时显示中文必填提示，试用期输入框只填数字且单位在框外', async () => {
  await renderEditor()
  const category = field('薪酬类别').getComponent({ name: 'ElSelect' })
  category.vm.$emit('update:modelValue', 'SALES')
  await flushPromises()
  category.vm.$emit('update:modelValue', '')
  await flushPromises()
  expect(field('薪酬类别').text()).toContain('请选择薪酬类别')
  expect(wrapper!.text()).not.toContain('is required')
  expect(field('试用期').findComponent({ name: 'ElInputNumber' }).exists()).toBe(true)
  expect(field('试用期').text()).toContain('个月')
  const input = field('试用期').get('input')
  expect(
    field('在职状态')
      .getComponent({ name: 'ElSelect' })
      .findAllComponents({ name: 'ElOption' })
      .map((option) => option.props('value')),
  ).toEqual(['ACTIVE', 'LEFT'])
  await input.setValue('6')
  await input.trigger('change')
  expect(input.element.value).toBe('6')
  expect(hrOrganizationApi.saveEmployee).not.toHaveBeenCalled()
})

describe('员工部门筛选', () => {
  it('默认入职时间排序、部门切换清除筛选、重置保留当前部门', async () => {
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
      expect.objectContaining({
        departmentId: 1,
        includeSubDepartments: true,
        sortBy: 'entryDate',
        sortDirection: 'desc',
      }),
    )
    await wrapper.get('input[aria-label="关键词"]').setValue('旧部门关键词')
    wrapper.findAllComponents({ name: 'ElSelect' })[1]!.vm.$emit('update:modelValue', 'LEFT')
    wrapper.getComponent({ name: 'ElPagination' }).vm.$emit('update:current-page', 3)
    wrapper.getComponent(Sidebar).vm.$emit('update:modelValue', 2)
    await flushPromises()
    expect(getHrEmployees).toHaveBeenLastCalledWith(
      expect.objectContaining({
        departmentId: 2,
        begin: 0,
        keyword: undefined,
        employmentStatus: undefined,
      }),
    )
    await wrapper
      .findAll('button')
      .find((b) => b.text() === '重置')!
      .trigger('click')
    await flushPromises()
    expect(getHrEmployees).toHaveBeenLastCalledWith(
      expect.objectContaining({
        departmentId: 2,
        begin: 0,
        sortBy: 'entryDate',
        sortDirection: 'desc',
      }),
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
      '姓名',
      '在职状态',
      '部门',
      '岗位',
      '入职时间',
      '手机号',
      '订货宝账号',
      '员工编号',
      '是否转正',
      '薪酬类别',
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

it('按负责人编号高亮姓名，只提供在职与离职，旧来源未核定状态不推断为在职或离职', async () => {
  vi.mocked(getHrEmployees).mockResolvedValue({
    items: ['ACTIVE', 'PENDING', 'INACTIVE', 'LEFT'].map(
      (employmentStatus, i) =>
        ({
          id: String(i + 1),
          employeeCode: i === 0 ? 'EMP009' : `OTHER${i}`,
          employeeName: '同名员工',
          employmentStatus,
          departmentId: 2,
          departmentName: '杭州',
        }) as HrEmployeeRecord,
    ),
    total: 4,
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
  const names = wrapper.findAll('.employee-name')
  expect(names).toHaveLength(4)
  expect(names[0]!.classes()).toContain('employee-name--leader')
  expect(names[0]!.attributes('title')).toBe('杭州负责人')
  expect(names.slice(1).every((n) => !n.classes().includes('employee-name--leader'))).toBe(true)
  expect(wrapper.findAll('.employment-status').map((n) => n.text())).toEqual([
    '在职',
    '—',
    '—',
    '离职',
  ])
  expect(
    wrapper
      .findAllComponents({ name: 'ElSelect' })[1]!
      .findAllComponents({ name: 'ElOption' })
      .map((option) => option.props('value')),
  ).toEqual(['ACTIVE', 'LEFT'])
  expect(wrapper.findAll('.employee-left-row')).toHaveLength(1)
  expect(wrapper.findAll('th').map((n) => n.text())).not.toContain('部门负责人')
  wrapper.getComponent(Sidebar).vm.$emit('update:modelValue', 2)
  await flushPromises()
  expect(wrapper.get('h1').text()).toBe('杭州')
  expect(wrapper.get('.employee-count').text()).toBe('4 人')
  wrapper
    .getComponent(Sidebar)
    .getComponent({ name: 'ElCheckbox' })
    .vm.$emit('update:modelValue', false)
  wrapper.getComponent(Sidebar).getComponent({ name: 'ElCheckbox' }).vm.$emit('change', false)
  await flushPromises()
  expect(getHrEmployees).toHaveBeenLastCalledWith(
    expect.objectContaining({ departmentId: 2, includeSubDepartments: false, begin: 0 }),
  )
  wrapper.getComponent({ name: 'ElTable' }).vm.$emit('sort-change', { prop: null, order: null })
  await flushPromises()
  expect(getHrEmployees).toHaveBeenLastCalledWith(
    expect.objectContaining({ sortBy: 'entryDate', sortDirection: 'desc' }),
  )
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
