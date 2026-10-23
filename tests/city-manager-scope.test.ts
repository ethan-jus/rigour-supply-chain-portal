import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper, type DOMWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import ElementPlus from 'element-plus'
import Editor from '@/views/supply-chain/hr/HrEmployeeEditor.vue'
import Fields from '@/views/supply-chain/hr/components/EmployeeCityScopeFields.vue'
import Scope from '@/views/supply-chain/hr/components/EmployeeCityScope.vue'
import Management from '@/views/supply-chain/hr/PayrollRuleView.vue'
import { getPayrollEmployees, getPayrollRules, type PayrollRule } from '@/api/core/payroll'
import { getCostCities } from '@/api/core/cost'
import { getHrPositions, hrOrganizationApi, type HrEmployeeRecord } from '@/api/core/hr'
import type { HrEmployeeCityScopeCommand } from '@/api/core/hr/models/HrEmployeeCityScopeCommand'

const state = vi.hoisted(() => ({ write: true, employeeRead: true, push: vi.fn() }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: state.push }) }))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({
    can: (permission: string) =>
      permission === 'hr:payroll-rule:write'
        ? state.write
        : permission === 'hr:employee:read'
          ? state.employeeRead
          : true,
  }),
}))
vi.mock('@/api/core/payroll', () => ({ getPayrollRules: vi.fn(), getPayrollEmployees: vi.fn() }))
vi.mock('@/api/core/cost', () => ({ getCostCities: vi.fn() }))
vi.mock('@/api/core/hr', () => ({
  getHrEmployee: vi.fn(),
  getHrPositions: vi.fn(),
  hrOrganizationApi: { employeeDepartments: vi.fn(), saveEmployee: vi.fn() },
}))
vi.mock('@/views/supply-chain/hr/PayrollComponentView.vue', () => ({
  default: { template: '<div />' },
}))
const Dialog = defineComponent({
  props: ['modelValue'],
  setup:
    (p, { slots }) =>
    () =>
      p.modelValue ? h('div', { role: 'dialog' }, [slots.default?.(), slots.footer?.()]) : null,
})
const employee = {
  id: '9',
  employeeCode: 'M1',
  employeeName: '测试城市总',
  positionName: '城市总',
  payrollCategory: 'SALES',
} as HrEmployeeRecord
const cities = [
  { code: 'C1', name: '石家庄市' },
  { code: 'C2', name: '唐山市' },
]
const existing = (): PayrollRule => ({
  id: 'scope-1',
  revision: 4,
  updatedTime: '',
  data: {
    requestId: 'old-request',
    revision: null,
    name: '原管辖记录',
    kindCode: 'CITY_MANAGER',
    employeeCode: 'M1',
    cityCode: 'C1',
    cityName: '石家庄市',
    departmentIds: [],
    includeOwnSalesCommission: false,
    cityCommission: { teamPercent: 65, products: [] },
    productId: null,
    productVariantId: null,
    productName: null,
    unitCode: null,
    groupCode: null,
    recipientRoleCode: 'CITY_MANAGER',
    methodCode: null,
    rate: null,
    amount: null,
    effectiveFrom: '2026-09-01',
    effectiveTo: '9999-12-31',
    enabled: true,
    remark: '原备注',
    performancePolicy: null,
  },
})
const page = (items: PayrollRule[]) => ({ items, begin: 0, step: 200, total: items.length })
let wrapper: VueWrapper
const options = { plugins: [ElementPlus], stubs: { ElDialog: Dialog, SupplyPageTitle: true } }
beforeEach(() => {
  vi.resetAllMocks()
  state.write = state.employeeRead = true
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-21T04:00:00Z'))
  vi.mocked(getPayrollRules).mockResolvedValue(page([existing()]))
  vi.mocked(getCostCities).mockResolvedValue(cities)
  vi.mocked(getPayrollEmployees).mockResolvedValue([employee] as never)
  vi.mocked(hrOrganizationApi.employeeDepartments).mockResolvedValue([
    { id: 1, parentId: null, departmentName: '总公司', statusCode: 'ACTIVE' },
  ] as never)
  vi.mocked(getHrPositions).mockResolvedValue({
    items: [
      { positionCode: 'CITY', positionName: '城市总' },
      { positionCode: 'TRAINEE', positionName: '见习城市总' },
      { positionCode: 'SALES', positionName: '业务员' },
      { positionCode: 'HQ', positionName: '人事' },
      { positionCode: 'ASSISTANT', positionName: '城市总助理' },
    ],
    begin: 0,
    step: 200,
    total: 5,
  } as never)
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
  vi.useRealTimers()
})
const field = (label: string, scope: VueWrapper | DOMWrapper<Element> = wrapper) =>
  scope
    .findAll('.el-form-item')
    .find((f) => f.find('label').exists() && f.find('label').text() === label)!
