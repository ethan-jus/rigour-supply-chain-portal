import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { computed, defineComponent, h, inject, provide, type Ref } from 'vue'
import ElementPlus, { ElMessage } from 'element-plus'
import PayrollView from '@/views/supply-chain/hr/PayrollView.vue'
import * as api from '@/api/core/payroll'
import type { PayrollInput, PayrollRecord } from '@/api/core/payroll'
import { loadBusinessDictionaries } from '@/utils/business-dictionary'

vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
}))
vi.mock('@/api/core/payroll', () => ({
  getPayroll: vi.fn(),
  getPayrollSummary: vi.fn(),
  getPayrollDepartments: vi.fn(),
  getPayrollHistory: vi.fn(),
  getPayrollDetail: vi.fn(),
  getPayrollInput: vi.fn(),
  savePayrollInput: vi.fn(),
  calculatePayroll: vi.fn(),
  exportPayroll: vi.fn(),
  cancelPayrollCorrection: vi.fn(),
}))
vi.mock('@/utils/business-dictionary', () => ({
  loadBusinessDictionaries: vi.fn().mockResolvedValue(undefined),
  businessDictionaryLabel: (_module: string, _code: string, value: string) => value,
  businessDictionaryOptions: () => [],
}))
let wrapper: VueWrapper
let row: PayrollRecord
let currentInput: PayrollInput
const button = (name: string) => wrapper.findAll('button').find((b) => b.text() === name)!
// 布局控件在无浏览器尺寸的测试环境中简化；表单、页面操作和状态反馈使用真实组件。
const Table = defineComponent({
  props: ['data'],
  setup(props, { slots, expose }) {
    expose({ clearSelection: () => {} })
    provide(
      'payroll-test-rows',
      computed(() => props.data || []),
    )
    return () => h('div', slots.default?.())
  },
})
const Column = defineComponent({
  setup(_props, { slots }) {
    const rows = inject<Ref<PayrollRecord[]>>('payroll-test-rows')!
    return () =>
      h(
        'div',
        rows.value.map((row) => slots.default?.({ row })),
      )
  },
})
const Dialog = defineComponent({
  props: ['modelValue'],
  setup:
    (props, { slots }) =>
    () =>
      props.modelValue ? h('div', { role: 'dialog' }, [slots.default?.(), slots.footer?.()]) : null,
})
beforeEach(() => {
  vi.clearAllMocks()
  currentInput = {
    revision: 0,
    baseOverride: null,
    performanceOverride: null,
    allowanceOverride: null,
    departmentOverrideId: null,
    deduction: 0,
    reason: '',
  }
  row = {
    id: 'test-payroll',
    month: '2026-09',
    employeeCode: 'TEST-SALES',
    employeeName: '测试销售',
    departmentId: 20,
    departmentName: '测试城市',
    cityName: '测试城市',
    statusCode: 'REVIEW',
    revision: 1,
    updatedTime: '',
    calculation: {
      baseSalary: 4000,
      performance: null,
      commission: 20,
      heldCommission: 0,
      allowance: 750,
      deduction: 0,
      grossPay: null,
      netPay: null,
      issues: ['当月任职部门资料缺失', '绩效规则缺失'],
      details: [],
      rules: [],
      input: { ...currentInput },
      performanceDetail: null,
      sourceFingerprint: 'initial',
    },
  }
  vi.mocked(api.getPayroll).mockImplementation(async () => ({
    total: 1,
    begin: 0,
    step: 20,
    items: [row],
  }))
  vi.mocked(api.getPayrollSummary).mockResolvedValue({
    total: 1,
    completeCount: 0,
    pendingCount: 1,
    grossPay: 0,
    netPay: 0,
    statusCounts: { REVIEW: 1 },
  })
  vi.mocked(api.getPayrollDepartments).mockResolvedValue([
    { id: 1, parentId: null, name: '测试总部', sortOrder: 1 },
    { id: 20, parentId: 1, name: '测试城市', sortOrder: 1 },
  ])
  vi.mocked(api.getPayrollHistory).mockResolvedValue([])
  vi.mocked(api.getPayrollDetail).mockImplementation(async () => row)
  vi.mocked(api.getPayrollInput).mockImplementation(async () => ({ ...currentInput }))
  vi.mocked(api.savePayrollInput).mockImplementation(async (_month, _code, value) => {
    currentInput = { ...value }
    return currentInput
  })
  vi.mocked(api.calculatePayroll).mockImplementation(async () => {
    row = {
      ...row,
      statusCode: 'READY',
      revision: 2,
      calculation: {
        ...row.calculation,
        input: currentInput,
        performance: currentInput.performanceOverride,
        grossPay: 4770,
        netPay: 4770,
        issues: [],
        sourceFingerprint: 'determined',
      },
    }
    return [row]
  })
})
afterEach(() => {
  wrapper?.unmount()
  ElMessage.closeAll()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})
