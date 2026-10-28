import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import ElementPlus from 'element-plus'
import Editor from '@/views/supply-chain/hr/components/PayrollSchemeCommissionEditor.vue'
import { newPayrollScheme } from '@/utils/payroll-scheme'
import { getPayrollProducts } from '@/api/core/payroll'
import { flattenCommissionRows, newCommissionRow } from '@/utils/payroll-commission-rows'
import type { PayrollSchemeDefinition } from '@/api/core/payroll-scheme/models/PayrollSchemeDefinition'

vi.mock('@/utils/payroll-dictionaries', () => ({
  loadPayrollProductUnits: vi.fn().mockResolvedValue(undefined),
  payrollUnitName: (code: string) => code,
}))
vi.mock('@/api/core/payroll', () => ({ getPayrollProducts: vi.fn().mockResolvedValue([]) }))
vi.mock('@/utils/business-dictionary', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/business-dictionary')>()),
  businessDictionaryOptions: () => [
    { value: 'SET', label: '套' },
    { value: 'BED', label: '床' },
  ],
}))
const Dialog = defineComponent({
  props: ['modelValue'],
  setup:
    (props, { slots }) =>
    () =>
      props.modelValue ? h('div', { role: 'dialog' }, [slots.default?.(), slots.footer?.()]) : null,
})
const categories = [
  { id: 1, parentId: null, name: '台球周边', sortOrder: 0 },
  { id: 2, parentId: 1, name: '台呢', sortOrder: 0 },
  { id: 3, parentId: 1, name: '皮头', sortOrder: 1 },
  { id: 4, parentId: 3, name: '硬皮头', sortOrder: 0 },
  { id: 5, parentId: 3, name: '软皮头', sortOrder: 1 },
  { id: 6, parentId: null, name: '快销品', sortOrder: 1 },
]
let page: VueWrapper<InstanceType<typeof Editor>>
let form: PayrollSchemeDefinition
afterEach(() => {
  page?.unmount()
  document.body.innerHTML = ''
  vi.mocked(getPayrollProducts).mockResolvedValue([])
})
async function open(included: number[] = [], excluded: number[] = [], disabled = false) {
  form = newPayrollScheme()
  const row = newCommissionRow('台球标准')
  row.sales.categoryIds = included
  row.sales.excludedCategoryIds = excluded
  form.commission.rules = flattenCommissionRows([row])
  page = mount(Editor, {
    attachTo: document.body,
    props: { modelValue: form, categories, disabled },
    global: { plugins: [ElementPlus], stubs: { ElDialog: Dialog } },
  })
  await flushPromises()
  await page
    .findAll('button')
    .find((button) => button.text().includes('商品与排除项'))!
    .trigger('click')
  await flushPromises()
}
const selector = (excluded = false) =>
  page.findAllComponents({ name: 'ElTreeSelect' })[excluded ? 1 : 0]!
const tree = (excluded = false) => selector(excluded).getComponent({ name: 'ElTree' })
async function toggle(id: number, excluded = false) {
  const checkbox = tree(excluded).get<HTMLInputElement>(
    `[data-key="${id}"] > .el-tree-node__content input`,
  )
  await checkbox.setValue(!checkbox.element.checked)
  await flushPromises()
}
function scope(excluded = false) {
  return form.commission.rules.map((rule) =>
    excluded ? rule.excludedCategoryIds : rule.categoryIds,
  )
}

