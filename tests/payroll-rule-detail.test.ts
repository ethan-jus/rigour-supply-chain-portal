import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import PayrollRuleDetail from '@/views/supply-chain/hr/components/PayrollRuleDetail.vue'
import PayrollRuleParameters from '@/views/supply-chain/hr/components/PayrollRuleParameters.vue'
import PayrollCommissionRateEditor from '@/views/supply-chain/hr/components/PayrollCommissionRateEditor.vue'
import PayrollSchemePerformanceEditor from '@/views/supply-chain/hr/components/PayrollSchemePerformanceEditor.vue'
import PayrollCoefficientEditor from '@/views/supply-chain/hr/components/PayrollCoefficientEditor.vue'
import type { PayrollComponentVersionView } from '@/api/core/payroll-scheme/models/PayrollComponentVersionView'
import { newPayrollScheme, newSchemeCommission } from '@/utils/payroll-scheme'

vi.mock('@/api/core/payroll', () => ({ getPayrollProducts: vi.fn().mockResolvedValue([]) }))
vi.mock('@/utils/payroll-dictionaries', () => ({
  loadPayrollProductUnits: vi.fn().mockResolvedValue(undefined),
  payrollUnitName: (code: string) => (code === 'SET' ? '套' : '-'),
}))
let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})
function record(amount: number | null = 500): PayrollComponentVersionView {
  return {
    id: 'version-1',
    ruleId: 'rule-1',
    ruleCode: 'TEST-RULE',
    version: 1,
    reason: '历史规则展示测试',
    createdBy: '',
    createdTime: '2026-09-01T00:00:00Z',
    definition: {
      name: '示例补贴',
      kind: 'ALLOWANCE',
      role: 'SALES',
      departmentIds: [1, 2],
      effectiveFrom: '2026-09-01',
      effectiveTo: '',
      employeeCodes: [],
      salary: null,
      performance: null,
      commission: null,
      calendar: null,
      allowance: { proration: 'NONE', items: [{ code: 'transport', name: '交通', amount }] },
    },
  }
}
describe('规则详情按保存配置展示', () => {
  it('历史销售补贴保留原折算方式，详情不混入编辑控件', () => {
    wrapper = mount(PayrollRuleDetail, {
      props: {
        row: record(),
        departments: [
          { id: 1, name: '销售部', parentId: null, sortOrder: 0 },
          { id: 2, name: '武汉市', parentId: 1, sortOrder: 0 },
        ],
        state: '已废弃',
        period: '2026-09-01 至 2026-09-30',
      },
      global: { plugins: [ElementPlus] },
    })
    expect(wrapper.text()).toContain('不折算')
    expect(wrapper.text()).not.toContain('按已确认出勤')
    expect(wrapper.text()).toContain('2026-09-01 至 2026-09-30')
    expect(wrapper.findAll('input, select, textarea')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('移除')
    expect(
      wrapper
        .findAll('dt')
        .map((field) => field.text())
        .some((label) => label.includes('版本')),
    ).toBe(false)
    expect(wrapper.find('[aria-label="适用部门组织树"]').text()).toContain('武汉市')
  })
  it('标准缺金额时合计保留未知，不显示为零', () => {
    wrapper = mount(PayrollRuleDetail, {
      props: { row: record(null), departments: [], state: '待生效', period: '尚未生效' },
      global: { plugins: [ElementPlus] },
    })
    expect(wrapper.find('.record-detail__amount').text()).toBe('-')
  })
  it('销售绩效分别展示目标、扣减和权重，并保留空值', async () => {
    const scheme = newPayrollScheme()
    const definition = record().definition
    definition.allowance = null
    definition.kind = 'PERFORMANCE'
    definition.performance = {
      mode: 'SALES',
      sales: { ...scheme.sales, processPercent: 35, checkinPenalty: null, dailyCheckins: 7 },
      manager: scheme.manager,
      grades: [],
    }
    // 实际销售规则接口可不携带城市总专用参数。
    Object.assign(definition.performance, { manager: null })
    wrapper = mount(PayrollRuleParameters, {
      props: { definition, categories: [] },
      global: { plugins: [ElementPlus] },
    })
    await flushPromises()
    const fields = wrapper.findAll('.parameter-fields > div').map((field) => field.text())
    expect(fields).toContain('打卡与有效拜访权重35%')
    expect(fields).toContain('回款考核权重65%')
    expect(fields).toContain('每日打卡目标（次）7')
    expect(fields).toContain('每次缺卡扣减（元）-')
    expect(wrapper.findAll('input, select, textarea')).toHaveLength(0)
  })
  it.each([
    ['PERCENT', false, 4, '按回款比例'],
    ['QUANTITY', false, 15, '按数量'],
    ['QUANTITY', true, 0, '明确不计提'],
    ['PERCENT', false, null, '按回款比例'],
  ] as const)(
    '提成计算方式 %s / excluded=%s 与编辑选项一致，标准值不改写',
    async (method, excluded, amount, expected) => {
      const rule = { ...newSchemeCommission(), method, excluded, value: amount, unitCode: 'SET' }
      const editor = mount(PayrollCommissionRateEditor, {
        props: { modelValue: structuredClone(rule) },
        global: { plugins: [ElementPlus] },
      })
      try {
        const selected = editor.getComponent({ name: 'ElSelect' }).props('modelValue')
        const option = editor
          .findAllComponents({ name: 'ElOption' })
          .find((item) => item.props('value') === selected)
        expect(option?.props('label')).toBe(expected)
        const definition = record().definition
        definition.allowance = null
        definition.commission = { ...newPayrollScheme().commission, rules: [rule] }
        definition.kind = 'COMMISSION'
        wrapper = mount(PayrollRuleParameters, {
          props: { definition, categories: [] },
          global: { plugins: [ElementPlus] },
        })
        await flushPromises()
        const cells = wrapper.findAll('.el-table__body tbody tr')[0]!.findAll('td')
        expect(cells[4]!.text()).toBe(expected)
        expect(cells[5]!.text()).toBe(
          !excluded && method === 'PERCENT' && amount != null ? String(amount) : '-',
        )
        expect(cells[6]!.text()).toBe(
          !excluded && method === 'QUANTITY' && amount != null ? String(amount) : '-',
        )
        expect(cells[7]!.text()).toBe(!excluded && method === 'QUANTITY' ? '套' : '-')
        expect(definition.commission.rules[0]).toEqual(rule)
      } finally {
        editor.unmount()
      }
    },
  )
  it.each([
    ['SALES', 'SALES', 'ACTUAL_COMPLETION', '销售：打卡拜访与回款达标'],
    ['CITY_MANAGER', 'MANAGER', 'ACTUAL_COMPLETION', '城市总：单项指标计分后加权汇总'],
    ['CITY_MANAGER', 'MANAGER', 'TIERED', '城市总：历史综合完成率考核'],
    ['HEADQUARTERS', 'FIXED', 'ACTUAL_COMPLETION', '按个人月度完成率'],
    ['SALES', 'FIXED', 'ACTUAL_COMPLETION', '固定绩效'],
    ['SALES', 'NONE', 'ACTUAL_COMPLETION', '不计绩效'],
  ] as const)(
    '绩效 %s / %s / %s 列举保存选项，与只读表单一致',
    async (role, mode, calculationMode, expected) => {
      const form = newPayrollScheme()
      form.role = role
      form.performanceMode = mode
      form.manager.calculationMode = calculationMode
      const editor = mount(PayrollSchemePerformanceEditor, {
        props: { modelValue: form, disabled: true },
        global: { plugins: [ElementPlus] },
      })
      try {
        const selected = editor.getComponent({ name: 'ElSelect' }).props('modelValue')
        expect(
          editor
            .findAllComponents({ name: 'ElOption' })
            .find((item) => item.props('value') === selected)
            ?.props('label'),
        ).toBe(expected)
        const definition = record().definition
        Object.assign(definition, {
          kind: 'PERFORMANCE',
          role,
          allowance: null,
          performance: { mode, sales: form.sales, manager: form.manager, grades: [] },
        })
        wrapper = mount(PayrollRuleParameters, {
          props: { definition, categories: [] },
          global: { plugins: [ElementPlus] },
        })
        await flushPromises()
        expect(wrapper.find('.parameter-fields dd').text()).toBe(expected)
      } finally {
        editor.unmount()
      }
    },
  )
  it('绩效分钟、完成率百分比及城市总选项均保留编辑页的显示值与单位', async () => {
    const form = newPayrollScheme()
    form.sales.minimumSeconds = 160
    const definition = record().definition
    Object.assign(definition, {
      kind: 'PERFORMANCE',
      allowance: null,
      performance: {
        mode: 'SALES',
        sales: form.sales,
        manager: form.manager,
        grades: [
          {
            code: 'G',
            name: '测试档位',
            lower: 8000,
            upper: 15000,
            lowerInclusive: true,
            upperInclusive: false,
          },
        ],
      },
    })
    wrapper = mount(PayrollRuleParameters, {
      props: { definition, categories: [] },
      global: { plugins: [ElementPlus] },
    })
    const editor = mount(PayrollSchemePerformanceEditor, {
      props: { modelValue: form, disabled: true },
      global: { plugins: [ElementPlus] },
    })
    try {
      const minutes = editor
        .findAll('.el-form-item')
        .find((item) => item.text().includes('有效沟通最少时长（分钟）'))!
      expect(minutes.getComponent({ name: 'ElInputNumber' }).props('modelValue')).toBe(2.67)
      expect(
        wrapper
          .findAll('.parameter-fields > div')
          .find((item) => item.text().includes('有效沟通最少时长（分钟）'))
          ?.get('dd')
          .text(),
      ).toBe('2.67')
      await flushPromises()
      expect(wrapper.text()).toContain('8000') // 业绩档位为金额，不按完成率转换。
    } finally {
      editor.unmount()
    }
    wrapper.unmount()
    const steps = [
      {
        lower: 0.8,
        upper: 1.5,
        lowerInclusive: true,
        upperInclusive: false,
        mode: 'FIXED',
        coefficient: 1.2,
      },
    ]
    form.manager.metrics = [
      {
        code: 'M',
        name: '测试指标',
        source: 'CITY_RECEIPTS',
        cityMetric: 'RECEIPT_AMOUNT',
        target: 5000,
        weight: 30,
        scoringMode: 'TIERED',
        cap: null,
        steps,
      },
    ]
    Object.assign(definition.performance!, { mode: 'MANAGER', manager: form.manager })
    definition.role = 'CITY_MANAGER'
    wrapper = mount(PayrollRuleParameters, {
      props: { definition, categories: [] },
      global: { plugins: [ElementPlus] },
    })
    const coefficientEditor = mount(PayrollCoefficientEditor, {
      props: { modelValue: steps, disabled: true },
      global: { plugins: [ElementPlus] },
    })
    try {
      await flushPromises()
      expect(
        coefficientEditor
          .findAllComponents({ name: 'ElInputNumber' })
          .map((item) => item.props('modelValue')),
      ).toEqual([80, 150, 1.2])
      const cells = wrapper
        .findAll('.el-table__body tbody tr')[0]!
        .findAll('td')
        .map((item) => item.text())
      expect(cells).toEqual(['80', '是', '150', '否', '直接采用固定系数', '1.2'])
      expect(wrapper.text()).toContain('管辖城市全部有效回款（实际到账）')
      expect(wrapper.text()).toContain('从入职日起顺延日历月')
      expect(form.manager.metrics[0]!.steps).toEqual(steps)
    } finally {
      coefficientEditor.unmount()
    }
  })
})
