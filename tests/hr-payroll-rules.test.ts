import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, reactive } from 'vue'
import ElementPlus, { ElMessage } from 'element-plus'
import Rules from '@/views/supply-chain/hr/PayrollRuleView.vue'
import {
  savePayrollRule,
  getPayrollRules,
  getPayrollEmployees,
  getPayrollDepartments,
  getCommissionPolicies,
} from '@/api/core/payroll'
import { getCostCities } from '@/api/core/cost'
import { loadBusinessDictionaries } from '@/utils/business-dictionary'
const state = vi.hoisted(() => ({ route: { path: '/supply-chain/hr/allowance-rules' } }))
vi.mock('vue-router', () => ({ useRoute: () => state.route }))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
}))
vi.mock('@/api/core/cost', () => ({ getCostCities: vi.fn().mockResolvedValue([]) }))
vi.mock('@/api/core/payroll', () => ({
  getCommissionPolicies: vi.fn().mockResolvedValue([]),
  getPayrollDepartments: vi
    .fn()
    .mockResolvedValue([{ id: 1, parentId: null, name: '销售部', sortOrder: 0 }]),
  getPayrollEmployees: vi.fn().mockResolvedValue([]),
  getPayrollProducts: vi.fn().mockResolvedValue([]),
  getPayrollRules: vi.fn().mockResolvedValue({ total: 0, begin: 0, step: 20, items: [] }),
  savePayrollRule: vi.fn().mockResolvedValue({}),
}))
vi.mock('@/utils/business-dictionary', () => ({
  loadBusinessDictionaries: vi.fn().mockResolvedValue(undefined),
  businessDictionaryLabel: (_m: string, _c: string, v: string) => v,
  businessDictionaryOptions: () => [
    { value: 'FIXED_ALLOWANCE', label: '固定补贴' },
    { value: 'OTHER_ALLOWANCE', label: '其他补贴' },
  ],
}))
const Dialog = defineComponent({
  props: ['modelValue'],
  setup:
    (p, { slots }) =>
    () =>
      p.modelValue ? h('div', { role: 'dialog' }, [slots.default?.(), slots.footer?.()]) : null,
})
let wrapper: VueWrapper
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getPayrollRules).mockResolvedValue({ total: 0, begin: 0, step: 20, items: [] })
  vi.mocked(getPayrollEmployees).mockResolvedValue([])
  vi.mocked(getPayrollDepartments).mockResolvedValue([
    { id: 1, parentId: null, name: '销售部', sortOrder: 0 },
  ])
  vi.mocked(getCommissionPolicies).mockResolvedValue([])
  vi.mocked(getCostCities).mockResolvedValue([])
  vi.mocked(savePayrollRule).mockResolvedValue({} as never)
  vi.mocked(loadBusinessDictionaries).mockResolvedValue(undefined)
  state.route = reactive({ path: '/supply-chain/hr/allowance-rules' })
  vi.spyOn(ElMessage, 'success').mockReturnValue({ close: vi.fn() })
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})
async function open() {
  wrapper = mount(Rules, {
    global: { plugins: [ElementPlus], stubs: { ElDialog: Dialog, SupplyPageTitle: true } },
  })
  await flushPromises()
  await wrapper
    .findAll('button')
    .find((b) => b.text() === '新增其他薪资')!
    .trigger('click')
  await flushPromises()
}
const field = (label: string) =>
  wrapper
    .find('[role="dialog"]')
    .findAll('.el-form-item')
    .find((f) => f.find('label').exists() && f.find('label').text() === label)!
describe('销售固定补贴配置', () => {
  it('类型独立选择，交通话费电脑合计后提交，不依赖绩效规则', async () => {
    await open()
    await field('规则名称').get('input').setValue('销售固定补贴')
    field('适用部门').getComponent({ name: 'ElTreeSelect' }).vm.$emit('update:modelValue', [1])
    field('生效日期')
      .getComponent({ name: 'ElDatePicker' })
      .vm.$emit('update:modelValue', '2026-01-01')
    expect(wrapper.find('[role="dialog"]').text()).toContain('长期有效')
    field('车辆 / 交通（元）')
      .getComponent({ name: 'ElInputNumber' })
      .vm.$emit('update:modelValue', 600)
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').text()).toContain('850.00')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === '保存')!
      .trigger('click')
    await flushPromises()
    expect(savePayrollRule).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        kindCode: 'ALLOWANCE',
        effectiveTo: '9999-12-31',
        allowanceTypeCode: 'FIXED_ALLOWANCE',
        amount: 850,
        performancePolicy: null,
        fixedAllowance: { vehicleAllowance: 600, phoneAllowance: 150, computerAllowance: 100 },
      }),
    )
  })
  it('包含下级部门按真实组织关系保存，其他部门不混入', async () => {
    vi.mocked(getPayrollDepartments).mockResolvedValue([
      { id: 1, parentId: null, name: '销售总公司', sortOrder: 0 },
      { id: 2, parentId: 1, name: '城市销售部', sortOrder: 1 },
      { id: 3, parentId: null, name: '其他部门', sortOrder: 2 },
    ])
    await open()
    await field('规则名称').get('input').setValue('销售固定补贴')
    field('适用部门').getComponent({ name: 'ElTreeSelect' }).vm.$emit('update:modelValue', [1])
    field('适用部门').getComponent({ name: 'ElCheckbox' }).vm.$emit('update:modelValue', true)
    field('生效日期')
      .getComponent({ name: 'ElDatePicker' })
      .vm.$emit('update:modelValue', '2026-01-01')
    await flushPromises()
    expect(wrapper.text()).toContain('将保存 2 个部门')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === '保存')!
      .trigger('click')
    await flushPromises()
    expect(savePayrollRule).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ departmentIds: [1, 2] }),
    )
  })
  it('有效沟通以分钟显示，接口仍保存秒数', async () => {
    state.route.path = '/supply-chain/hr/performance-rules'
    wrapper = mount(Rules, {
      global: { plugins: [ElementPlus], stubs: { ElDialog: Dialog, SupplyPageTitle: true } },
    })
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === '新增绩效规则')!
      .trigger('click')
    await flushPromises()
    await field('规则名称').get('input').setValue('销售绩效')
    field('适用部门').getComponent({ name: 'ElTreeSelect' }).vm.$emit('update:modelValue', [1])
    field('生效日期')
      .getComponent({ name: 'ElDatePicker' })
      .vm.$emit('update:modelValue', '2026-01-01')
    const minutes = field('有效沟通（分钟）').getComponent({ name: 'ElInputNumber' })
    expect(minutes.props('modelValue')).toBe(10)
    minutes.vm.$emit('update:modelValue', 12)
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === '保存')!
      .trigger('click')
    await flushPromises()
    expect(savePayrollRule).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        performancePolicy: expect.objectContaining({ minimumSeconds: 720 }),
      }),
    )
  })
  it('绩效规则不再出现固定补贴字段', async () => {
    state.route.path = '/supply-chain/hr/performance-rules'
    wrapper = mount(Rules, {
      global: { plugins: [ElementPlus], stubs: { ElDialog: Dialog, SupplyPageTitle: true } },
    })
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === '新增绩效规则')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').text()).not.toContain('车辆 / 交通')
    expect(wrapper.find('[role="dialog"]').text()).not.toContain('电脑')
  })
})
