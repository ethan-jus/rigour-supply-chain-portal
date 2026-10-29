import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { getPayrollProducts, type PayrollProduct } from '@/api/core/payroll'
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
  payrollUnitName: (code: string) => (code === 'SET' ? '套' : code === 'BED' ? '床' : '-'),
}))
beforeEach(() => {
  vi.mocked(getPayrollProducts).mockReset().mockResolvedValue([])
})
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
        const headers = wrapper.findAll('.commission-detail-table th').map((cell) => cell.text())
        const cell = (label: string) => cells[headers.indexOf(label)]!.text()
        expect(cell('计提方式')).toBe(expected)
        expect(cell('提成比例（%）')).toBe(
          !excluded && method === 'PERCENT' && amount != null ? String(amount) : '-',
        )
        expect(cell('单位提成（元）')).toBe(
          !excluded && method === 'QUANTITY' && amount != null ? String(amount) : '-',
        )
        expect(cell('计提单位')).toBe(!excluded && method === 'QUANTITY' ? '套' : '-')
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

const scopeProduct = (
  id: string,
  name: string,
  specification: string | null = null,
): PayrollProduct => ({
  productVariantId: id,
  productId: 'P' + id,
  productCode: 'CODE' + id,
  variantCode: 'SKU' + id,
  productName: name,
  specification,
  categoryId: 2,
  categoryName: '方便面',
  unitCode: 'SET',
})
async function openCommission(rules: ReturnType<typeof newSchemeCommission>[]) {
  const definition = record().definition
  Object.assign(definition, {
    kind: 'COMMISSION',
    allowance: null,
    commission: { ...newPayrollScheme().commission, rules },
  })
  const original = structuredClone(definition)
  wrapper = mount(PayrollRuleParameters, {
    attachTo: document.body,
    props: {
      definition,
      categories: [
        { id: 1, name: '快销品', parentId: null, sortOrder: 1 },
        { id: 2, name: '方便面', parentId: 1, sortOrder: 2 },
        { id: 3, name: '停供分类', parentId: null, sortOrder: 3 },
      ],
    },
    global: { plugins: [ElementPlus] },
  })
  await flushPromises()
  return { definition, original }
}

