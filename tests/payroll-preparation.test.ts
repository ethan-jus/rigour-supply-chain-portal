import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import ElementPlus from 'element-plus'
import PayrollPreparationPanel from '@/views/supply-chain/hr/components/PayrollPreparationPanel.vue'
import {
  getPayrollPreparation,
  calculatePayroll,
  previewPayroll,
  type PayrollPreparationEmployee,
  type PayrollRecord,
} from '@/api/core/payroll'

vi.mock('@/api/core/payroll', () => ({
  getPayrollPreparation: vi.fn(),
  calculatePayroll: vi.fn(),
  previewPayroll: vi.fn(),
}))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
}))
vi.mock('@/utils/business-dictionary', () => ({
  businessDictionaryLabel: (_m: string, _c: string, v: string) => v,
}))
const Dialog = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h('div', [slots.default?.(), slots.footer?.()]),
})
const Table = defineComponent({
  props: ['data'],
  emits: ['selection-change'],
  setup(props, { emit, expose }) {
    let selected: PayrollPreparationEmployee[] = []
    expose({
      clearSelection: () => {
        selected = []
        emit('selection-change', selected)
      },
      toggleRowSelection: (row: PayrollPreparationEmployee) => {
        selected = [...selected, row]
        emit('selection-change', selected)
      },
    })
    return () =>
      h(
        'div',
        props.data.map((row: PayrollPreparationEmployee) => h('span', row.employeeCode)),
      )
  },
})
describe('选择核算人员', () => {
  beforeEach(() => vi.clearAllMocks())
  it('更换姓名筛选保留已选人员，清空选择和更换月份不会残留旧选择', async () => {
    const employees = ['甲', '乙'].map((name, index) => ({
      employeeCode: String(index),
      employeeName: name,
      departmentId: 6,
      departmentName: '测试部门',
      canCalculate: true,
      locked: false,
      payrollCategory: 'SALES',
      profileIssues: [],
      ruleIssues: [],
    })) as unknown as PayrollPreparationEmployee[]
    vi.mocked(getPayrollPreparation).mockResolvedValue({ month: '2026-09', employees } as Awaited<
      ReturnType<typeof getPayrollPreparation>
    >)
    const wrapper = mount(PayrollPreparationPanel, {
      props: { modelValue: true, month: '2026-09' },
      global: { plugins: [ElementPlus], stubs: { ElDialog: Dialog } },
    })
    const click = async (label: string) => {
      await wrapper
        .findAll('button')
        .find((button) => button.text() === label)!
        .trigger('click')
      await flushPromises()
    }
    try {
      await flushPromises()
      for (const name of ['甲', '乙']) {
        await wrapper.get('input[aria-label="准备员工姓名"]').setValue(name)
        await click('选择筛选结果')
      }
      expect(wrapper.text()).toContain('已选 2 人')
      await click('选择筛选结果')
      expect(wrapper.text()).toContain('已选 2 人')
      await click('清空选择')
      expect(wrapper.text()).toContain('已选 0 人')
      await click('选择筛选结果')
      await wrapper.setProps({ month: '2026-10' })
      await flushPromises()
      expect(wrapper.text()).toContain('已选 0 人')
    } finally {
      wrapper.unmount()
    }
  })
  it('选择筛选结果仅计算筛选出的未锁定员工，不扩大为全部员工', async () => {
    const employees = [
      { employeeCode: 'A', employeeName: '测试销售', locked: false },
      { employeeCode: 'B', employeeName: '其他销售', locked: false },
      { employeeCode: 'C', employeeName: '测试已确认', locked: true },
    ].map((person) => ({
      ...person,
      departmentId: 6,
      canCalculate: true,
      payrollCategory: 'SALES',
      profileIssues: [],
      ruleIssues: [],
    })) as unknown as PayrollPreparationEmployee[]
    vi.mocked(getPayrollPreparation).mockResolvedValue({ month: '2026-09', employees } as Awaited<
      ReturnType<typeof getPayrollPreparation>
    >)
    vi.mocked(calculatePayroll).mockResolvedValue([
      { statusCode: 'READY', calculation: { issues: [] } },
    ] as unknown as PayrollRecord[])
    const wrapper = mount(PayrollPreparationPanel, {
      props: { modelValue: true, month: '2026-09' },
      global: {
        plugins: [ElementPlus],
        stubs: { ElDialog: Dialog, ElTable: Table, ElTableColumn: true },
      },
    })
    try {
      await flushPromises()
      await wrapper.get('input[aria-label="准备员工姓名"]').setValue('测试')
      await wrapper
        .findAll('button')
        .find((b) => b.text() === '选择筛选结果')!
        .trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain('已选 1 人')
      await wrapper
        .findAll('button')
        .find((b) => b.text() === '开始计算 1 人')!
        .trigger('click')
      await flushPromises()
      expect(calculatePayroll).toHaveBeenCalledExactlyOnceWith('2026-09', ['A'])
      expect(wrapper.text()).toContain('已处理 1／1 人')
    } finally {
      wrapper.unmount()
    }
  })
  it('已发放人员可只读试算对比，缺少资料不会被展示为零元，也不保存工资', async () => {
    const employee = {
      employeeCode: 'L',
      employeeName: '已发放员工',
      locked: true,
      canCalculate: false,
      payrollCategory: 'HEADQUARTERS',
      profileIssues: [],
      ruleIssues: ['员工薪资标准未配置'],
    }
    vi.mocked(getPayrollPreparation).mockResolvedValue({
      month: '2026-09',
      employees: [employee],
    } as never)
    vi.mocked(previewPayroll).mockResolvedValue([
      {
        employeeCode: 'L',
        employeeName: '已发放员工',
        savedStatus: 'PAID',
        issues: ['员工薪资标准未配置'],
        calculation: { netPay: null, issues: ['员工薪资标准未配置'] },
        previousCalculation: { netPay: 8000 },
      },
    ] as never)
    const wrapper = mount(PayrollPreparationPanel, {
      props: { modelValue: true, month: '2026-09' },
      global: { plugins: [ElementPlus], stubs: { ElDialog: Dialog } },
    })
    try {
      await flushPromises()
      expect(wrapper.text()).toContain('规则待完善 1 人')
      await wrapper
        .findAll('button')
        .find((b) => b.text() === '只读试算')!
        .trigger('click')
      await flushPromises()
      expect(previewPayroll).toHaveBeenCalledExactlyOnceWith('2026-09', ['L'])
      expect(calculatePayroll).not.toHaveBeenCalled()
      expect(wrapper.text()).toContain('应付 - 元')
      await wrapper.setProps({ month: '2026-10' })
      await flushPromises()
      expect(wrapper.text()).not.toContain('应付 - 元')
    } finally {
      wrapper.unmount()
    }
  })
})
