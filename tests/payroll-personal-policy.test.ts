import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Editor from '@/views/supply-chain/hr/components/PayrollPersonalPolicyEditor.vue'
import { getPayrollComponents } from '@/api/core/payroll-scheme/components'
import type { PayrollComponentVersionView } from '@/api/core/payroll-scheme/models/PayrollComponentVersionView'
import { newPayrollScheme } from '@/utils/payroll-scheme'
import {
  getHrEmployees,
  hrOrganizationApi,
  type HrEmployeeRecord,
  type HrAssignment,
} from '@/api/core/hr'
vi.mock('@/api/core/payroll-scheme/components', () => ({ getPayrollComponents: vi.fn() }))
vi.mock('@/api/core/hr', () => ({
  getHrEmployees: vi.fn(),
  hrOrganizationApi: { assignments: vi.fn() },
}))
let wrapper: VueWrapper<InstanceType<typeof Editor>>
const plan = (
  id: string,
  patch: Partial<PayrollComponentVersionView> = {},
): PayrollComponentVersionView => ({
  id,
  ruleId: id,
  ruleCode: id,
  version: 1,
  reason: '',
  createdBy: 'HR',
  createdTime: '2000-01-01T00:00:00Z',
  definition: {
    name: id,
    kind: 'ALLOWANCE',
    role: 'SALES',
    departmentIds: [1],
    employeeCodes: [],
    effectiveFrom: '2000-01-01',
    effectiveTo: '9999-12-31',
    salary: null,
    performance: null,
    commission: null,
    calendar: null,
    allowance: { items: [], proration: 'CONFIRMED_ATTENDANCE' },
  },
  ...patch,
})
afterEach(() => {
  wrapper?.unmount()
  vi.clearAllMocks()
})
async function open(linked: string | null = null) {
  const active = plan('使用中的补贴')
  const original = plan('旧版本', { ruleId: 'same', version: 1 })
  const newer = plan('新版本', { ruleId: 'same', version: 2 })
  const stopped = plan('停用补贴', {
    stateChanges: [
      {
        revision: 1,
        effectiveMonth: '2000-01',
        enabled: false,
        reason: '',
        actor: 'HR',
        time: '2000-01-01T00:00:00Z',
      },
    ],
  })
  const retired = plan('废弃补贴', {
    stateChanges: [
      {
        revision: 2,
        effectiveMonth: '2000-01',
        enabled: false,
        retired: true,
        reason: '',
        actor: 'HR',
        time: '2000-01-01T00:00:00Z',
      },
    ],
  })
  const pending = plan('未生效补贴')
  pending.definition.effectiveFrom = '9999-01-01'
  const expired = plan('已到期补贴')
  expired.definition.effectiveTo = '2001-12-31'
  const other = plan('其他身份补贴')
  other.definition.role = 'CITY_MANAGER'
  vi.mocked(getPayrollComponents).mockResolvedValue([
    active,
    original,
    newer,
    stopped,
    retired,
    pending,
    expired,
    other,
  ])
  const form = newPayrollScheme()
  form.personalPolicy = {
    exemptDays: [],
    allowanceVersionId: linked,
    probationUntil: null,
    probationBasePercent: 80,
    protectionUntil: null,
    salaryChangeDate: null,
    baseAfterChange: null,
    performanceAfterChange: null,
  }
  wrapper = mount(Editor, {
    props: { modelValue: form },
    global: { plugins: [ElementPlus], stubs: { HrDateCalendar: true } },
  })
  await flushPromises()
  return form
}
describe('个人关联补贴选项', () => {
  it('仅提供使用中的当前版本，排除停用、废弃、到期、待生效、历史及其他身份', async () => {
    await open()
    const options = wrapper.findAllComponents({ name: 'ElOption' })
    expect(options.map((option) => option.props('value'))).toEqual(['使用中的补贴', '新版本'])
  })
  it('保留旧关联的名称和原值供查看，重新选择时只能关联使用中的方案', async () => {
    const form = await open('废弃补贴')
    expect(form.personalPolicy?.allowanceVersionId).toBe('废弃补贴')
    expect(wrapper.text()).toContain('已关联：废弃补贴')
    expect(wrapper.getComponent({ name: 'ElSelect' }).props('modelValue')).toBeNull()
    wrapper.getComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', '使用中的补贴')
    await flushPromises()
    expect(form.personalPolicy?.allowanceVersionId).toBe('使用中的补贴')
    expect(wrapper.text()).not.toContain('已关联：')
  })
})

