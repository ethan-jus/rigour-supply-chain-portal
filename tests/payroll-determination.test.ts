import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { computed, defineComponent, h, inject, provide, type Ref } from 'vue'
import ElementPlus, { ElMessage } from 'element-plus'
import PayrollView from '@/views/supply-chain/hr/PayrollView.vue'
import * as api from '@/api/core/payroll'
import type { PayrollInput, PayrollRecord } from '@/api/core/payroll'

vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
}))
vi.mock('@/api/core/payroll', () => ({
  getPayroll: vi.fn(),
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
  setup(props, { slots }) {
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
async function openDetermination() {
  wrapper = mount(PayrollView, {
    global: {
      plugins: [ElementPlus],
      stubs: {
        SupplyPageTitle: true,
        PayrollPreparationPanel: true,
        PayrollSettlementDialog: true,
        ElTable: Table,
        ElTableColumn: Column,
        ElPagination: true,
        ElDialog: Dialog,
        ElDrawer: Dialog,
      },
    },
  })
  await flushPromises()
  await button('当月核定').trigger('click')
  await flushPromises()
}
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