async function click(label: string) {
  await wrapper
    .findAll('button')
    .find((b) => b.text() === label)!
    .trigger('click')
  await flushPromises()
}
async function editor(position: string) {
  wrapper = mount(Editor, { props: { modelValue: false, record: null }, global: options })
  await wrapper.setProps({ modelValue: true })
  await flushPromises()
  field('部门').getComponent({ name: 'ElTreeSelect' }).vm.$emit('update:modelValue', 1)
  field('岗位').getComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', position)
  await field('姓名').get('input').setValue('DEV 城市总一体化测试')
  field('薪酬类别').getComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', 'SALES')
  await flushPromises()
}
async function addScope() {
  await click('增加管辖城市')
  const row = wrapper.findAll('.scope-row').at(-1)!
  field('管辖城市', row).getComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', 'C2')
  field('管辖城市', row).getComponent({ name: 'ElSelect' }).vm.$emit('change', 'C2')
  field('任期开始', row)
    .getComponent({ name: 'ElDatePicker' })
    .vm.$emit('update:modelValue', '2099-01-01')
  await flushPromises()
}
const commands = () =>
  (wrapper.vm as unknown as { commands: () => HrEmployeeCityScopeCommand[] }).commands()

describe('同一员工弹窗完成资料及管辖城市', () => {
  it.each(['CITY', 'TRAINEE'])(
    '%s 无需先保存员工，资料和城市通过一次请求提交',
    async (position) => {
      await editor(position)
      await wrapper.get('[role="tab"][id$="city-scope"]').trigger('click')
      await flushPromises()
      expect(wrapper.text()).not.toContain('请先保存员工')
      await addScope()
      expect(wrapper.findAll('[role="dialog"]')).toHaveLength(1)
      expect(hrOrganizationApi.saveEmployee).not.toHaveBeenCalled()
      await click('确定')
      expect(hrOrganizationApi.saveEmployee).toHaveBeenCalledTimes(1)
      expect(hrOrganizationApi.saveEmployee).toHaveBeenCalledWith(
        null,
        expect.objectContaining({
          positionCode: position,
          cityScopes: [
            expect.objectContaining({
              id: null,
              cityCode: 'C2',
              cityName: '唐山市',
              effectiveFrom: '2099-01-01',
            }),
          ],
        }),
      )
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    },
  )
  it.each(['SALES', 'HQ', 'ASSISTANT', ''])(
    '%s 不显示城市页签，也不发送管辖配置',
    async (position) => {
      await editor(position)
      expect(wrapper.find('[role="tab"][id$="city-scope"]').exists()).toBe(false)
      expect(getCostCities).not.toHaveBeenCalled()
    },
  )
  it('接口冲突保留全部输入和单个弹窗，不出现保存一半的前端流程', async () => {
    vi.mocked(hrOrganizationApi.saveEmployee).mockRejectedValue(new Error('管辖任期重叠'))
    await editor('CITY')
    await wrapper.get('[role="tab"][id$="city-scope"]').trigger('click')
    await flushPromises()
    await addScope()
    await click('确定')
    expect(wrapper.text()).toContain('管辖任期重叠')
    expect(wrapper.findAll('[role="dialog"]')).toHaveLength(1)
    expect(wrapper.findAll('.scope-row')).toHaveLength(1)
    expect(wrapper.emitted('saved')).toBeUndefined()
  })
  it('已有任期只提交改动和版本；打开或增加草稿本身不写入后台', async () => {
    wrapper = mount(Fields, { props: { employeeCode: 'M1', canWrite: true }, global: options })
    await flushPromises()
    expect(commands()).toEqual([])
    field('任期结束')
      .getComponent({ name: 'ElDatePicker' })
      .vm.$emit('update:modelValue', '2026-10-31')
    await flushPromises()
    expect(commands()).toEqual([
      expect.objectContaining({ id: 'scope-1', revision: 4, effectiveTo: '2026-10-31' }),
    ])
    expect(commands()[0]).not.toHaveProperty('cityCommission')
    expect(hrOrganizationApi.saveEmployee).not.toHaveBeenCalled()
  })
  it.each(['业务员', '人事', '城市总助理', null])(
    '不为 %s 加载或显示管辖记录',
    async (positionName) => {
      wrapper = mount(Scope, {
        props: { employee: { ...employee, positionName } },
        global: options,
      })
      await flushPromises()
      expect(wrapper.find('.employee-city-scope').exists()).toBe(false)
      expect(getPayrollRules).not.toHaveBeenCalled()
    },
  )
  it('城市总管理只汇总并定位同一份员工档案', async () => {
    wrapper = mount(Management, { global: options })
    await flushPromises()
    expect(wrapper.text()).not.toContain('新增任职')
    await click('查看员工档案')
    expect(state.push).toHaveBeenCalledWith({
      path: '/supply-chain/hr/employees',
      query: { cityScopeEmployeeCode: 'M1' },
    })
  })
})
