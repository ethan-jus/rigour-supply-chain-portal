import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import ElementPlus, { ElMessage, ElMessageBox } from 'element-plus'
import Rules from '@/views/supply-chain/hr/PayrollComponentView.vue'
import {
  getPayrollComponents,
  savePayrollComponent,
  actPayrollComponent,
  getPayrollComponentOperations,
} from '@/api/core/payroll-scheme/components'
import type { PayrollComponentVersionView } from '@/api/core/payroll-scheme/models/PayrollComponentVersionView'
import { resolveBizDict } from '@/api/core/business-settings'
import { clearBusinessDictionariesForTest } from '@/utils/business-dictionary'
import { flattenCommissionRows, newCommissionRow } from '@/utils/payroll-commission-rows'
import { newPayrollScheme } from '@/utils/payroll-scheme'
import { calendarFixture } from './fixtures/statutory-calendar'
vi.mock('@/api/core/business-calendar', () => ({
  getStatutoryCalendar: vi.fn(async (year: number) => calendarFixture(year)),
}))
vi.mock('@/api/core/business-settings', () => ({ resolveBizDict: vi.fn() }))
const state = vi.hoisted(() => ({
  route: { path: '/supply-chain/hr/allowance-rules' },
  leave: [] as Array<() => Promise<boolean>>,
  update: [] as Array<() => Promise<boolean>>,
}))
vi.mock('vue-router', () => ({
  useRoute: () => state.route,
  onBeforeRouteLeave: (guard: () => Promise<boolean>) => state.leave.push(guard),
  onBeforeRouteUpdate: (guard: () => Promise<boolean>) => state.update.push(guard),
}))
// confirm 实际返回动作；Element Plus 当前声明将它与 prompt 输入结果定义为交集。
const confirmed = 'confirm' as Awaited<ReturnType<typeof ElMessageBox.confirm>>
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
}))
vi.mock('@/api/core/payroll-scheme/components', () => ({
  getPayrollComponents: vi.fn().mockResolvedValue([]),
  savePayrollComponent: vi.fn().mockResolvedValue({}),
  actPayrollComponent: vi.fn().mockResolvedValue({ attendanceReviews: 0, payrollReviews: 0 }),
  getPayrollComponentOperations: vi.fn().mockResolvedValue([]),
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
  attendanceMonth: () => '2026-10',
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
  state.leave = []
  state.update = []
  vi.spyOn(ElMessageBox, 'confirm').mockRejectedValue('cancel')
  clearBusinessDictionariesForTest()
  vi.mocked(resolveBizDict).mockResolvedValue({
    dictionary: {
      id: 'units',
      dictionaryCode: 'PRODUCT_UNIT',
      dictionaryName: '商品单位',
      dictionaryType: null,
      remark: null,
      revision: 1,
    },
    items: [
      {
        id: 'SET',
        dictionaryCode: 'PRODUCT_UNIT',
        dictionaryItemCode: 'SET',
        dictionaryItemName: '套装',
        dictionaryItemLevel: 1,
        parentDictionaryItemCode: null,
        ordinal: 1,
        remark: null,
        revision: 1,
      },
    ],
  })
  state.route.path = '/supply-chain/hr/allowance-rules'
  vi.mocked(getPayrollComponents).mockResolvedValue([])
})
afterEach(() => {
  ElMessageBox.close()
  ElMessage.closeAll()
  wrapper?.unmount()
  document.body.innerHTML = ''
  vi.mocked(ElMessageBox.confirm).mockRestore()
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
async function open(
  kind: 'ALLOWANCE' | 'PERFORMANCE' | 'SALARY' | 'COMMISSION' | 'ATTENDANCE' = 'ALLOWANCE',
) {
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
        ATTENDANCE: '考勤规则',
      }[kind],
  )
}
async function basics() {
  await field('规则名称').get('input').setValue('测试规则')
  field('适用部门').getComponent({ name: 'ElTreeSelect' }).vm.$emit('update:modelValue', [1])
  await field('变更说明').get('textarea').setValue('业务调整')
}
function commissionRule(
  id: string,
  code: string,
  count: number,
  start = '2000-01-01',
  version = 1,
): PayrollComponentVersionView {
  const standards = Array.from({ length: count }, (_, i) => {
    const row = newCommissionRow(`型号${i + 1}`)
    for (const rate of [row.sales, row.manager])
      Object.assign(rate, {
        categoryIds: [1],
        method: 'QUANTITY',
        unitCode: 'SET',
        value: rate.recipientRole === 'SALES' ? 15 : 5,
      })
    return row
  })
  return {
    id,
    ruleId: code,
    ruleCode: code,
    version,
    revision: 1,
    createdBy: 'HR',
    createdTime: '2026-09-01T00:00:00Z',
    reason: '测试',
    definition: {
      name: '商品提成规则',
      kind: 'COMMISSION',
      role: 'ALL',
      departmentIds: [1],
      employeeCodes: [],
      effectiveFrom: start,
      effectiveTo: '9999-12-31',
      salary: null,
      performance: null,
      allowance: null,
      calendar: null,
      commission: {
        rules: flattenCommissionRows(standards),
        managerAttribution: 'ORDER_DATE',
        standardDate: 'ORDER_DATE',
      },
    },
  }
}
async function mountCommissionList(rows: PayrollComponentVersionView[]) {
  vi.mocked(getPayrollComponents).mockResolvedValue(rows)
  wrapper = mount(Rules, {
    props: { componentKind: 'COMMISSION' },
    global: { plugins: [ElementPlus], stubs: { ElDialog: Dialog, SupplyPageTitle: true } },
  })
  await flushPromises()
}
describe('独立薪资规则入口', () => {
  it('规则操作记录与版本历史统一显示人员和北京时间到秒', async () => {
    const row = {
      ...commissionRule('audit-rule', 'audit', 1),
      createdBy: 'SYSTEM',
      createdTime: '2026-10-19T03:52:49.014886Z',
    }
    vi.mocked(getPayrollComponentOperations).mockResolvedValueOnce([
      {
        action: 'MODIFY',
        actor: 'SYSTEM',
        reason: '测试修改',
        time: '2026-10-19T06:02:28.392666Z',
      },
    ])
    await mountCommissionList([row])
    await click('操作记录')
    const history = wrapper.get('[role="dialog"]')
    expect(history.text()).toContain('系统同步')
    expect(history.text()).toContain('2026-10-19 11:52:49')
    expect(history.text()).toContain('2026-10-19 14:02:28')
    expect(history.text()).not.toMatch(/SYSTEM|014886Z|392666Z/)
  })
  it('总部规则展示个人完成率公式和统一核定位置，规则保存不携带部门共用完成率', async () => {
    await open('PERFORMANCE')
    await basics()
    const role = field('人员身份').getComponent({ name: 'ElSelect' })
    role.vm.$emit('update:modelValue', 'HEADQUARTERS')
    role.vm.$emit('change', 'HEADQUARTERS')
    await flushPromises()

    const panel = wrapper.get('section[aria-label="总部人员绩效计算说明"]')
    expect(panel.text()).toContain('个人绩效基数 × 本人当月绩效完成率')
    expect(panel.text()).toContain('月度薪酬 → 核定薪酬')
    expect(panel.text()).toContain('同部门员工不共用完成率')
    expect(panel.text()).toContain('未填写时待核定')
    expect(panel.find('input').exists()).toBe(false)
    expect(field('绩效计算方式').text()).not.toContain('固定绩效')
    expect(field('绩效计算方式').getComponent({ name: 'ElSelect' }).props('modelValue')).toBe(
      'FIXED',
    )
    await click('保存')
    const definition = vi.mocked(savePayrollComponent).mock.calls[0]![0].definition
    expect(definition.role).toBe('HEADQUARTERS')
    expect(definition.performance?.mode).toBe('FIXED')
    expect(JSON.stringify(definition)).not.toContain('performanceCompletionPercent')
  })
  it('总部人员可单独筛选，查看历史固定模式时展示个人完成率语义，新建沿用总部身份', async () => {
    const row = commissionRule('HQ', 'PCR-HQ', 1)
    const defaults = newPayrollScheme()
    Object.assign(row.definition, {
      name: '总部绩效规则',
      kind: 'PERFORMANCE',
      role: 'HEADQUARTERS',
      commission: null,
      performance: { mode: 'FIXED', sales: defaults.sales, manager: defaults.manager, grades: [] },
    })
    vi.mocked(getPayrollComponents).mockResolvedValue([row])
    wrapper = mount(Rules, {
      props: { componentKind: 'PERFORMANCE' },
      global: { plugins: [ElementPlus], stubs: { ElDialog: Dialog, SupplyPageTitle: true } },
    })
    await flushPromises()
    expect(wrapper.get('.rule-table-panel').text()).not.toContain('总部绩效规则')
    await wrapper.get('.performance-role-tabs input[value="HEADQUARTERS"]').setValue(true)
    await flushPromises()
    const table = wrapper.get('.rule-table-panel')
    expect(table.text()).toContain('总部绩效规则')
    expect(table.text()).toContain('按个人月度完成率')
    expect(table.text()).toContain('HR按员工、月份分别核定')
    expect(table.text()).not.toContain('固定绩效')
    await click('查看')
    expect(wrapper.get('section[aria-label="总部人员绩效计算说明"]').text()).toContain(
      '本人当月绩效完成率',
    )
    expect(field('绩效计算方式').find('.el-select__wrapper.is-disabled').exists()).toBe(true)
    await click('关闭')
    await click('新增绩效规则')
    expect(field('人员身份').getComponent({ name: 'ElSelect' }).props('modelValue')).toBe(
      'HEADQUARTERS',
    )
    expect(wrapper.find('section[aria-label="总部人员绩效计算说明"]').exists()).toBe(true)
    expect(savePayrollComponent).not.toHaveBeenCalled()
  })
  it('城市总绩效关联城市经营指标，回款使用实际到账来源并随规则保存', async () => {
    await open('PERFORMANCE')
    await basics()
    field('人员身份')
      .getComponent({ name: 'ElSelect' })
      .vm.$emit('update:modelValue', 'CITY_MANAGER')
    field('人员身份').getComponent({ name: 'ElSelect' }).vm.$emit('change', 'CITY_MANAGER')
    await flushPromises()
    await click('增加绩效指标')
    const linked = field('关联城市指标').getComponent({ name: 'ElSelect' })
    linked.vm.$emit('update:modelValue', 'RECEIPT_AMOUNT')
    linked.vm.$emit('change', 'RECEIPT_AMOUNT')
    await flushPromises()
    expect(field('指标名称').get('input').element.value).toBe('回款额')
    expect(field('实际值来源').getComponent({ name: 'ElSelect' }).props('modelValue')).toBe(
      'CITY_RECEIPTS',
    )
    field('权重（%）').getComponent({ name: 'ElInputNumber' }).vm.$emit('update:modelValue', 100)
    const tiers = wrapper.getComponent({ name: 'PayrollCoefficientEditor' })
    const ranges = tiers.props('modelValue').map((range: { coefficient: number }) => ({ ...range }))
    ranges[2].coefficient = 1.8
    tiers.vm.$emit('update:modelValue', ranges)
    await flushPromises()
    await click('保存')
    expect(savePayrollComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        definition: expect.objectContaining({
          performance: expect.objectContaining({
            manager: expect.objectContaining({
              calculationMode: 'ACTUAL_COMPLETION',
              metrics: [
                expect.objectContaining({
                  cityMetric: 'RECEIPT_AMOUNT',
                  source: 'CITY_RECEIPTS',
                  name: '回款额',
                  weight: 100,
                  scoringMode: 'TIERED',
                  steps: expect.arrayContaining([
                    expect.objectContaining({ lower: 1.5, upper: 2, coefficient: 1.8 }),
                  ]),
                }),
              ],
            }),
          }),
        }),
      }),
    )
  })
  it('历史城市总规则在列表与查看中明确旧算法，不使用新城市指标说明覆盖原回款来源', async () => {
    const row = commissionRule('M-OLD', 'PCR-M-OLD', 1)
    const defaults = newPayrollScheme()
    Object.assign(row.definition, {
      kind: 'PERFORMANCE',
      role: 'CITY_MANAGER',
      commission: null,
      performance: {
        mode: 'MANAGER',
        sales: defaults.sales,
        grades: [],
        manager: {
          ...defaults.manager,
          calculationMode: 'TIERED',
          cap: 1.2,
          metrics: [
            {
              code: 'OLD-COLLECTION',
              name: '历史回款',
              source: 'FULLY_PAID_RECEIPTS',
              target: 10000,
              weight: 100,
              cap: null,
              steps: [],
            },
          ],
        },
      },
    })
    vi.mocked(getPayrollComponents).mockResolvedValue([row])
    wrapper = mount(Rules, {
      props: { componentKind: 'PERFORMANCE' },
      global: { plugins: [ElementPlus], stubs: { ElDialog: Dialog, SupplyPageTitle: true } },
    })
    await flushPromises()
    await wrapper.get('.performance-role-tabs input[value="CITY_MANAGER"]').setValue(true)
    await flushPromises()
    expect(wrapper.get('.rule-table-panel').text()).toContain('历史规则：综合完成率匹配阶梯系数')
    await click('查看')
    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.text()).toContain('历史规则：目标和实际值按本版本保存的配置核算')
    expect(dialog.text()).not.toContain('目标读取所辖城市同月指标')
    expect(field('实际值来源').text()).toContain('管辖城市整单付清业绩')
    expect(field('历史最高倍数').text()).not.toContain('>')
    expect(savePayrollComponent).not.toHaveBeenCalled()
  })
  it('按规则编码归组并合并公共列，版本隐藏但不同生效期间的操作不混合，单位主动读取字典名称', async () => {
    await mountCommissionList([
      commissionRule('current', 'PCR001', 2),
      commissionRule('future', 'PCR001', 2, '9999-11-01', 2),
      commissionRule('same-name', 'PCR002', 1),
    ])
    const table = wrapper.get('.rule-table-panel')
    const rows = table.findAll('.el-table__body tbody tr')
    expect(rows).toHaveLength(5)
    expect(rows[0]!.findAll('td')[0]!.attributes('rowspan')).toBe('4')
    expect(rows[0]!.text()).toContain('PCR001')
    expect(rows[4]!.text()).toContain('PCR002')
    expect(table.text()).toContain('共 2 条规则，5 条标准')
    expect(table.findAll('button').filter((b) => b.text() === '查看')).toHaveLength(3)
    expect(table.findAll('button').filter((b) => b.text() === '修改')).toHaveLength(1)
    expect(table.findAll('button').filter((b) => b.text() === '停用')).toHaveLength(2)
    expect(table.text()).toContain('15.00 元 / 套装')
    expect(table.text()).toContain('20.00 元 / 套装')
    expect(table.text()).not.toContain('SET')
    expect(table.text()).not.toMatch(/版本|\bv[12]\b/)
    expect(resolveBizDict).toHaveBeenCalledWith('PRODUCT_UNIT')
  })
  it('按规则分页，不把同一规则的商品标准拆到不同页；筛选后重新分组', async () => {
    const rows = [
      commissionRule('large', 'PCR000', 21),
      ...Array.from({ length: 20 }, (_, i) =>
        commissionRule(`R${i}`, `PCR${String(i + 1).padStart(3, '0')}`, 1),
      ),
    ]
    await mountCommissionList(rows)
    expect(wrapper.findAll('.rule-table-panel .el-table__body tbody tr')).toHaveLength(40)
    expect(wrapper.get('.rule-table-panel .el-table__body tbody tr td').attributes('rowspan')).toBe(
      '21',
    )
    await wrapper.get('.el-pagination .btn-next').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.rule-table-panel .el-table__body tbody tr')).toHaveLength(1)
    expect(wrapper.get('.rule-table-panel .el-table__body').text()).toContain('PCR020')
    await wrapper.get('input[aria-label="规则编码或名称"]').setValue('PCR000')
    await flushPromises()
    expect(wrapper.findAll('.rule-table-panel .el-table__body tbody tr')).toHaveLength(21)
    expect(wrapper.get('.rule-list-heading').text()).toContain('共 1 条规则，21 条标准')
  })
  it('按状态显示修改删除、停用和重新启用，待生效修改保留版本并提交并发版本号', async () => {
    const row = (id: string, start: string): PayrollComponentVersionView => ({
      id,
      ruleId: id,
      ruleCode: id,
      version: 1,
      revision: 3,
      reason: '创建',
      createdBy: 'HR',
      createdTime: '2026-09-01T00:00:00Z',
      definition: {
        name: id,
        kind: 'ALLOWANCE',
        role: 'SALES',
        departmentIds: [1],
        employeeCodes: [],
        effectiveFrom: start,
        effectiveTo: '9999-12-31',
        salary: null,
        performance: null,
        commission: null,
        calendar: null,
        allowance: { items: [{ code: 'transport', name: '交通', amount: 750 }], proration: 'NONE' },
      },
    })
    const active = row('使用中规则', '2000-01-01')
    const pending = row('待生效规则', '9999-11-01')
    const stopped = {
      ...row('已停用规则', '2000-01-01'),
      stateChanges: [
        {
          revision: 1,
          effectiveMonth: '2000-01',
          enabled: false,
          reason: '停用',
          actor: 'HR',
          time: '2000-01-01T00:00:00Z',
        },
      ],
    }
    vi.mocked(getPayrollComponents).mockResolvedValue([active, pending, stopped])
    wrapper = mount(Rules, {
      props: { componentKind: 'ALLOWANCE' },
      global: { plugins: [ElementPlus], stubs: { ElDialog: Dialog, SupplyPageTitle: true } },
    })
    await flushPromises()
    const currentRow = wrapper.findAll('tr').find((tr) => tr.text().includes('使用中规则'))!
    const pendingRow = wrapper.findAll('tr').find((tr) => tr.text().includes('待生效规则'))!
    const stoppedRow = wrapper.findAll('tr').find((tr) => tr.text().includes('已停用规则'))!
    expect(currentRow.text()).toContain('停用')
    expect(currentRow.text()).not.toContain('修改')
    expect(pendingRow.text()).toContain('修改删除')
    expect(stoppedRow.text()).toContain('重新启用')
    await currentRow
      .findAll('button')
      .find((button) => button.text() === '停用')!
      .trigger('click')
    await flushPromises()
    const body = new DOMWrapper(document.body)
    await body.get('.el-message-box__input textarea').setValue('业务调整')
    await body.get('.el-message-box__btns .el-button--primary').trigger('click')
    await flushPromises()
    expect(actPayrollComponent).toHaveBeenCalledWith(
      expect.objectContaining({ id: active.id, revision: 3 }),
      'DISABLE',
      '业务调整',
      expect.any(String),
    )
    await click('修改')
    await field('规则名称').get('input').setValue('新名称')
    await field('变更说明').get('textarea').setValue('修改待生效规则')
    await click('保存')
    expect(savePayrollComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        previousId: pending.id,
        replacePending: true,
        revision: 3,
        definition: expect.objectContaining({ name: '新名称', effectiveFrom: '9999-11-01' }),
      }),
    )
  })
  it('日历选休息日后通过原考勤规则接口保存，不恢复星期勾选配置', async () => {
    await open('ATTENDANCE')
    await basics()
    field('生效月份')
      .getComponent({ name: 'ElDatePicker' })
      .vm.$emit('update:modelValue', '2026-10-01')
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').text()).not.toContain('每周工作日')
    await wrapper.get('button[aria-label="2026-10-10 工作日"]').trigger('click')
    await click('保存')
    expect(savePayrollComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        definition: expect.objectContaining({
          kind: 'ATTENDANCE',
          calendar: expect.objectContaining({
            source: 'STATUTORY',
            weekdays: [1, 2, 3, 4, 5],
            restDays: ['2026-10-10'],
            workDays: [],
          }),
        }),
      }),
    )
  })
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
    expect(savePayrollComponent).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('请至少选择适用商品分类或指定商品型号／规格')
    const editor = wrapper.getComponent({ name: 'PayrollSchemeCommissionEditor' })
    await editor
      .getComponent({ name: 'ElTreeSelect' })
      .getComponent({ name: 'ElTree' })
      .get('[data-key="1"] > .el-tree-node__content input')
      .setValue(true)
    await click('完成')
    await click('保存')
    const definition = vi.mocked(savePayrollComponent).mock.calls[0]![0].definition
    expect(definition.commission?.rules.map((r) => [r.recipientRole, r.value])).toEqual([
      ['SALES', 4],
      ['CITY_MANAGER', 1],
    ])
    expect(
      definition.commission?.rules.every(
        (r) => r.categoryIds.length === 1 && r.categoryIds[0] === 1,
      ),
    ).toBe(true)
  })
  it('保存失败保留内容，重试沿用请求编号', async () => {
    vi.mocked(savePayrollComponent).mockRejectedValueOnce(new Error('服务暂不可用'))
    await open()
    await basics()
    await click('保存')
    expect(wrapper.text()).toContain('服务暂不可用')
    const first = vi.mocked(savePayrollComponent).mock.calls[0]![0]
    expect(await state.leave[0]!()).toBe(false)
    expect(field('规则名称').get('input').element).toHaveProperty('value', '测试规则')
    await click('保存')
    expect(vi.mocked(savePayrollComponent).mock.calls[1]![0]).toEqual(first)
  })

  it('未修改规则关闭或刷新不提示，已修改规则取消离开后保留内容', async () => {
    await open()
    const pristineReload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(pristineReload)
    expect(pristineReload.defaultPrevented).toBe(false)
    await click('关闭')
    expect(ElMessageBox.confirm).not.toHaveBeenCalled()

    await click('新增补贴规则')
    await basics()
    await click('关闭')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    expect(field('规则名称').get('input').element).toHaveProperty('value', '测试规则')
    expect(await state.leave[0]!()).toBe(false)
    expect(await state.update[0]!()).toBe(false)
    const reload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(reload)
    expect(reload.defaultPrevented).toBe(true)

    vi.mocked(ElMessageBox.confirm).mockResolvedValueOnce(confirmed)
    expect(await state.update[0]!()).toBe(true)
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(savePayrollComponent).not.toHaveBeenCalled()
  })

  it('保存期间禁止关闭、路由离开和刷新，并阻止重复提交', async () => {
    let complete!: (value: Awaited<ReturnType<typeof savePayrollComponent>>) => void
    vi.mocked(savePayrollComponent).mockImplementationOnce(
      () => new Promise((resolve) => (complete = resolve)),
    )
    await open()
    await basics()
    await click('保存')
    const close = wrapper.findAll('button').find((b) => b.text() === '关闭')!
    expect(close.attributes('disabled')).toBeDefined()
    expect(await state.leave[0]!()).toBe(false)
    expect(await state.update[0]!()).toBe(false)
    await click('保存')
    expect(savePayrollComponent).toHaveBeenCalledTimes(1)
    const reload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(reload)
    expect(reload.defaultPrevented).toBe(true)

    complete({} as Awaited<ReturnType<typeof savePayrollComponent>>)
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(await state.leave[0]!()).toBe(true)
    expect(ElMessageBox.confirm).not.toHaveBeenCalled()
  })
})
