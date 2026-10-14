import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, reactive } from 'vue'
import ElementPlus, { ElMessage } from 'element-plus'
import Rules from '@/views/supply-chain/hr/PayrollRuleView.vue'
import {
  type PayrollRule,
  savePayrollRule,
  createCityManagerRules,
  getPayrollRules,
  getPayrollEmployees,
  getPayrollDepartments,
  getPayrollProducts,
  getPayrollProductCategories,
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
  getPayrollProductCategories: vi.fn().mockResolvedValue([]),
  getPayrollDepartments: vi
    .fn()
    .mockResolvedValue([{ id: 1, parentId: null, name: '销售部', sortOrder: 0 }]),
  getPayrollEmployees: vi.fn().mockResolvedValue([]),
  getPayrollProducts: vi.fn().mockResolvedValue([]),
  getPayrollRules: vi.fn().mockResolvedValue({ total: 0, begin: 0, step: 20, items: [] }),
  createCityManagerRules: vi.fn().mockResolvedValue([]),
  savePayrollRule: vi.fn().mockResolvedValue({}),
}))
vi.mock('@/utils/business-dictionary', () => ({
  loadBusinessDictionaries: vi.fn().mockResolvedValue(undefined),
  businessDictionaryLabel: (_m: string, c: string, v: string) =>
    c === 'PRODUCT_UNIT' && v === 'SET' ? '套' : v || '—',
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
  vi.mocked(getCostCities).mockResolvedValue([])
  vi.mocked(savePayrollRule).mockResolvedValue({} as never)
  vi.mocked(loadBusinessDictionaries).mockResolvedValue(undefined)
  vi.mocked(getPayrollProductCategories).mockResolvedValue([
    { id: 2, parentId: null, name: '台呢', sortOrder: 0 },
    { id: 3, parentId: null, name: '快消品', sortOrder: 1 },
  ])
  vi.mocked(getPayrollProducts).mockResolvedValue([
    {
      productId: '1',
      productVariantId: '600',
      productCode: 'P',
      variantCode: 'SKU600',
      productName: '澳洋华彩',
      specification: 'A600',
      unitCode: 'SET',
      categoryId: 2,
      categoryName: '台呢',
    },
  ])
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

async function openCommission() {
  state.route.path = '/supply-chain/hr/commission-rules'
  wrapper = mount(Rules, {
    global: { plugins: [ElementPlus], stubs: { ElDialog: Dialog, SupplyPageTitle: true } },
  })
  await flushPromises()
  await wrapper
    .findAll('button')
    .find((b) => b.text() === '新增商品提成规则')!
    .trigger('click')
  await flushPromises()
}
describe('商品分类与型号提成', () => {
  it('移除参考标准，分类联动真实型号且切换角色不覆盖手填金额', async () => {
    await openCommission()
    expect(wrapper.find('[role="dialog"]').text()).not.toContain('参考标准')
    expect(wrapper.find('[role="dialog"]').text()).not.toContain('参考数值')
    expect(field('规格型号').getComponent({ name: 'ElSelect' }).props('disabled')).toBe(true)
    const category = field('商品分类').getComponent({ name: 'ElTreeSelect' })
    category.vm.$emit('update:modelValue', 2)
    category.vm.$emit('change', 2)
    await flushPromises()
    expect(getPayrollProducts).toHaveBeenCalledWith('', 2)
    const sku = field('规格型号').getComponent({ name: 'ElSelect' })
    sku.vm.$emit('update:modelValue', '600')
    sku.vm.$emit('change', '600')
    await field('规则名称').get('input').setValue('A600 销售提成')
    field('适用部门').getComponent({ name: 'ElTreeSelect' }).vm.$emit('update:modelValue', [1])
    field('计算方式')
      .getComponent({ name: 'CostDictSelect' })
      .vm.$emit('update:modelValue', 'QUANTITY')
    field('提成标准').getComponent({ name: 'ElInputNumber' }).vm.$emit('update:modelValue', 25)
    field('受益角色')
      .getComponent({ name: 'CostDictSelect' })
      .vm.$emit('update:modelValue', 'CITY_MANAGER')
    field('生效日期')
      .getComponent({ name: 'ElDatePicker' })
      .vm.$emit('update:modelValue', '2026-10-01')
    await flushPromises()
    expect(field('提成标准').text()).toContain('元 / 套')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === '保存')!
      .trigger('click')
    await flushPromises()
    expect(savePayrollRule).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        categoryId: 2,
        categoryName: '台呢',
        productVariantId: '600',
        unitCode: 'SET',
        rate: 25,
        recipientRoleCode: 'CITY_MANAGER',
        groupCode: null,
        effectiveFrom: '2026-10-01',
      }),
    )
  })
  it('未选择型号时提示单位来源，按比例时只显示百分号', async () => {
    await openCommission()
    const method = field('计算方式').getComponent({ name: 'CostDictSelect' })
    method.vm.$emit('update:modelValue', 'QUANTITY')
    await flushPromises()
    expect(field('提成标准').text()).toContain('请先选择规格型号，自动带出计量单位')
    expect(field('提成标准').text()).not.toContain('/ —')
    expect(field('提成标准').getComponent({ name: 'ElInputNumber' }).props('disabled')).toBe(true)
    method.vm.$emit('update:modelValue', 'PERCENT')
    await flushPromises()
    expect(field('提成标准').get('.commission-rate__unit').text()).toBe('%')
    expect(field('提成标准').text()).not.toContain('计量单位')
    expect(field('提成标准').getComponent({ name: 'ElInputNumber' }).props('disabled')).toBe(false)
  })
  it('更换分类会清空上一分类型号并拒绝提交残留数据', async () => {
    await openCommission()
    const category = field('商品分类').getComponent({ name: 'ElTreeSelect' })
    category.vm.$emit('update:modelValue', 2)
    category.vm.$emit('change', 2)
    await flushPromises()
    const sku = field('规格型号').getComponent({ name: 'ElSelect' })
    sku.vm.$emit('update:modelValue', '600')
    sku.vm.$emit('change', '600')
    await flushPromises()
    category.vm.$emit('update:modelValue', 3)
    category.vm.$emit('change', 3)
    await flushPromises()
    expect(sku.props('modelValue')).toBeNull()
    field('计算方式')
      .getComponent({ name: 'CostDictSelect' })
      .vm.$emit('update:modelValue', 'QUANTITY')
    await flushPromises()
    expect(field('提成标准').text()).not.toContain('元 / 套')
    expect(getPayrollProducts).toHaveBeenLastCalledWith('', 3)
    await field('规则名称').get('input').setValue('另一分类')
    field('适用部门').getComponent({ name: 'ElTreeSelect' }).vm.$emit('update:modelValue', [1])
    field('生效日期')
      .getComponent({ name: 'ElDatePicker' })
      .vm.$emit('update:modelValue', '2026-10-01')
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === '保存')!
      .trigger('click')
    await flushPromises()
    expect(savePayrollRule).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('请选择商品分类、规格型号并填写提成标准')
  })
  it('商品提成列表保留编辑且没有复制操作', async () => {
    vi.mocked(getPayrollRules).mockResolvedValue({
      total: 1,
      begin: 0,
      step: 20,
      items: [
        {
          id: 'R',
          revision: 1,
          updatedTime: '2026-10-01T00:00:00Z',
          data: {
            name: 'A600',
            kindCode: 'COMMISSION',
            departmentIds: [1],
            categoryId: 2,
            categoryName: '台呢',
            productName: '澳洋 A600',
            productId: '1',
            productVariantId: '600',
            rate: 25,
            methodCode: 'QUANTITY',
            unitCode: 'SET',
            recipientRoleCode: 'SALES',
            effectiveFrom: '2026-10-01',
            effectiveTo: '9999-12-31',
            enabled: true,
          },
        } as never,
      ],
    })
    state.route.path = '/supply-chain/hr/commission-rules'
    wrapper = mount(Rules, {
      global: { plugins: [ElementPlus], stubs: { ElDialog: Dialog, SupplyPageTitle: true } },
    })
    await flushPromises()
    expect(wrapper.findAll('button').some((b) => b.text() === '编辑')).toBe(true)
    expect(wrapper.findAll('button').some((b) => b.text() === '复制')).toBe(false)
    await wrapper
      .findAll('button')
      .find((b) => b.text() === '编辑')!
      .trigger('click')
    await flushPromises()
    expect(getPayrollProducts).toHaveBeenCalledWith('', null, '600')
    expect(field('商品分类').getComponent({ name: 'ElTreeSelect' }).props('modelValue')).toBe(2)
    expect(field('规格型号').text()).toContain('澳洋华彩 · A600 · SKU600 · 套')
    expect(field('规格型号').text()).not.toContain('600 · 600')
    expect(field('提成标准').getComponent({ name: 'ElInputNumber' }).props('modelValue')).toBe(25)
  })
})