describe('提成详情按商品规格归组', () => {
  it('商品展开只展示当前商品信息，不再重复完整适用范围和商品清单', async () => {
    const products = [scopeProduct('V1', '商品甲'), scopeProduct('V2', '商品乙', '大包装')]
    vi.mocked(getPayrollProducts).mockImplementation(async (_keyword, _category, id) =>
      products.filter((product) => product.productVariantId === id),
    )
    const sales = {
      ...newSchemeCommission(),
      name: '组合标准',
      categoryIds: [1],
      variantIds: ['V1', 'V2'],
      value: 4,
    }
    const manager = {
      ...structuredClone(sales),
      recipientRole: 'CITY_MANAGER',
      variantIds: ['V2', 'V1'],
      value: 1,
    }
    const { definition, original } = await openCommission([sales, manager])
    expect(wrapper!.findAll('.commission-detail-table .el-table__row')).toHaveLength(4)
    await wrapper!.get('.commission-detail-table .el-table__expand-icon').trigger('click')
    await flushPromises()
    const detail = wrapper!.get('.commission-product-detail')
    expect(
      Object.fromEntries(
        detail.findAll('dl > div').map((field) => [field.get('dt').text(), field.get('dd').text()]),
      ),
    ).toEqual({ 商品名称: '商品甲', 规格: '-', 商品分类: '方便面' })
    expect(detail.text()).not.toContain('商品乙')
    expect(detail.text()).not.toContain('快销品')
    expect(wrapper!.text()).not.toContain('提成适用范围')
    expect(wrapper!.text()).not.toContain('指定规格')
    expect(wrapper!.find('.commission-scopes').exists()).toBe(false)
    expect(definition).toEqual(original)
    expect(wrapper!.findAll('input,textarea,select')).toHaveLength(0)
  })
  it('按分类配置不把标准名称冒充商品名称，分类在当前行展开信息中可核对', async () => {
    const { definition, original } = await openCommission([
      { ...newSchemeCommission(), name: '维护时的备注名称', categoryIds: [1], value: 4 },
    ])
    const cells = wrapper!.get('.commission-detail-table .el-table__row').findAll('td')
    expect(cells[1]!.text()).toBe('-')
    expect(cells[2]!.text()).toBe('-')
    expect(cells[3]!.text()).toBe('按商品分类')
    expect(wrapper!.get('.commission-detail-table').text()).not.toContain('维护时的备注名称')
    await wrapper!.get('.commission-detail-table .el-table__expand-icon').trigger('click')
    await flushPromises()
    const fields = Object.fromEntries(
      wrapper!
        .get('.commission-product-detail')
        .findAll('dl > div')
        .map((field) => [field.get('dt').text(), field.get('dd').text()]),
    )
    expect(fields).toEqual({ 商品名称: '-', 规格: '-', 商品分类: '快销品' })
    expect(definition).toEqual(original)
  })
  it('同商品不同排除条件和角色的金额仍逐项保留，不改写保存条件', async () => {
    const sales = {
      ...newSchemeCommission(),
      variantIds: ['V1'],
      excludedVariantIds: ['X1'],
      value: 4,
    }
    const manager = {
      ...structuredClone(sales),
      recipientRole: 'CITY_MANAGER',
      excludedVariantIds: ['X2'],
      value: 1,
    }
    const { definition, original } = await openCommission([sales, manager])
    expect(wrapper!.findAll('.commission-detail-table .el-table__row')).toHaveLength(2)
    expect(
      wrapper!
        .findAll('.commission-detail-table .el-table__row')
        .map((row) => row.get('.commission-recipient').text()),
    ).toEqual(['销售', '城市总'])
    expect(wrapper!.get('.commission-detail-table').text()).toContain('4')
    expect(wrapper!.get('.commission-detail-table').text()).toContain('1')
    expect(definition).toEqual(original)
  })
  it('同一商品规格的套、床标准放在一起，销售与城市总相邻，另一规格独立分组', async () => {
    const products = [
      scopeProduct('V1', '同一商品', 'A300'),
      scopeProduct('V2', '同一商品', 'A500'),
    ]
    vi.mocked(getPayrollProducts).mockImplementation(async (_keyword, _category, id) =>
      products.filter((p) => p.productVariantId === id),
    )
    const rules = [
      { recipientRole: 'SALES', unitCode: 'SET', value: 15 },
      { recipientRole: 'CITY_MANAGER', unitCode: 'SET', value: 5 },
      { recipientRole: 'SALES', unitCode: 'BED', value: 8 },
      { recipientRole: 'CITY_MANAGER', unitCode: 'BED', value: 2 },
    ].map((rate) => ({
      ...newSchemeCommission(),
      ...rate,
      method: 'QUANTITY',
      variantIds: ['V1', 'V2'],
    }))
    const { definition, original } = await openCommission(rules)
    const table = wrapper!.get('.commission-detail-table')
    const names = table.findAll('td.commission-product-name')
    expect(names.map((cell) => [cell.text(), cell.attributes('rowspan')])).toEqual([
      ['同一商品', '4'],
      ['同一商品', '4'],
    ])
    expect(table.findAll('td.commission-product-specification').map((cell) => cell.text())).toEqual(
      ['A300', 'A500'],
    )
    expect(
      table.findAll('td.commission-unit').map((cell) => [cell.text(), cell.attributes('rowspan')]),
    ).toEqual([
      ['套', '2'],
      ['床', '2'],
      ['套', '2'],
      ['床', '2'],
    ])
    expect(
      table
        .findAll('.el-table__row')
        .map((row) => [
          row.get('.commission-recipient').text(),
          row.get('.commission-unit-amount').text(),
        ]),
    ).toEqual([
      ['销售', '15'],
      ['城市总', '5'],
      ['销售', '8'],
      ['城市总', '2'],
      ['销售', '15'],
      ['城市总', '5'],
      ['销售', '8'],
      ['城市总', '2'],
    ])
    await table.get('.el-table__expand-icon').trigger('click')
    await flushPromises()
    expect(table.findAll('.el-table__row')).toHaveLength(8)
    expect(table.get('.commission-product-detail').text()).toContain('A300')
    expect(table.get('.commission-product-detail').text()).not.toContain('A500')
    expect(table.findAll('td.commission-product-name')[0]!.attributes('rowspan')).toBe('1')
    expect(definition).toEqual(original)
  })
  it('商品资料加载失败显示提示并可重试，原商品与排除范围保持不变', async () => {
    vi.mocked(getPayrollProducts).mockRejectedValue(new Error('目录暂不可用'))
    const rule = {
      ...newSchemeCommission(),
      variantIds: ['V1'],
      excludedVariantIds: ['X1'],
      value: 4,
    }
    const { definition, original } = await openCommission([rule])
    expect(wrapper!.get('.el-alert').text()).toContain('已保留原配置范围')
    expect(wrapper!.get('td.commission-product-name').text()).toBe('-')
    vi.mocked(getPayrollProducts).mockResolvedValue([scopeProduct('V1', '商品甲')])
    await wrapper!.get('.el-alert button').trigger('click')
    await flushPromises()
    expect(wrapper!.find('.el-alert').exists()).toBe(false)
    expect(wrapper!.get('td.commission-product-name').text()).toBe('商品甲')
    expect(getPayrollProducts).not.toHaveBeenCalledWith('', null, 'X1')
    expect(definition).toEqual(original)
  })
})