describe('试用期底薪发放比例', () => {
  it('销售新配置默认100%，仍可修改比例；绩效规则保持原值', async () => {
    vi.mocked(getPayrollComponents).mockResolvedValue([])
    const form = newPayrollScheme()
    const performance = structuredClone(form.sales)
    wrapper = mount(Editor, {
      props: { modelValue: form },
      global: { plugins: [ElementPlus], stubs: { HrDateCalendar: true } },
    })
    await flushPromises()
    expect(form.personalPolicy?.probationBasePercent).toBe(100)
    expect(form.personalPolicy?.postProbationBasePercent).toBe(100)
    const input = wrapper.get('input[aria-label="试用期底薪发放比例"]')
    expect((input.element as HTMLInputElement).value).toBe('100.00')
    await input.setValue('92.5')
    await input.trigger('change')
    expect(form.personalPolicy?.probationBasePercent).toBe(92.5)
    expect(form.sales).toEqual(performance)
    expect(wrapper.text()).toContain('绩效仍按绩效规则考核')
    expect(wrapper.text()).toContain('留空不启用试用期折算')
  })
  it('原有80%按原值回显，手动填写0也保留', async () => {
    const form = await open()
    const input = wrapper.get('input[aria-label="试用期底薪发放比例"]')
    expect((input.element as HTMLInputElement).value).toBe('80.00')
    await input.setValue('0')
    await input.trigger('change')
    expect(form.personalPolicy?.probationBasePercent).toBe(0)
  })
})

describe('试用期结束后的底薪比例', () => {
  it('旧配置默认显示100%，结束前后比例可独立修改并保留0', async () => {
    const form = await open()
    const input = wrapper.get('input[aria-label="试用期结束后底薪发放比例"]')
    expect((input.element as HTMLInputElement).value).toBe('100.00')
    await input.setValue('90')
    await input.trigger('change')
    expect(form.personalPolicy?.postProbationBasePercent).toBe(90)
    expect(form.personalPolicy?.probationBasePercent).toBe(80)
    await input.setValue('0')
    await input.trigger('change')
    expect(form.personalPolicy?.postProbationBasePercent).toBe(0)
  })
  it('已保存的结束后比例按原值回显，只读时不能编辑', async () => {
    vi.mocked(getPayrollComponents).mockResolvedValue([])
    const form = newPayrollScheme()
    const saved = structuredClone(form)
    saved.personalPolicy = {
      ...form.personalPolicy!,
      exemptDays: [],
      allowanceVersionId: null,
      probationUntil: '2026-09-16',
      probationBasePercent: 80,
      postProbationBasePercent: 92.5,
      protectionUntil: null,
      salaryChangeDate: null,
      baseAfterChange: null,
      performanceAfterChange: null,
    }
    wrapper = mount(Editor, {
      props: { modelValue: saved, disabled: true },
      global: { plugins: [ElementPlus], stubs: { HrDateCalendar: true } },
    })
    await flushPromises()
    const input = wrapper.get('input[aria-label="试用期结束后底薪发放比例"]')
    expect((input.element as HTMLInputElement).value).toBe('92.50')
    expect(input.attributes('disabled')).toBeDefined()
    expect(saved.personalPolicy.postProbationBasePercent).toBe(92.5)
  })
})

const employeeRecord = (patch: Partial<HrEmployeeRecord> = {}) =>
  ({
    id: 'ACTIVE-ID',
    employeeCode: 'E-ACTIVE',
    employeeName: '同名员工',
    employmentStatus: 'ACTIVE',
    departmentId: 1,
    entryDate: '2026-10-14T16:00:00Z',
    ...patch,
  }) as HrEmployeeRecord
const assignment = (patch: Partial<HrAssignment> = {}): HrAssignment => ({
  id: 1,
  departmentId: 1,
  departmentName: '销售部',
  positionCode: 'SALES',
  positionName: '销售',
  effectiveFrom: '2026-10-14T16:00:00Z',
  effectiveTo: null,
  ...patch,
})
async function openForEmployment(
  history: HrAssignment[] = [assignment()],
  linked: string | null = null,
  entryDate = '2026-10-14T16:00:00Z',
) {
  const correct = plan('十月销售补贴')
  correct.definition.effectiveFrom = '2026-10-01'
  correct.definition.effectiveTo = '2026-10-31'
  const future = plan('十一月销售补贴')
  future.definition.effectiveFrom = '2026-11-01'
  const otherDepartment = plan('其他部门补贴')
  otherDepartment.definition.departmentIds = [2]
  const otherRole = plan('总部补贴')
  otherRole.definition.role = 'HEADQUARTERS'
  const stopped = plan('十月停用补贴', {
    stateChanges: [
      {
        revision: 1,
        effectiveMonth: '2026-10',
        enabled: false,
        reason: '停用',
        actor: 'HR',
        time: '2026-10-01T00:00:00Z',
      },
    ],
  })
  vi.mocked(getPayrollComponents).mockResolvedValue([
    correct,
    future,
    otherDepartment,
    otherRole,
    stopped,
  ])
  vi.mocked(getHrEmployees).mockResolvedValue({
    begin: 0,
    step: 2,
    total: 2,
    items: [
      employeeRecord({
        id: 'LEFT-ID',
        employeeCode: 'E-LEFT',
        employmentStatus: 'LEFT',
        departmentId: 1,
        entryDate: '2026-01-01T00:00:00Z',
        leaveDate: '2026-09-30T00:00:00Z',
      }),
      employeeRecord({ entryDate }),
    ],
  })
  vi.mocked(hrOrganizationApi.assignments).mockResolvedValue(history)
  const form = newPayrollScheme()
  form.effectiveFrom = '2026-10-01'
  form.personalPolicy = {
    exemptDays: [],
    allowanceVersionId: linked,
    probationUntil: null,
    probationBasePercent: 100,
    protectionUntil: null,
    salaryChangeDate: null,
    baseAfterChange: null,
    performanceAfterChange: null,
  }
  wrapper = mount(Editor, {
    props: { modelValue: form, employeeCode: 'E-ACTIVE' },
    global: { plugins: [ElementPlus], stubs: { HrDateCalendar: true } },
  })
  await flushPromises()
  return form
}
const offeredPlans = () =>
  wrapper.findAllComponents({ name: 'ElOption' }).map((option) => option.props('value'))

