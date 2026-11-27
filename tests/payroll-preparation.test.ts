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
  type PayrollPreview,
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
describe('选择核算人员', () => {
  beforeEach(() => vi.clearAllMocks())
  it('筛选变化会移除不可见的勾选，清空选择和更换月份不保留旧选择', async () => {
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
      await click('选择筛选结果')
      expect(wrapper.text()).toContain('已选 2 人')
      await wrapper.get('input[aria-label="准备员工姓名"]').setValue('乙')
      expect(wrapper.text()).toContain('已选 1 人')
      expect(wrapper.text()).toContain('当前筛选 1 人')
      await click('选择筛选结果')
      expect(wrapper.text()).toContain('已选 1 人')
      await wrapper.get('input[aria-label="准备员工姓名"]').setValue('')
      expect(wrapper.text()).toContain('已选 1 人')
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
        stubs: { ElDialog: Dialog },
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
  it('全选只勾可生成的员工，仅看已选时仍可取消并返回完整筛选结果', async () => {
    const eligible = {
      employeeCode: 'A',
      employeeName: '可生成',
      departmentId: 6,
      canCalculate: true,
      locked: false,
      payrollCategory: 'SALES',
      profileIssues: [],
      ruleIssues: [],
    } as unknown as PayrollPreparationEmployee
    vi.mocked(getPayrollPreparation).mockResolvedValue({
      month: '2026-09',
      employees: [
        eligible,
        { ...eligible, employeeCode: 'B', employeeName: '已确认', locked: true },
        {
          ...eligible,
          employeeCode: 'C',
          employeeName: '规则待完善',
          canCalculate: false,
          ruleIssues: ['待配置'],
        },
      ],
    })
    const wrapper = mount(PayrollPreparationPanel, {
      props: { modelValue: true, month: '2026-09' },
      global: { plugins: [ElementPlus], stubs: { ElDialog: Dialog } },
    })
    try {
      await flushPromises()
      const header = wrapper.get('[aria-label="选择当前筛选中可生成的员工"] input')
      expect(wrapper.get('[aria-label="选择 已确认（B）"] input').attributes('disabled')).toBeDefined()
      expect(wrapper.get('[aria-label="选择 规则待完善（C）"] input').attributes('disabled')).toBeDefined()
      await header.setValue(true)
      expect(wrapper.text()).toContain('试算已选 1 人')
      expect(wrapper.text()).toContain('开始计算 1 人')
      await wrapper.get('.preparation-summary input[type="checkbox"]').setValue(true)
      expect(wrapper.text()).toContain('当前筛选 1 人')
      await header.setValue(false)
      expect(wrapper.text()).toContain('已选 0 人')
      expect(wrapper.text()).toContain('当前筛选 3 人')
    } finally {
      wrapper.unmount()
    }
  })
  it('同月刷新读取最新资格，加载失败和恢复时均不提交旧勾选', async () => {
    const eligible = {
      employeeCode: 'A',
      employeeName: '可生成',
      canCalculate: true,
      locked: false,
      payrollCategory: 'SALES',
      profileIssues: [],
      ruleIssues: [],
    } as unknown as PayrollPreparationEmployee
    const preparation = { month: '2026-09', employees: [eligible] }
    const get = vi.mocked(getPayrollPreparation)
    get.mockResolvedValueOnce(preparation)
    const wrapper = mount(PayrollPreparationPanel, {
      props: { modelValue: true, month: '2026-09' },
      global: { plugins: [ElementPlus], stubs: { ElDialog: Dialog } },
    })
    const selectFiltered = () => wrapper.findAll('button').find((b) => b.text() === '选择筛选结果')!
    const generate = () => wrapper.findAll('button').find((b) => b.text().startsWith('开始计算'))!
    try {
      await flushPromises()
      await selectFiltered().trigger('click')
      get.mockResolvedValueOnce({ ...preparation, employees: [{ ...eligible, locked: true }] })
      await wrapper.vm.refresh()
      expect(generate().text()).toBe('开始计算 0 人')
      expect(generate().attributes('disabled')).toBeDefined()
      get.mockResolvedValueOnce(preparation)
      await wrapper.vm.refresh()
      await selectFiltered().trigger('click')
      expect(generate().text()).toBe('开始计算 1 人')
      get.mockRejectedValueOnce(new Error('请求失败'))
      await wrapper.vm.refresh()
      expect(generate().attributes('disabled')).toBeDefined()
      expect(wrapper.text()).toContain('试算已选 0 人')
      get.mockResolvedValueOnce(preparation)
      await wrapper.vm.refresh()
      expect(generate().text()).toBe('开始计算 0 人')
      expect(calculatePayroll).not.toHaveBeenCalled()
      expect(previewPayroll).not.toHaveBeenCalled()
    } finally {
      wrapper.unmount()
    }
  })
  it('离职结算与本月人员分开，仅在本月只读试算核实资格后允许生成', async () => {
    const regular = {
      employeeCode: 'A',
      employeeName: '本月员工',
      canCalculate: true,
      locked: false,
      payrollCategory: 'SALES',
      profileIssues: [],
      ruleIssues: [],
    } as unknown as PayrollPreparationEmployee
    const former = {
      ...regular,
      employeeCode: 'B',
      employeeName: '离职员工',
      leaveDate: '2026-08-31',
      canCalculate: false,
    }
    vi.mocked(getPayrollPreparation).mockResolvedValue({
      month: '2026-09',
      employees: [regular],
      formerEmployees: [former],
    })
    const preview = {
      employeeCode: 'B',
      employeeName: '离职员工',
      issues: [],
      calculation: { netPay: 100 },
    } as unknown as PayrollPreview
    vi.mocked(previewPayroll)
      .mockResolvedValueOnce([{ ...preview, canGenerateFormerSettlement: false }])
      .mockResolvedValue([{ ...preview, canGenerateFormerSettlement: true }])
    vi.mocked(calculatePayroll).mockResolvedValue([
      { statusCode: 'READY', calculation: { issues: [] } },
    ] as unknown as PayrollRecord[])
    const wrapper = mount(PayrollPreparationPanel, {
      props: { modelValue: true, month: '2026-09' },
      global: { plugins: [ElementPlus], stubs: { ElDialog: Dialog } },
    })
    const click = async (label: string) => {
      await wrapper.findAll('button').find((button) => button.text() === label)!.trigger('click')
      await flushPromises()
    }
    try {
      await flushPromises()
      expect(wrapper.text()).toContain('本月人员 1 人')
      expect(wrapper.text()).not.toContain('离职员工')
      await click('选择筛选结果')
      const formerMode = wrapper.findAll('label').find((label) => label.text() === '离职结算')!
      await formerMode.get('input').setValue(true)
      expect(wrapper.text()).toContain('离职结算候选 1 人')
      expect(wrapper.text()).not.toContain('本月员工')
      expect(wrapper.text()).toContain('开始计算 0 人')
      await click('只读试算')
      expect(wrapper.text()).toContain('可生成 0 人')
      await click('只读试算')
      expect(wrapper.text()).toContain('可生成 1 人')
      expect(calculatePayroll).not.toHaveBeenCalled()
      await click('选择筛选结果')
      await wrapper.vm.refresh()
      expect(wrapper.text()).toContain('开始计算 0 人')
      await click('只读试算')
      await click('选择筛选结果')
      await click('开始计算 1 人')
      expect(calculatePayroll).toHaveBeenCalledExactlyOnceWith('2026-09', ['B'])
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
