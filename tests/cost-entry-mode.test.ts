import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import ElementPlus from 'element-plus'
import MarketingFields from '@/views/supply-chain/cost/CostMarketingFields.vue'
import EntryMode from '@/views/supply-chain/cost/CostEntryMode.vue'
import type { CostCommand, CostEmployee } from '@/api/core/cost'

const wrappers: VueWrapper[] = []
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
})
const employees: CostEmployee[] = [
  { employeeCode: 'E1', employeeName: '经办甲', departmentId: 1, departmentName: '市场部' },
  { employeeCode: 'E2', employeeName: '经办乙', departmentId: 2, departmentName: '销售部' },
]
function mountMarketing(overrides: Partial<CostCommand> = {}) {
  const form = reactive<CostCommand>({
    requestId: 'request',
    revision: null,
    title: '活动费用',
    typeCode: 'PROMOTION',
    cityCode: 'C1',
    cityName: '城市',
    costDate: '2026-10-19',
    amount: 10,
    paymentStatusCode: '',
    ownerEmployeeCode: null,
    ownerName: '',
    departmentId: null,
    logistics: null,
    rental: null,
    remark: '',
    reason: '',
    ...overrides,
  })
  const wrapper = mount(MarketingFields, {
    props: { modelValue: form, action: 'erp:cost:marketing:write', employees },
    global: {
      plugins: [ElementPlus],
      stubs: { CostCitySelect: true, CostRecordBasics: true, CostDictSelect: true },
    },
  })
  wrappers.push(wrapper)
  return { wrapper, form, entry: wrapper.getComponent(EntryMode) }
}

describe('marketing employee entry', () => {
  it('defaults new records to employee selection and clears the department when switching to manual entry', async () => {
    const { wrapper, form, entry } = mountMarketing()
    expect(entry.props('modelValue')).toBe('LINKED')
    expect(entry.findComponent({ name: 'ElInput' }).exists()).toBe(false)
    const select = entry.getComponent({ name: 'ElSelect' })
    select.vm.$emit('update:modelValue', 'E1')
    select.vm.$emit('change', 'E1')
    await flushPromises()
    expect(form).toMatchObject({ ownerEmployeeCode: 'E1', ownerName: '经办甲', departmentId: 1 })
    entry.vm.$emit('update:modelValue', 'MANUAL')
    await flushPromises()
    expect(form).toMatchObject({ ownerEmployeeCode: null, ownerName: '经办甲', departmentId: null })
    expect(entry.findComponent({ name: 'ElSelect' }).exists()).toBe(false)
    await entry.getComponent({ name: 'ElInput' }).get('input').setValue('实际经办人')
    entry.vm.$emit('update:modelValue', 'LINKED')
    await flushPromises()
    expect(form).toMatchObject({ ownerEmployeeCode: 'E1', ownerName: '经办甲', departmentId: 1 })
    entry.vm.$emit('update:modelValue', 'MANUAL')
    await flushPromises()
    expect(form).toMatchObject({
      ownerEmployeeCode: null,
      ownerName: '实际经办人',
      departmentId: null,
    })

    await wrapper.setProps({
      modelValue: reactive({
        ...form,
        ownerEmployeeCode: 'E2',
        ownerName: '经办乙',
        departmentId: 2,
      }),
    })
    expect(entry.props('modelValue')).toBe('LINKED')
    entry.vm.$emit('update:modelValue', 'MANUAL')
    await flushPromises()
    expect(entry.getComponent({ name: 'ElInput' }).get('input').element.value).toBe('经办乙')
  })

  it('opens historical manual names in manual mode without matching employees by name', async () => {
    const { form, entry } = mountMarketing({ ownerName: '经办甲' })
    expect(entry.props('modelValue')).toBe('MANUAL')
    expect(form.ownerEmployeeCode).toBeNull()
    entry.vm.$emit('update:modelValue', 'LINKED')
    await flushPromises()
    expect(form).toMatchObject({ ownerEmployeeCode: null, ownerName: '', departmentId: null })
    entry.vm.$emit('update:modelValue', 'MANUAL')
    await flushPromises()
    expect(form.ownerName).toBe('经办甲')
  })

  it('retains a saved employee name when the current lookup has no matching row, and clears it on explicit removal', async () => {
    const { wrapper, form, entry } = mountMarketing({
      ownerEmployeeCode: 'OLD',
      ownerName: '历史经办人',
      departmentId: 7,
    })
    await wrapper.setProps({ employees: [] })
    const select = entry.getComponent({ name: 'ElSelect' })
    expect(
      select.findAllComponents({ name: 'ElOption' }).map((option) => option.props('label')),
    ).toEqual(['历史经办人'])
    select.vm.$emit('update:modelValue', null)
    select.vm.$emit('change', null)
    await flushPromises()
    expect(form).toMatchObject({ ownerEmployeeCode: null, ownerName: '', departmentId: null })
    expect(entry.props('modelValue')).toBe('LINKED')
  })

  it('shows a retry on employee load failure and only offers an empty-result shortcut after recovery', async () => {
    const { wrapper, entry } = mountMarketing()
    await wrapper.setProps({ employees: [], employeeError: '员工资料加载失败' })
    expect(entry.find('.employee-error').text()).toContain('员工资料加载失败')
    await entry.get('.employee-error button').trigger('click')
    expect(wrapper.emitted('reloadEmployees')).toHaveLength(1)
    expect(entry.props('modelValue')).toBe('LINKED')
    expect(document.body.textContent).not.toContain('手动填写费用负责人')
    await wrapper.setProps({ employeeError: '', employeeLoading: false })
    await entry.getComponent({ name: 'ElSelect' }).get('input').trigger('click')
    await flushPromises()
    const shortcut = [...document.body.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('手动填写费用负责人'),
    )!
    expect(shortcut).toBeDefined()
    shortcut.click()
    await flushPromises()
    expect(entry.props('modelValue')).toBe('MANUAL')
  })
})