async function openManagers(items: PayrollRule[] = []) {
  vi.mocked(getPayrollEmployees).mockResolvedValue([
    { employeeCode: 'M1', employeeName: '测试城市总', payrollCategory: 'SALES' } as never,
  ])
  vi.mocked(getCostCities).mockResolvedValue([
    { code: 'C1', name: '测试城市' },
    { code: 'C2', name: '第二城市' },
  ])
  vi.mocked(getPayrollRules).mockResolvedValue({ total: items.length, begin: 0, step: 20, items })
  state.route.path = '/supply-chain/hr/commission-rules'
  wrapper = mount(Rules, {
    global: { plugins: [ElementPlus], stubs: { ElDialog: Dialog, SupplyPageTitle: true } },
  })
  await flushPromises()
  wrapper.getComponent({ name: 'ElTabs' }).vm.$emit('update:modelValue', 'CITY_MANAGER')
  await flushPromises()
}
const clickRuleButton = async (text: string) => {
  await wrapper
    .findAll('button')
    .find((b) => b.text() === text)!
    .trigger('click')
  await flushPromises()
}
const managerRule = (end = '9999-12-31'): PayrollRule => ({
  id: 'M-RULE',
  revision: 3,
  updatedTime: '',
  data: {
    name: '旧管辖名称',
    requestId: 'original-request',
    revision: 3,
    kindCode: 'CITY_MANAGER',
    departmentIds: [],
    employeeCode: 'M1',
    cityCode: 'C1',
    cityName: '测试城市',
    effectiveFrom: '2026-09-01',
    effectiveTo: end,
    enabled: true,
    includeOwnSalesCommission: true,
    productId: null,
    productVariantId: null,
    productName: null,
    unitCode: null,
    groupCode: null,
    recipientRoleCode: null,
    methodCode: null,
    rate: null,
    amount: null,
    performancePolicy: null,
    remark: '原任期',
  },
})
describe('城市总完整提成配置', () => {
  const chooseBasics = async () => {
    field('城市总').getComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', 'M1')
    field('管辖城市').getComponent({ name: 'ElSelect' }).vm.$emit('update:modelValue', ['C1', 'C2'])
    field('生效日期')
      .getComponent({ name: 'ElDatePicker' })
      .vm.$emit('update:modelValue', '2026-10-01')
    await flushPromises()
  }
  const independentMode = async (mode: string) => {
    wrapper
      .findAllComponents({ name: 'ElRadioGroup' })
      .find((r) => r.attributes('aria-label') === '独立商品提成方式')!
      .vm.$emit('update:modelValue', mode)
    await flushPromises()
  }
  it('一次保存多个城市，比例和本人提成随各城市提交，不改写其他记录', async () => {
    const original = managerRule()
    await openManagers([original])
    await clickRuleButton('增加管辖城市')
    expect(field('城市总').getComponent({ name: 'ElSelect' }).props('modelValue')).toBe('M1')
    await chooseBasics()
    field('团队销售提成计入比例')
      .getComponent({ name: 'ElInputNumber' })
      .vm.$emit('update:modelValue', 50)
    field('本人销售提成')
      .getComponent({ name: 'ElRadioGroup' })
      .vm.$emit('update:modelValue', false)
    await independentMode('NONE')
    await clickRuleButton('保存配置')
    const [commands] = vi.mocked(createCityManagerRules).mock.calls[0]!
    expect(commands).toHaveLength(2)
    expect(commands.map((c) => c.cityCode)).toEqual(['C1', 'C2'])
    expect(new Set(commands.map((c) => c.requestId)).size).toBe(2)
    commands.forEach((c) =>
      expect(c).toMatchObject({
        employeeCode: 'M1',
        revision: null,
        includeOwnSalesCommission: false,
        effectiveTo: '9999-12-31',
        cityCommission: { teamPercent: 50, products: [] },
      }),
    )
    expect(savePayrollRule).not.toHaveBeenCalled()
    expect(original.data.cityCode).toBe('C1')
  })
  it('本人提成必须明确选择，单独设置不能空标准误当零提成', async () => {
    await openManagers()
    await clickRuleButton('新增城市总提成')
    await chooseBasics()
    await clickRuleButton('保存配置')
    expect(createCityManagerRules).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('请选择本人销售是否另计提成')
    field('本人销售提成')
      .getComponent({ name: 'ElRadioGroup' })
      .vm.$emit('update:modelValue', false)
    await flushPromises()
    await clickRuleButton('保存配置')
    expect(wrapper.text()).toContain('请添加独立商品标准')
    expect(createCityManagerRules).not.toHaveBeenCalled()
  })
  it('旧配置保留100%与部门商品标准，编辑截止日期携带原版本和城市', async () => {
    await openManagers([managerRule()])
    await clickRuleButton('编辑')
    expect(field('管辖城市').getComponent({ name: 'ElSelect' }).props('disabled')).toBe(true)
    expect(
      field('团队销售提成计入比例').getComponent({ name: 'ElInputNumber' }).props('modelValue'),
    ).toBe(100)
    field('截止日期')
      .getComponent({ name: 'ElDatePicker' })
      .vm.$emit('update:modelValue', '2026-08-31')
    await flushPromises()
    await clickRuleButton('保存配置')
    expect(wrapper.text()).toContain('截止日期不能早于生效日期')
    field('截止日期')
      .getComponent({ name: 'ElDatePicker' })
      .vm.$emit('update:modelValue', '2026-09-30')
    await flushPromises()
    await clickRuleButton('保存配置')
    expect(savePayrollRule).toHaveBeenCalledWith(
      'M-RULE',
      expect.objectContaining({
        revision: 3,
        employeeCode: 'M1',
        cityCode: 'C1',
        enabled: true,
        effectiveFrom: '2026-09-01',
        effectiveTo: '2026-09-30',
        cityCommission: { teamPercent: 100, products: null },
      }),
    )
  })
  it('商品子表配置真实型号并随主配置保存', async () => {
    await openManagers()
    await clickRuleButton('新增城市总提成')
    await chooseBasics()
    field('本人销售提成').getComponent({ name: 'ElRadioGroup' }).vm.$emit('update:modelValue', true)
    await clickRuleButton('添加商品')
    const productField = (name: string) =>
      wrapper
        .findAll('[role="dialog"]')[1]!
        .findAll('.el-form-item')
        .find((f) => f.find('label').text() === name)!
    const category = productField('商品分类').getComponent({ name: 'ElTreeSelect' })
    category.vm.$emit('update:modelValue', 2)
    category.vm.$emit('change', 2)
    await flushPromises()
    const sku = productField('规格型号').getComponent({ name: 'ElSelect' })
    sku.vm.$emit('update:modelValue', '600')
    sku.vm.$emit('change', '600')
    productField('提成标准')
      .getComponent({ name: 'ElInputNumber' })
      .vm.$emit('update:modelValue', 25)
    await flushPromises()
    await clickRuleButton('确定')
    expect(savePayrollRule).not.toHaveBeenCalled()
    await clickRuleButton('保存配置')
    expect(createCityManagerRules).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          cityCommission: {
            teamPercent: 100,
            products: [
              expect.objectContaining({
                productId: '1',
                productVariantId: '600',
                categoryId: 2,
                unitCode: 'SET',
                methodCode: 'QUANTITY',
                rate: 25,
              }),
            ],
          },
        }),
      ]),
    )
  })
  it('批量保存失败保留表单，原内容重试沿用请求编号', async () => {
    vi.mocked(createCityManagerRules)
      .mockRejectedValueOnce(new Error('测试城市任期冲突'))
      .mockResolvedValueOnce([])
    await openManagers()
    await clickRuleButton('新增城市总提成')
    await chooseBasics()
    field('本人销售提成')
      .getComponent({ name: 'ElRadioGroup' })
      .vm.$emit('update:modelValue', false)
    await independentMode('NONE')
    await clickRuleButton('保存配置')
    expect(wrapper.text()).toContain('测试城市任期冲突')
    const first = vi.mocked(createCityManagerRules).mock.calls[0]![0]
    await clickRuleButton('保存配置')
    expect(vi.mocked(createCityManagerRules).mock.calls[1]![0]).toEqual(first)
  })
})