async function openList() {
  wrapper = mount(PayrollView, {
    global: {
      plugins: [ElementPlus],
      stubs: {
        SupplyPageTitle: true,
        PayrollPreparationPanel: true,
        PayrollSettlementDialog: true,
        PayrollBatchDialog: true,
        ElDropdown: defineComponent({
          setup:
            (_, { slots }) =>
            () =>
              h('div', [slots.default?.(), slots.dropdown?.()]),
        }),
        ElDropdownMenu: defineComponent({
          setup:
            (_, { slots }) =>
            () =>
              h('div', slots.default?.()),
        }),
        ElDropdownItem: defineComponent({
          setup:
            (_, { slots, attrs }) =>
            () =>
              h('button', attrs, slots.default?.()),
        }),
        ElTable: Table,
        ElTableColumn: Column,
        ElPagination: true,
        ElDialog: Dialog,
        ElDrawer: Dialog,
      },
    },
  })
  await flushPromises()
}
async function openDetermination() {
  await openList()
  await button('人工调整').trigger('click')
  await flushPromises()
}
describe('工资列表汇总', () => {
  it('使用全部筛选结果汇总，不把当前页金额或待核定工资算进合计', async () => {
    vi.mocked(api.getPayrollSummary).mockResolvedValue({
      total: 44,
      completeCount: 41,
      pendingCount: 3,
      grossPay: 123456.78,
      netPay: 120000.12,
      statusCounts: { REVIEW: 3, READY: 40, CONFIRMED: 1 },
    })
    await openList()
    const summary = wrapper.get('.payroll-summary').text().replace(/\s+/g, ' ')
    expect(summary).toContain('44')
    expect(summary).toContain('完整核算 41 人 / 待核定 3 人')
    expect(summary).toContain('123,456.78')
    expect(summary).toContain('120,000.12')
    expect(wrapper.text()).toContain('待处理（3）')
    expect(wrapper.text()).toContain('待确认（40）')
    expect(wrapper.text()).toContain('待发放（1）')
    expect(
      wrapper.find('button[aria-label="查看汇总口径：合计仅含当前筛选下的完整结果"]').exists(),
    ).toBe(true)
    expect(api.getPayrollSummary).toHaveBeenCalledWith(
      expect.objectContaining({ month: expect.any(String) }),
    )
  })
  it('没有完整工资时合计显示空缺，并仅加载薪酬相关字典', async () => {
    await openList()
    const summary = wrapper.get('.payroll-summary').text().replace(/\s+/g, ' ')
    expect(summary).toContain('完整核算 0 人 / 待核定 1 人')
    expect(summary.match(/—/g)).toHaveLength(2)
    expect(summary).not.toContain('0.00')
    expect(JSON.stringify(vi.mocked(loadBusinessDictionaries).mock.calls)).not.toContain(
      'COST_PREMISES_TYPE',
    )
    expect(loadBusinessDictionaries).toHaveBeenCalled()
  })
})
describe('当月核定完整交互', () => {
  it('要求一次说明，提交部门和零绩效后自动重算，并展示确认入口与核定依据', async () => {
    await openDetermination()
    await button('保存并重新核算').trigger('click')
    expect(wrapper.text()).toContain('请填写核定说明')
    expect(api.savePayrollInput).not.toHaveBeenCalled()
    const tree = wrapper
      .findAllComponents({ name: 'ElTreeSelect' })
      .find((c) => c.find('[aria-label="核定部门"]').exists())!
    tree.vm.$emit('update:modelValue', 20)
    expect(tree.props('data')[0].children[0].id).toBe(20)
    await wrapper.get('input[aria-label="核定绩效"]').setValue('0')
    await wrapper
      .get('textarea[aria-label="核定说明"]')
      .setValue('测试核定，本月所属测试城市，绩效核定为零')
    await button('保存并重新核算').trigger('click')
    await flushPromises()
    expect(api.savePayrollInput).toHaveBeenCalledWith(
      '2026-09',
      'TEST-SALES',
      expect.objectContaining({ departmentOverrideId: 20, performanceOverride: 0, revision: 0 }),
    )
    expect(api.calculatePayroll).toHaveBeenCalledWith('2026-09', ['TEST-SALES'])
    expect(wrapper.text()).toContain('本月已采用人工核定')
    expect(wrapper.text()).toContain('核算检查已通过')
    expect(button('确认薪酬')).toBeDefined()
  })
  it('保存成功但来源服务失败时保留核定，提示重算失败且不显示确认入口', async () => {
    const warning = vi.spyOn(ElMessage, 'warning')
    vi.mocked(api.calculatePayroll).mockRejectedValue(new Error('来源服务不可用'))
    await openDetermination()
    await wrapper.get('textarea[aria-label="核定说明"]').setValue('测试核定说明')
    await button('保存并重新核算').trigger('click')
    await flushPromises()
    expect(api.savePayrollInput).toHaveBeenCalledTimes(1)
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('核定已保存，但重新核算失败'))
    expect(button('确认薪酬')).toBeUndefined()
  })
  it('核定版本冲突时保留填写内容，不触发重算', async () => {
    vi.mocked(api.savePayrollInput).mockRejectedValue(new Error('该月核定已被更新，请刷新后重试'))
    await openDetermination()
    await wrapper.get('textarea[aria-label="核定说明"]').setValue('暂存的核定说明')
    await button('保存并重新核算').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('该月核定已被更新')
    expect(
      (wrapper.get('textarea[aria-label="核定说明"]').element as HTMLTextAreaElement).value,
    ).toBe('暂存的核定说明')
    expect(api.calculatePayroll).not.toHaveBeenCalled()
  })
})

it('恢复规则计算清除金额和部门覆盖，保留独立扣款及版本', async () => {
  currentInput = {
    ...currentInput,
    revision: 3,
    baseOverride: 4000,
    performanceOverride: 100,
    allowanceOverride: 0,
    departmentOverrideId: 20,
    deduction: 50,
    reason: '旧核定',
  }
  await openList()
  await button('人工调整').trigger('click')
  await flushPromises()
  await button('清除核定覆盖，恢复规则计算').trigger('click')
  await button('保存并重新核算').trigger('click')
  await flushPromises()
  expect(api.savePayrollInput).toHaveBeenCalledWith(
    '2026-09',
    'TEST-SALES',
    expect.objectContaining({
      revision: 3,
      baseOverride: null,
      performanceOverride: null,
      allowanceOverride: null,
      departmentOverrideId: null,
      deduction: 50,
      reason: '恢复员工薪资档案与规则计算',
    }),
  )
})
