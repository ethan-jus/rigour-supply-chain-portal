import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { computed, defineComponent, h, inject, provide, type Ref } from 'vue'
import ElementPlus, { ElMessage, ElMessageBox } from 'element-plus'
import PayrollView from '@/views/supply-chain/hr/PayrollView.vue'
import * as api from '@/api/core/payroll'
import type { PayrollInput, PayrollRecord } from '@/api/core/payroll'
import { loadBusinessDictionaries } from '@/utils/business-dictionary'
import { getPayrollSchemeFacts } from '@/api/core/payroll-scheme'
import { newPayrollScheme } from '@/utils/payroll-scheme'
import { getPayrollRuleReviews } from '@/api/core/payroll-scheme/components'
import type { PayrollSchemeFactsView } from '@/api/core/payroll-scheme/models/PayrollSchemeFactsView'

const routeGuards = vi.hoisted(() => ({
  leave: [] as Array<() => Promise<boolean>>,
  update: [] as Array<() => Promise<boolean>>,
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  onBeforeRouteLeave: (guard: () => Promise<boolean>) => routeGuards.leave.push(guard),
  onBeforeRouteUpdate: (guard: () => Promise<boolean>) => routeGuards.update.push(guard),
}))
// Element Plus 的声明把实际确认动作与 prompt 输入结果定义为交集。
const confirmed = 'confirm' as Awaited<ReturnType<typeof ElMessageBox.confirm>>

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
  savePayrollDetermination: vi.fn(),
  calculatePayroll: vi.fn(),
  exportPayroll: vi.fn(),
  cancelPayrollCorrection: vi.fn(),
}))
vi.mock('@/api/core/payroll-scheme', () => ({
  getPayrollSchemeFacts: vi
    .fn()
    .mockResolvedValue({ revision: 0, performanceBase: null, metrics: [], reason: '' }),
}))
vi.mock('@/api/core/payroll-scheme/components', () => ({
  getPayrollRuleReviews: vi.fn().mockResolvedValue([]),
  resolvePayrollRuleReview: vi.fn(),
}))
vi.mock('@/utils/business-dictionary', () => ({
  loadBusinessDictionaries: vi.fn().mockResolvedValue(undefined),
  businessDictionaryLabel: (_module: string, _code: string, value: string) => value,
  businessDictionaryItemName: () => undefined,
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
  routeGuards.leave = []
  routeGuards.update = []
  vi.spyOn(ElMessageBox, 'confirm').mockRejectedValue('cancel')
  vi.mocked(getPayrollSchemeFacts).mockResolvedValue({
    revision: 0,
    performanceBase: null,
    metrics: [],
    reason: '',
  })
  vi.mocked(getPayrollRuleReviews).mockResolvedValue([])
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
  vi.mocked(api.savePayrollDetermination).mockImplementation(async (_month, _code, value) => {
    currentInput = { ...value.input }
    return { input: currentInput, facts: value.facts && { ...value.facts, revision: 1 } }
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
  await button('核定薪酬').trigger('click')
  await flushPromises()
}
describe('工资列表汇总', () => {
  it('薪酬操作记录不直接显示内部操作人标识和ISO时间', async () => {
    vi.mocked(api.getPayrollHistory).mockResolvedValue([
      {
        action: 'CONFIRM',
        actorId: 'SYSTEM',
        reason: '测试',
        occurredTime: '2026-10-19T06:02:28.392666Z',
      },
    ])
    await openList()
    await button('明细').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('操作人：系统同步')
    expect(wrapper.get('.el-timeline-item__timestamp').text()).toBe('2026-10-19 14:02:28')
    expect(wrapper.text()).not.toContain('392666Z')
  })
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
    expect(wrapper.get('.summary-complete .summary-value').text().replace(/\s/g, '')).toBe('41人')
    expect(wrapper.get('.summary-pending-card .summary-value').text().replace(/\s/g, '')).toBe(
      '3人',
    )
    expect(summary).toContain('123,456.78')
    expect(summary).toContain('120,000.12')
    expect(wrapper.find('[role="tab"][aria-label="待处理（3）"]').exists()).toBe(true)
    expect(wrapper.find('[role="tab"][aria-label="待确认（40）"]').exists()).toBe(true)
    expect(wrapper.find('[role="tab"][aria-label="待发放（1）"]').exists()).toBe(true)
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
    expect(wrapper.get('.summary-complete .summary-value').text().replace(/\s/g, '')).toBe('0人')
    expect(wrapper.get('.summary-pending-card .summary-value').text().replace(/\s/g, '')).toBe(
      '1人',
    )
    expect(summary.match(/-/g)).toHaveLength(2)
    expect(summary).not.toContain('0.00')
    expect(JSON.stringify(vi.mocked(loadBusinessDictionaries).mock.calls)).not.toContain(
      'COST_PREMISES_TYPE',
    )
    expect(loadBusinessDictionaries).toHaveBeenCalled()
  })
  it('主列表直接展示核算金额和状态，取消补充列开关，追溯字段放在只读详情', async () => {
    row.paymentBlockReason = '当月考勤尚未确认'
    await openList()
    expect(wrapper.find('.payroll-list-header .el-switch').exists()).toBe(false)
    expect(wrapper.findAll('.summary-card')).toHaveLength(5)
    const table = wrapper.get('.table-viewport')
    expect(table.find('[label="应付工资"]').exists()).toBe(true)
    expect(table.find('[label="状态"]').exists()).toBe(true)
    expect(table.find('[label="员工编号"]').exists()).toBe(false)
    await button('明细').trigger('click')
    await flushPromises()
    const checks = wrapper.findAll('.business-detail-fields > div')
    expect(
      checks
        .find((field) => field.find('dt').text() === '确认发放限制')
        ?.find('dd')
        .text(),
    ).toBe('当月考勤尚未确认')
    expect(checks.some((field) => field.find('dt').text() === '实际发放（元）')).toBe(true)
  })
  it('姓名和编号是独立条件，列表、总计、导出保持一致，重置清空两个字段', async () => {
    vi.mocked(api.exportPayroll).mockResolvedValue([])
    await openList()
    await wrapper.get('input[aria-label="员工姓名"]').setValue(' 测试 ')
    await wrapper.get('input[aria-label="员工编号"]').setValue(' EMP-1 ')
    await button('查询').trigger('click')
    await flushPromises()
    for (const request of [api.getPayroll, api.getPayrollSummary]) {
      expect(request).toHaveBeenLastCalledWith(
        expect.objectContaining({ employeeName: '测试', employeeCode: 'EMP-1' }),
      )
      expect(vi.mocked(request).mock.calls.at(-1)?.[0]).not.toHaveProperty('keyword')
    }
    await button('导出').trigger('click')
    await flushPromises()
    expect(api.exportPayroll).toHaveBeenLastCalledWith(
      expect.objectContaining({ employeeName: '测试', employeeCode: 'EMP-1' }),
    )
    await button('重置').trigger('click')
    await flushPromises()
    expect(api.getPayroll).toHaveBeenLastCalledWith(
      expect.objectContaining({ employeeName: undefined, employeeCode: undefined }),
    )
  })
  it('状态标签保留键盘切换、选中态及相同的状态查询条件', async () => {
    await openList()
    await wrapper.get('.payroll-stage-tab').trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    expect(api.getPayroll).toHaveBeenLastCalledWith(
      expect.objectContaining({ statusCode: 'REVIEW' }),
    )
    expect(wrapper.get('[aria-label="待处理（1）"]').attributes('aria-selected')).toBe('true')
    await wrapper.get('[aria-label="待处理（1）"]').trigger('keydown', { key: 'Home' })
    await flushPromises()
    expect(api.getPayroll).toHaveBeenLastCalledWith(
      expect.objectContaining({ statusCode: undefined }),
    )
  })
  it.each([null, '当月考勤尚未确认'] as const)(
    '列表直接展示确认工资，限制由点击后的弹窗解释 %s',
    async (reason) => {
      row.statusCode = 'READY'
      row.month = '2026-08'
      row.paymentBlockReason = reason
      await openList()
      expect(
        wrapper
          .get('.row-actions')
          .findAll('button')
          .some((entry) => entry.text() === '确认工资'),
      ).toBe(true)
      expect(button('确认工资').attributes('disabled')).toBeUndefined()
    },
  )
})
describe('当月核定完整交互', () => {
  it('要求一次说明，提交部门和零绩效后自动重算，并展示确认入口与核定依据', async () => {
    await openDetermination()
    await button('保存并重新核算').trigger('click')
    expect(wrapper.text()).toContain('请填写核定说明')
    expect(api.savePayrollDetermination).not.toHaveBeenCalled()
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('任职部门调整'))
      ?.trigger('click')
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
    expect(api.savePayrollDetermination).toHaveBeenCalledWith(
      '2026-09',
      'TEST-SALES',
      expect.objectContaining({
        input: expect.objectContaining({
          departmentOverrideId: 20,
          performanceOverride: 0,
          revision: 0,
        }),
      }),
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
    expect(api.savePayrollDetermination).toHaveBeenCalledTimes(1)
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('核定已保存，但重新核算失败'))
    expect(button('确认薪酬')).toBeUndefined()
  })
  it('核定版本冲突时保留填写内容，不触发重算', async () => {
    vi.mocked(api.savePayrollDetermination).mockRejectedValue(
      new Error('该月核定已被更新，请刷新后重试'),
    )
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
  await button('核定薪酬').trigger('click')
  await flushPromises()
  await button('清除核定覆盖，恢复规则计算').trigger('click')
  await button('保存并重新核算').trigger('click')
  await flushPromises()
  expect(api.savePayrollDetermination).toHaveBeenCalledWith(
    '2026-09',
    'TEST-SALES',
    expect.objectContaining({
      input: expect.objectContaining({
        revision: 3,
        baseOverride: null,
        performanceOverride: null,
        allowanceOverride: null,
        departmentOverrideId: null,
        deduction: 50,
        reason: '恢复员工薪资档案与规则计算',
      }),
    }),
  )
})

function headquartersSnapshot() {
  const definition = newPayrollScheme()
  definition.role = 'HEADQUARTERS'
  definition.performanceMode = 'FIXED'
  row.calculation.scheme = {
    scheme: {
      id: 'S',
      schemeId: 'S',
      version: 1,
      revision: 1,
      status: 'PUBLISHED',
      definition,
      reason: '',
      createdBy: '',
      publishedBy: '',
      updatedTime: '',
      publishedTime: '',
    },
    salaryTier: '',
    achievement: null,
    performanceBase: 4000,
    metrics: [],
    managerCoefficient: null,
    protectedDays: 0,
    assessedDays: 30,
    explanations: [],
  }
}
it('同一核定面板提交个人月度完成率、提成与所有金额，只填写一份原因', async () => {
  headquartersSnapshot()
  await openDetermination()
  expect(wrapper.get('input[aria-label="核定底薪"]').attributes('aria-disabled')).toBe('false')
  expect(wrapper.get('input[aria-label="核定绩效"]').attributes('aria-disabled')).toBe('false')
  expect(wrapper.text()).toContain('仅核定 测试销售 在 2026-09 的工资')
  await wrapper.get('textarea[aria-label="核定说明"]').setValue('本人的九月核定依据')
  await button('保存并重新核算').trigger('click')
  expect(wrapper.text()).toContain('请填写该员工本月绩效完成率')
  expect(api.savePayrollDetermination).not.toHaveBeenCalled()
  await wrapper.get('input[aria-label="本月绩效完成率"]').setValue('85.5')
  await wrapper.get('input[aria-label="提成调整金额"]').setValue('100')
  await wrapper.get('input[aria-label="核定底薪"]').setValue('4000')
  await wrapper.get('input[aria-label="核定绩效"]').setValue('3200')
  await wrapper.get('input[aria-label="核定补贴"]').setValue('750')
  await wrapper.get('input[aria-label="核定扣款"]').setValue('50')
  await button('保存并重新核算').trigger('click')
  await flushPromises()
  expect(api.savePayrollDetermination).toHaveBeenCalledWith(
    '2026-09',
    'TEST-SALES',
    expect.objectContaining({
      input: expect.objectContaining({
        baseOverride: 4000,
        performanceOverride: 3200,
        allowanceOverride: 750,
        deduction: 50,
        reason: '本人的九月核定依据',
      }),
      facts: expect.objectContaining({
        performanceCompletionPercent: 85.5,
        commissionAdjustment: 100,
        reason: '本人的九月核定依据',
      }),
    }),
  )
  expect(api.calculatePayroll).toHaveBeenCalledWith('2026-09', ['TEST-SALES'])
})
it('切换同部门员工时读取各自的完成率，不复用上一人的核定值', async () => {
  headquartersSnapshot()
  vi.mocked(getPayrollSchemeFacts).mockImplementation(async (_month, employee) => ({
    revision: 1,
    performanceBase: null,
    metrics: [],
    reason: '',
    performanceCompletionPercent: employee === 'TEST-SALES' ? 80 : 110,
  }))
  await openDetermination()
  expect(
    (wrapper.get('input[aria-label="本月绩效完成率"]').element as HTMLInputElement).value,
  ).toBe('80.0000')
  wrapper.unmount()
  row = { ...row, employeeCode: 'TEST-B', employeeName: '同部门员工B' }
  await openDetermination()
  expect(
    (wrapper.get('input[aria-label="本月绩效完成率"]').element as HTMLInputElement).value,
  ).toBe('110.0000')
  expect(getPayrollSchemeFacts).toHaveBeenLastCalledWith('2026-09', 'TEST-B')
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

describe('薪酬核定的人员隔离与未保存保护', () => {
  it('同一页面关闭A再打开B，A迟到的金额及完成率不能覆盖B或提交到B', async () => {
    headquartersSnapshot()
    const second = {
      ...row,
      id: 'payroll-B',
      month: '2026-08',
      employeeCode: 'TEST-B',
      employeeName: '同部门员工B',
    }
    vi.mocked(api.getPayroll).mockResolvedValue({
      total: 2,
      begin: 0,
      step: 20,
      items: [row, second],
    })
    const firstInput = deferred<PayrollInput>()
    const firstFacts = deferred<PayrollSchemeFactsView>()
    vi.mocked(api.getPayrollInput).mockImplementation(async (_month, code) =>
      code === 'TEST-SALES'
        ? firstInput.promise
        : { ...currentInput, revision: 2, performanceOverride: 2200, reason: 'B原核定' },
    )
    vi.mocked(getPayrollSchemeFacts).mockImplementation(async (_month, code) =>
      code === 'TEST-SALES'
        ? firstFacts.promise
        : {
            revision: 2,
            performanceBase: null,
            performanceCompletionPercent: 110,
            metrics: [],
            reason: 'B原核定',
          },
    )
    vi.mocked(api.calculatePayroll).mockResolvedValue([{ ...second, statusCode: 'READY' }])
    await openList()
    await wrapper
      .findAll('button')
      .filter((b) => b.text() === '核定薪酬')[0]!
      .trigger('click')
    await flushPromises()
    await button('取消').trigger('click')
    await flushPromises()
    await wrapper
      .findAll('button')
      .filter((b) => b.text() === '核定薪酬')[1]!
      .trigger('click')
    await flushPromises()
    expect(wrapper.get('input[aria-label="核定绩效"]').element).toHaveProperty('value', '2200.00')
    firstInput.resolve({ ...currentInput, performanceOverride: 800, reason: 'A迟到的核定' })
    firstFacts.resolve({
      revision: 0,
      performanceBase: null,
      performanceCompletionPercent: 80,
      metrics: [],
      reason: 'A迟到的核定',
    })
    await flushPromises()
    expect(wrapper.get('input[aria-label="核定绩效"]').element).toHaveProperty('value', '2200.00')
    expect(wrapper.get('input[aria-label="本月绩效完成率"]').element).toHaveProperty(
      'value',
      '110.0000',
    )
    await wrapper.get('textarea[aria-label="核定说明"]').setValue('B本人的核定')
    await button('保存并重新核算').trigger('click')
    await flushPromises()
    expect(api.savePayrollDetermination).toHaveBeenCalledWith(
      '2026-08',
      'TEST-B',
      expect.objectContaining({
        input: expect.objectContaining({
          revision: 2,
          performanceOverride: 2200,
          reason: 'B本人的核定',
        }),
        facts: expect.objectContaining({ performanceCompletionPercent: 110 }),
      }),
    )
    expect(api.calculatePayroll).toHaveBeenCalledWith('2026-08', ['TEST-B'])
  })

  it('已关闭请求迟到失败时，不关闭后来打开的核定弹窗或显示旧错误', async () => {
    const first = deferred<PayrollInput>()
    vi.mocked(api.getPayrollInput)
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce({ ...currentInput, performanceOverride: 1500 })
    const error = vi.spyOn(ElMessage, 'error')
    await openList()
    await button('核定薪酬').trigger('click')
    await flushPromises()
    await button('取消').trigger('click')
    await flushPromises()
    await button('核定薪酬').trigger('click')
    await flushPromises()
    first.reject(new Error('上次已关闭请求失败'))
    await flushPromises()
    expect(wrapper.get('input[aria-label="核定绩效"]').element).toHaveProperty('value', '1500.00')
    expect(error).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('上次已关闭请求失败')
  })

  it('关闭、切换页面和刷新保护核定输入，取消离开后保留修改', async () => {
    await openDetermination()
    const pristineReload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(pristineReload)
    expect(pristineReload.defaultPrevented).toBe(false)
    await wrapper.get('textarea[aria-label="核定说明"]').setValue('尚未保存的依据')
    await button('取消').trigger('click')
    await flushPromises()
    expect(wrapper.get('textarea[aria-label="核定说明"]').element).toHaveProperty(
      'value',
      '尚未保存的依据',
    )
    expect(await routeGuards.leave[0]!()).toBe(false)
    expect(await routeGuards.update[0]!()).toBe(false)
    const reload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(reload)
    expect(reload.defaultPrevented).toBe(true)
    vi.mocked(ElMessageBox.confirm).mockResolvedValueOnce(confirmed)
    await button('取消').trigger('click')
    await flushPromises()
    expect(wrapper.find('textarea[aria-label="核定说明"]').exists()).toBe(false)
    expect(api.savePayrollDetermination).not.toHaveBeenCalled()
  })

  it('保存时禁止取消、离开和重复提交，重算绑定原员工与月份', async () => {
    const pending = deferred<Awaited<ReturnType<typeof api.savePayrollDetermination>>>()
    vi.mocked(api.savePayrollDetermination).mockImplementationOnce(() => pending.promise)
    const original = { ...row }
    vi.mocked(api.calculatePayroll).mockResolvedValue([{ ...original, statusCode: 'READY' }])
    await openDetermination()
    await wrapper.get('textarea[aria-label="核定说明"]').setValue('原员工的核定依据')
    await button('保存并重新核算').trigger('click')
    expect(button('取消').attributes('disabled')).toBeDefined()
    expect(await routeGuards.leave[0]!()).toBe(false)
    expect(await routeGuards.update[0]!()).toBe(false)
    await button('保存并重新核算').trigger('click')
    expect(api.savePayrollDetermination).toHaveBeenCalledTimes(1)
    const reload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(reload)
    expect(reload.defaultPrevented).toBe(true)
    row.id = 'changed-row'
    row.employeeCode = 'CHANGED-EMPLOYEE'
    row.month = '2026-10'
    pending.resolve({ input: { ...currentInput, revision: 1 }, facts: null })
    await flushPromises()
    expect(api.calculatePayroll).toHaveBeenCalledWith(original.month, [original.employeeCode])
    expect(await routeGuards.leave[0]!()).toBe(true)
  })
})