describe('个人补贴按所选档案的任职和生效月关联', () => {
  it('同部门同名离职档案在前时仍只查在职员工编号，月中入职可选择当月适用补贴', async () => {
    const form = await openForEmployment()
    expect(getHrEmployees).toHaveBeenCalledWith({ begin: 0, step: 2, employeeCode: 'E-ACTIVE' })
    expect(hrOrganizationApi.assignments).toHaveBeenCalledWith('ACTIVE-ID')
    expect(hrOrganizationApi.assignments).not.toHaveBeenCalledWith('LEFT-ID')
    expect(offeredPlans()).toEqual(['十月销售补贴'])
    wrapper.getComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', '十月销售补贴')
    await flushPromises()
    expect(wrapper.vm.validate()).toBeNull()
    expect(form.personalPolicy?.allowanceVersionId).toBe('十月销售补贴')
  })
  it('按薪资生效月份筛选而非今天；改变月份后原关联不自动覆盖', async () => {
    const form = await openForEmployment([assignment()], '十月销售补贴')
    expect(offeredPlans()).toEqual(['十月销售补贴'])
    await wrapper.setProps({ modelValue: { ...form, effectiveFrom: '2026-11-01' } })
    expect(offeredPlans()).toEqual(['十一月销售补贴'])
    expect(form.personalPolicy?.allowanceVersionId).toBe('十月销售补贴')
    expect(wrapper.vm.validate()).toContain('重新选择或清除关联')
  })
  it('不适用的旧关联保留供核对，保存提示重新选择，身份改变不偷换关联', async () => {
    const form = await openForEmployment([assignment()], '其他部门补贴')
    expect(offeredPlans()).not.toContain('其他部门补贴')
    expect(wrapper.text()).toContain('已关联：其他部门补贴')
    expect(wrapper.vm.validate()).toContain('不适用于当前身份、任职部门或生效月份')
    await wrapper.setProps({ modelValue: { ...form, role: 'HEADQUARTERS' } })
    expect(offeredPlans()).toEqual(['总部补贴'])
    expect(form.personalPolicy?.allowanceVersionId).toBe('其他部门补贴')
  })
  it.each([{ history: [] }, { history: [assignment(), assignment({ id: 2 })] }])(
    '缺失或重叠任职时不提供任意部门补贴，也不清空原关联：%j',
    async ({ history }) => {
      const form = await openForEmployment(history, '十月销售补贴')
      expect(offeredPlans()).toEqual([])
      expect(wrapper.vm.validate()).toContain('没有唯一有效的任职部门')
      expect(form.personalPolicy?.allowanceVersionId).toBe('十月销售补贴')
    },
  )
  it('本次档案下月才入职时不借用同名旧档在本月的任职', async () => {
    await openForEmployment([assignment()], '十月销售补贴', '2026-11-01T00:00:00Z')
    expect(offeredPlans()).toEqual([])
    expect(wrapper.vm.validate()).toContain('早于该员工档案的入职月份')
  })
  it('任职读取失败保留原关联且不展示未经核实的候选项', async () => {
    await openForEmployment([assignment()], '十月销售补贴')
    vi.mocked(hrOrganizationApi.assignments).mockRejectedValueOnce(new Error('任职暂不可用'))
    vi.mocked(getHrEmployees).mockResolvedValueOnce({
      begin: 0,
      step: 2,
      total: 1,
      items: [employeeRecord({ employeeCode: 'E-NEXT' })],
    })
    await wrapper.setProps({ employeeCode: 'E-NEXT' })
    await flushPromises()
    expect(offeredPlans()).toEqual([])
    expect(wrapper.vm.validate()).toContain('任职暂不可用')
    expect(wrapper.props('modelValue').personalPolicy?.allowanceVersionId).toBe('十月销售补贴')
  })
})