describe('提成商品范围的父子分类联动', () => {
  it('在当前表中添加床单位标准，保留按套金额；相同单位即使金额不同也不重复添加', async () => {
    await open([2])
    await page
      .findAll('button')
      .find((button) => button.text() === '完成')!
      .trigger('click')
    const rateEditors = page.findAllComponents({ name: 'PayrollCommissionRateEditor' })
    for (const editor of rateEditors.slice(0, 2)) {
      const rule = editor.props('modelValue')
      editor.vm.$emit('update:modelValue', {
        ...rule,
        method: 'QUANTITY',
        unitCode: 'SET',
        value: rule.recipientRole === 'SALES' ? 15 : 5,
      })
    }
    await flushPromises()
    await page
      .findAll('button')
      .find((button) => button.text() === '添加单位标准')!
      .trigger('click')
    await flushPromises()
    const dialog = page
      .findAll('[role="dialog"]')
      .find((element) => element.text().includes('另一单位'))!
    const select = page
      .findAllComponents({ name: 'ElSelect' })
      .find((element) => element.props('placeholder') === '请选择单位，如套、床')!
    select.vm.$emit('update:modelValue', 'SET')
    await dialog.get('input[aria-label="新单位销售提成"]').setValue('8')
    await dialog.get('input[aria-label="新单位城市总提成"]').setValue('2')
    await dialog
      .findAll('button')
      .find((button) => button.text() === '添加标准')!
      .trigger('click')
    await flushPromises()
    expect(dialog.text()).toContain('商品范围和计提单位重复')
    expect(form.commission.rules).toHaveLength(2)
    select.vm.$emit('update:modelValue', 'BED')
    await dialog
      .findAll('button')
      .find((button) => button.text() === '添加标准')!
      .trigger('click')
    await flushPromises()
    expect(form.commission.rules).toHaveLength(4)
    expect(
      form.commission.rules.map((rule) => [
        rule.recipientRole,
        rule.unitCode,
        rule.value,
        rule.categoryIds,
      ]),
    ).toEqual([
      ['SALES', 'SET', 15, [2]],
      ['CITY_MANAGER', 'SET', 5, [2]],
      ['SALES', 'BED', 8, [2]],
      ['CITY_MANAGER', 'BED', 2, [2]],
    ])
    expect(new Set(form.commission.rules.map((rule) => rule.code)).size).toBe(4)
    expect(page.vm.validate()).toBeNull()
    expect(
      page.findAll('.el-table__body tbody tr')[0]!.findAll('td')[1]!.attributes('rowspan'),
    ).toBe('2')
    await page
      .findAll('button')
      .find((button) => button.text().includes('商品与排除项'))!
      .trigger('click')
    await flushPromises()
    const nameField = page
      .findAll('.el-form-item')
      .find((item) => item.find('label').text() === '标准名称')!
    await nameField.get('input').setValue('调整后的台呢标准')
    await flushPromises()
    expect(form.commission.rules.map((rule) => rule.name)).toEqual(
      Array(4).fill('调整后的台呢标准'),
    )
    const models = page
      .findAll('.el-form-item')
      .find((item) => item.find('label').text() === '指定商品型号／规格')!
      .getComponent({ name: 'ElSelect' })
    models.vm.$emit('update:modelValue', ['15'])
    models.vm.$emit('change', ['15'])
    await flushPromises()
    expect(form.commission.rules.map((rule) => rule.variantIds)).toEqual(Array(4).fill(['15']))
    await page
      .findAll('button')
      .find((button) => button.text() === '完成')!
      .trigger('click')
    await flushPromises()
    await page
      .findAll('button')
      .filter((button) => button.text() === '移除')[1]!
      .trigger('click')
    await flushPromises()
    expect(form.commission.rules.map((rule) => [rule.unitCode, rule.value])).toEqual([
      ['SET', 15],
      ['SET', 5],
    ])
  })
  it('主动选择分类时分批选中全部型号，搜索不改变已选范围，清空型号后不退回整分类计提', async () => {
    const products = Array.from({ length: 101 }, (_, index) => ({
      productId: String(index + 1),
      productVariantId: String(index + 1),
      productCode: `P${index}`,
      variantCode: `V${index}`,
      productName: '皮头',
      specification: String(index + 1),
      unitCode: 'PIECE',
      categoryId: 3,
      categoryName: '皮头',
    }))
    vi.mocked(getPayrollProducts).mockImplementation(
      async (_keyword, _category, _variant, begin) =>
        begin == null ? products.slice(0, 1) : products.slice(begin, begin + 100),
    )
    await open()
    await toggle(3)
    expect(form.commission.rules[0]!.variantIds).toHaveLength(101)
    expect(form.commission.rules[1]!.variantIds).toEqual(form.commission.rules[0]!.variantIds)
    expect(getPayrollProducts).toHaveBeenCalledWith('', 3, null, 100)
    const select = page
      .findAll('.el-form-item')
      .find((item) => item.find('label').text() === '指定商品型号／规格')!
      .getComponent({ name: 'ElSelect' })
    select.vm.$emit('update:modelValue', ['1'])
    select.vm.$emit('change', ['1'])
    await flushPromises()
    await select.props('remoteMethod')('皮头')
    await flushPromises()
    expect(form.commission.rules[0]!.variantIds).toEqual(['1'])
    select.vm.$emit('update:modelValue', [])
    select.vm.$emit('change', [])
    await flushPromises()
    expect(scope()).toEqual([[], []])
    expect(form.commission.rules[0]!.variantIds).toEqual([])
    expect(page.vm.validate()).toContain('至少选择')
  })

  it('分类排除项同步过滤自动选中的型号，较早请求不能覆盖新分类的选择', async () => {
    let finish!: (products: Awaited<ReturnType<typeof getPayrollProducts>>) => void
    const product = (id: string, categoryId: number) => ({
      productId: id,
      productVariantId: id,
      productCode: id,
      variantCode: id,
      productName: '商品',
      specification: id,
      unitCode: 'SET',
      categoryId,
      categoryName: '分类',
    })
    vi.mocked(getPayrollProducts).mockImplementation(
      async (_keyword, category, _variant, begin) => {
        if (begin == null) return []
        if (category === 2)
          return new Promise((resolve) => {
            finish = resolve
          })
        return [product('3', 3), product('2', 2)]
      },
    )
    await open()
    await toggle(2)
    await toggle(2)
    await toggle(3)
    finish([product('2', 2)])
    await flushPromises()
    expect(form.commission.rules[0]!.variantIds).toEqual(['3'])
  })

  it('分类目录未完整加载时不能完成或保存范围，避免只保存部分型号', async () => {
    vi.mocked(getPayrollProducts).mockImplementation(
      async (_keyword, _category, _variant, begin) => {
        if (begin != null) throw new Error('商品目录暂不可用')
        return []
      },
    )
    await open()
    await toggle(3)
    await page
      .findAll('button')
      .find((button) => button.text() === '完成')!
      .trigger('click')
    await flushPromises()
    expect(page.find('[role="dialog"]').exists()).toBe(true)
    expect(page.vm.validate()).toContain('商品目录暂不可用')
  })
  it('查看数字ID的已保存规则时按ERP目录回显商品规格名称和排除项', async () => {
    vi.mocked(getPayrollProducts).mockImplementation(async (_keyword, _category, id) => [
      {
        productId: '1',
        productVariantId: String(id),
        productCode: 'P',
        variantCode: `V${id}`,
        productName: '澳洋台呢',
        specification: id === '15' ? 'A300' : 'A500',
        unitCode: 'SET',
        categoryId: 2,
        categoryName: '台呢',
      },
    ])
    form = newPayrollScheme()
    const row = newCommissionRow('台呢')
    row.sales.categoryIds = [2]
    row.sales.variantIds = [15 as unknown as string]
    row.sales.excludedVariantIds = [16 as unknown as string]
    form.commission.rules = flattenCommissionRows([row])
    page = mount(Editor, {
      props: { modelValue: form, categories, disabled: true },
      global: { plugins: [ElementPlus], stubs: { ElDialog: Dialog } },
    })
    await flushPromises()
    expect(page.text()).toContain('澳洋台呢 / A300')
    expect(page.text()).not.toContain('规格 15')
    await page
      .findAll('button')
      .find((button) => button.text().includes('商品与排除项'))!
      .trigger('click')
    await flushPromises()
    expect(page.get('.scope-exclusions').text()).toContain('澳洋台呢 / A500')
  })
  it('选父分类勾选全部后代，但保存父分类范围，保留直属商品和分类优先级', async () => {
    await open()
    await toggle(1)
    expect(tree().vm.getCheckedKeys()).toEqual([1, 2, 3, 4, 5])
    expect(scope()).toEqual([[1], [1]])
    expect(tree().vm.getNode(6).checked).toBe(false)
  })

  it('取消子分类后保留父分类并排除子分类，直属商品和匹配优先级不变', async () => {
    await open([1])
    await toggle(2)
    expect(tree().vm.getNode(1).indeterminate).toBe(true)
    expect(tree().vm.getNode(2).checked).toBe(false)
    expect(scope()).toEqual([[1], [1]])
    expect(scope(true)).toEqual([[2], [2]])
    await toggle(1)
    expect(scope()).toEqual([[1], [1]])
    expect(scope(true)).toEqual([[], []])
    await toggle(1)
    expect(scope()).toEqual([[], []])
  })

  it('同一棵树自动维护子类排除，恢复一个孙类后只排除另一个', async () => {
    await open([1])
    await toggle(3)
    expect(scope()).toEqual([[1], [1]])
    expect(scope(true)).toEqual([[3], [3]])
    expect(tree().vm.getCheckedKeys()).toEqual([2])
    await toggle(4)
    expect(scope(true)).toEqual([[5], [5]])
    expect(tree().vm.getNode(3).indeterminate).toBe(true)
    expect(scope()).toEqual([[1], [1]])
  })

  it('已有父分类打开即回显所有子类，查看不会改写原有规则', async () => {
    await open([1], [3], true)
    expect(tree().vm.getCheckedKeys()).toEqual([2])
    expect(tree().vm.getNode(1).indeterminate).toBe(true)
    expect(scope()).toEqual([[1], [1]])
    expect(scope(true)).toEqual([[3], [3]])
    expect(selector().get('.el-select__wrapper').classes()).toContain('is-disabled')
  })

  it('移除父分类标签时同时取消后代勾选', async () => {
    await open([1])
    await selector().get('.el-tag__close').trigger('click')
    await flushPromises()
    expect(scope()).toEqual([[], []])
    expect(tree().vm.getCheckedKeys()).toEqual([])
  })

  it('编辑其他分类不会静默删除暂时缺失的历史分类', async () => {
    await open([99])
    await toggle(1)
    for (const selected of scope()) expect(selected).toEqual(expect.arrayContaining([1, 99]))
    expect(scope().every((selected) => selected.length === 2)).toBe(true)
  })
})
