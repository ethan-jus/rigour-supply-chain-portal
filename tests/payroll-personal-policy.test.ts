import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import Editor from '@/views/supply-chain/hr/components/PayrollPersonalPolicyEditor.vue'
import { getPayrollComponents } from '@/api/core/payroll-scheme/components'
import type { PayrollComponentVersionView } from '@/api/core/payroll-scheme/models/PayrollComponentVersionView'
import { newPayrollScheme } from '@/utils/payroll-scheme'
vi.mock('@/api/core/payroll-scheme/components', () => ({ getPayrollComponents: vi.fn() }))
let wrapper: VueWrapper
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
    expect(wrapper.text()).toContain('历史关联：废弃补贴')
    expect(wrapper.getComponent({ name: 'ElSelect' }).props('modelValue')).toBeNull()
    wrapper.getComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', '使用中的补贴')
    await flushPromises()
    expect(form.personalPolicy?.allowanceVersionId).toBe('使用中的补贴')
    expect(wrapper.text()).not.toContain('历史关联：')
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
