import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import ElementPlus from 'element-plus'
import Rules from '@/views/supply-chain/hr/PayrollComponentView.vue'
import { getPayrollComponents, savePayrollComponent } from '@/api/core/payroll-scheme/components'
const state = vi.hoisted(() => ({ route: { path: '/supply-chain/hr/allowance-rules' } }))
vi.mock('vue-router', () => ({ useRoute: () => state.route }))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
}))
vi.mock('@/api/core/payroll-scheme/components', () => ({
  getPayrollComponents: vi.fn().mockResolvedValue([]),
  savePayrollComponent: vi.fn().mockResolvedValue({}),
}))
vi.mock('@/api/core/payroll', () => ({
  getPayrollDepartments: vi
    .fn()
    .mockResolvedValue([{ id: 1, name: '销售部', parentId: null, sortOrder: 0 }]),
  getPayrollProductCategories: vi
    .fn()
    .mockResolvedValue([{ id: 1, name: '方便面', parentId: null }]),
  getPayrollProducts: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/api/core/hr-attendance', () => ({
  getAttendanceDepartments: vi.fn().mockResolvedValue([]),
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
  state.route.path = '/supply-chain/hr/allowance-rules'
  vi.mocked(getPayrollComponents).mockResolvedValue([])
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})
const field = (label: string) =>
  wrapper
    .find('[role="dialog"]')
    .findAll('.el-form-item')
    .find((f) => f.find('label').exists() && f.find('label').text() === label)!
async function click(label: string) {
  await wrapper
    .findAll('button')
    .find((b) => b.text() === label)!
    .trigger('click')
  await flushPromises()
}
async function open(kind: 'ALLOWANCE' | 'PERFORMANCE' | 'SALARY' | 'COMMISSION' = 'ALLOWANCE') {
  wrapper = mount(Rules, {
    props: { componentKind: kind, ...(kind === 'SALARY' ? { employeeCode: 'E1' } : {}) },
    global: { plugins: [ElementPlus], stubs: { ElDialog: Dialog, SupplyPageTitle: true } },
  })
  await flushPromises()
  await click(
    '新增' +
      {
        ALLOWANCE: '补贴规则',
        PERFORMANCE: '绩效规则',
        SALARY: '薪资标准',
        COMMISSION: '提成规则',
      }[kind],
  )
}
async function basics() {
  await field('规则名称').get('input').setValue('测试规则')
  field('适用部门').getComponent({ name: 'ElTreeSelect' }).vm.$emit('update:modelValue', [1])
  await field('变更说明').get('textarea').setValue('业务调整')
}
describe('独立薪资规则入口', () => {
  it('补贴独立保存750元，不夹带底薪或绩效金额，也不由前端编规则编码', async () => {
    await open()
    await basics()
    expect(wrapper.find('[role="dialog"]').text()).toContain('750.00')
    expect(wrapper.find('[role="dialog"]').text()).not.toContain('绩效基数')
    await click('保存')
    expect(savePayrollComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        definition: expect.objectContaining({
          kind: 'ALLOWANCE',
          salary: null,
          performance: null,
          employeeCodes: [],
          allowance: {
            items: expect.arrayContaining([
              expect.objectContaining({ amount: 500 }),
              expect.objectContaining({ amount: 150 }),
              expect.objectContaining({ amount: 100 }),
            ]),
            proration: 'NONE',
          },
        }),
      }),
    )
    expect(vi.mocked(savePayrollComponent).mock.calls[0]?.[0]).not.toHaveProperty('ruleCode')
  })
  it('绩效分钟输入转换为秒，阶段目标和等级区间均随规则保存', async () => {
    await open('PERFORMANCE')
    await basics()
    const minutes = field('有效沟通最少时长（分钟）').getComponent({ name: 'ElInputNumber' })
    expect(minutes.props('modelValue')).toBe(10)
    minutes.vm.$emit('update:modelValue', 12)
    await click('保存')
    expect(savePayrollComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        definition: expect.objectContaining({
          salary: null,
          allowance: null,
          performance: expect.objectContaining({
            sales: expect.objectContaining({
              minimumSeconds: 720,
              firstMonthExempt: true,
              targets: [
                { fromMonth: 2, toMonth: 2, target: 5000 },
                { fromMonth: 3, toMonth: null, target: 7000 },
              ],
            }),
            grades: expect.arrayContaining([
              expect.objectContaining({ code: 'BRONZE', upper: 10000 }),
              expect.objectContaining({ code: 'GOLD', lower: 15000 }),
            ]),
          }),
        }),
      }),
    )
  })
  it('员工薪资只绑定当前员工，不出现部门、补贴或等级区间编辑', async () => {
    await open('SALARY')
    expect(getPayrollComponents).toHaveBeenCalledWith('SALARY', 'E1')
    expect(wrapper.find('[role="dialog"]').text()).not.toContain('适用部门')
    expect(wrapper.find('[role="dialog"]').text()).not.toContain('补贴项目')
    expect(wrapper.find('[role="dialog"]').text()).toContain('绩效基数（元/月）')
    await field('变更说明').get('textarea').setValue('入职定薪')
    await click('保存')
    expect(savePayrollComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        definition: expect.objectContaining({
          kind: 'SALARY',
          employeeCodes: ['E1'],
          departmentIds: [],
          allowance: null,
        }),
      }),
    )
  })
  it('商品规则仅引用ERP目录，方便面模板同时创建销售与城市总标准', async () => {
    await open('COMMISSION')
    await basics()
    await click('方便面 4%／1%')
    await click('完成')
    await click('保存')
    const definition = vi.mocked(savePayrollComponent).mock.calls[0]![0].definition
    expect(definition.commission?.rules.map((r) => [r.recipientRole, r.value])).toEqual([
      ['SALES', 4],
      ['CITY_MANAGER', 1],
    ])
    expect(definition.commission?.rules.every((r) => r.categoryIds.length === 0)).toBe(true)
  })
  it('保存失败保留内容，重试沿用请求编号', async () => {
    vi.mocked(savePayrollComponent).mockRejectedValueOnce(new Error('服务暂不可用'))
    await open()
    await basics()
    await click('保存')
    expect(wrapper.text()).toContain('服务暂不可用')
    const first = vi.mocked(savePayrollComponent).mock.calls[0]![0]
    await click('保存')
    expect(vi.mocked(savePayrollComponent).mock.calls[1]![0]).toEqual(first)
  })
})
