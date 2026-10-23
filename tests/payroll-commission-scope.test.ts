import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import ElementPlus from 'element-plus'
import Editor from '@/views/supply-chain/hr/components/PayrollSchemeCommissionEditor.vue'
import { newPayrollScheme } from '@/utils/payroll-scheme'
import { flattenCommissionRows, newCommissionRow } from '@/utils/payroll-commission-rows'
import type { PayrollSchemeDefinition } from '@/api/core/payroll-scheme/models/PayrollSchemeDefinition'

vi.mock('@/utils/payroll-dictionaries', () => ({
  loadPayrollProductUnits: vi.fn().mockResolvedValue(undefined),
  payrollUnitName: (code: string) => code,
}))
vi.mock('@/api/core/payroll', () => ({ getPayrollProducts: vi.fn().mockResolvedValue([]) }))
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
let page: VueWrapper
let form: PayrollSchemeDefinition
afterEach(() => {
  page?.unmount()
  document.body.innerHTML = ''
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
