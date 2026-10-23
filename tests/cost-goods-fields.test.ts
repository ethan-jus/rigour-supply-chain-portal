import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import ElementPlus from 'element-plus'
import GoodsFields from '@/views/supply-chain/cost/CostGoodsFields.vue'
import ReferenceSelect from '@/views/supply-chain/cost/CostReferenceSelect.vue'
import EntryMode from '@/views/supply-chain/cost/CostEntryMode.vue'
import { costSnapshotFields } from '@/views/supply-chain/cost/cost-audit'
import { buildCostWorkbook } from '@/views/supply-chain/cost/cost-export'
import {
  getCostReferences,
  getCostPurchaseOrders,
  type CostGoods,
  type CostSource,
} from '@/api/core/cost'
import {
  clearBusinessDictionariesForTest,
  seedBusinessDictionaryForTest,
} from '@/utils/business-dictionary'

vi.mock('@/api/core/cost', () => ({
  getCostReferences: vi.fn(),
  getCostPurchaseOrders: vi.fn().mockResolvedValue([]),
  getCostWarehouses: vi.fn().mockResolvedValue([]),
}))
const wrappers: VueWrapper[] = []
beforeEach(() => {
  vi.mocked(getCostReferences).mockResolvedValue([])
  seedBusinessDictionaryForTest('', 'PRODUCT_UNIT', [
    { code: 'BUCKET', name: '桶' },
    { code: 'BOX', name: '箱' },
  ])
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  clearBusinessDictionariesForTest()
  vi.clearAllMocks()
})
function mountGoods(category: 'purchases' | 'losses', overrides: Partial<CostGoods> = {}) {
  const goods = reactive<CostGoods>({
    productId: '1',
    variantId: null,
    productName: '测试商品',
    specification: '12桶/箱',
    unit: 'BOX',
    unitPrice: 10,
    quantity: 1,
    supplierId: null,
    supplierName: '',
    warehouseId: null,
    location: '',
    purchaseOrderId: null,
    lossReason: '',
    amountReason: '',
    ...overrides,
  })
  const wrapper = mount(GoodsFields, {
    props: { category, modelValue: goods },
    global: { plugins: [ElementPlus] },
  })
  wrappers.push(wrapper)
  return { wrapper, goods }
}
function field(wrapper: VueWrapper, label: string) {
  return wrapper
    .findAllComponents({ name: 'ElFormItem' })
    .find((item) => item.props('label') === label)!
}

describe('cost goods linked specifications and dictionary units', () => {
  it('updates a new calculated amount using decimal rounding and keeps an incomplete quantity unknown', async () => {
    const { wrapper, goods } = mountGoods('purchases')
    goods.unitPrice = 1.005
    goods.quantity = 3
    await flushPromises()
    expect(wrapper.emitted('update:amount')?.at(-1)).toEqual([3.02])
    goods.quantity = null
    await flushPromises()
    expect(wrapper.emitted('update:amount')?.at(-1)).toEqual([null])
  })
  it('preserves historical actual amounts until the operator explicitly chooses recalculation', async () => {
    const { wrapper, goods } = mountGoods('purchases')
    // 模拟带入已有实际金额的独立编辑器。
    const persisted = mount(GoodsFields, {
      props: { category: 'purchases', modelValue: goods, persisted: true, amount: 9 },
      global: { plugins: [ElementPlus] },
    })
    wrappers.push(persisted)
    goods.quantity = 2
    await flushPromises()
    expect(persisted.emitted('update:amount')).toBeUndefined()
    field(persisted, '金额填写方式')
      .getComponent({ name: 'ElRadioGroup' })
      .vm.$emit('update:modelValue', 'CALCULATED')
    await flushPromises()
    expect(persisted.emitted('update:amount')?.at(-1)).toEqual([20])
    wrapper.unmount()
  })
  it('uses one supplier field, restores each entry mode and never submits a manual name with a linked ID', async () => {
    const { wrapper, goods } = mountGoods('purchases', { supplierName: '手填供应商' })
    const supplier = field(wrapper, '供应商')
    const mode = supplier.getComponent(EntryMode)
    expect(mode.props('modelValue')).toBe('MANUAL')
    expect(wrapper.text()).not.toContain('关联供应商')
    expect(supplier.findComponent(ReferenceSelect).exists()).toBe(false)
    expect(supplier.getComponent({ name: 'ElInput' }).get('input').element.value).toBe('手填供应商')

    mode.vm.$emit('update:modelValue', 'LINKED')
    await flushPromises()
    expect(goods).toMatchObject({ supplierId: null, supplierName: '' })
    const selector = supplier.getComponent(ReferenceSelect)
    selector.vm.$emit('update:modelValue', 'S1')
    selector.vm.$emit('change', { id: 'S1', name: '系统供应商' })
    await flushPromises()
    expect(goods).toMatchObject({ supplierId: 'S1', supplierName: '系统供应商' })

    mode.vm.$emit('update:modelValue', 'MANUAL')
    await flushPromises()
    expect(goods).toMatchObject({ supplierId: null, supplierName: '手填供应商' })
    await supplier.getComponent({ name: 'ElInput' }).get('input').setValue('实际供应商')
    mode.vm.$emit('update:modelValue', 'LINKED')
    await flushPromises()
    expect(goods).toMatchObject({ supplierId: 'S1', supplierName: '系统供应商' })
    supplier.getComponent(ReferenceSelect).vm.$emit('update:modelValue', null)
    supplier.getComponent(ReferenceSelect).vm.$emit('change', null)
    await flushPromises()
    expect(goods).toMatchObject({ supplierId: null, supplierName: '' })
    mode.vm.$emit('update:modelValue', 'MANUAL')
    await flushPromises()
    expect(goods).toMatchObject({ supplierId: null, supplierName: '实际供应商' })
  })

  it.each(['purchases', 'losses'] as const)(
    '%s restores SKU and dictionary unit after manual entry, then resets both drafts for the next record',
    async (category) => {
      const { wrapper, goods } = mountGoods(category, { variantId: '2', specification: 'H' })
      const mode = field(wrapper, '商品').getComponent(EntryMode)
      mode.vm.$emit('update:modelValue', 'MANUAL')
      await flushPromises()
      expect(goods).toMatchObject({
        productId: null,
        variantId: null,
        productName: '测试商品',
        specification: 'H',
        unit: 'BOX',
      })
      await field(wrapper, '商品')
        .getComponent({ name: 'ElInput' })
        .get('input')
        .setValue('手填商品')
      await field(wrapper, '规格').get('input').setValue('手填规格')
      field(wrapper, '单位')
        .getComponent({ name: 'ElSelect' })
        .vm.$emit('update:modelValue', 'BUCKET')
      mode.vm.$emit('update:modelValue', 'LINKED')
      await flushPromises()
      expect(goods).toMatchObject({
        productId: '1',
        variantId: '2',
        productName: '测试商品',
        specification: 'H',
        unit: 'BOX',
      })
      mode.vm.$emit('update:modelValue', 'MANUAL')
      await flushPromises()
      expect(goods).toMatchObject({
        productId: null,
        variantId: null,
        productName: '手填商品',
        specification: '手填规格',
        unit: 'BUCKET',
      })

      const next = reactive({
        ...goods,
        productId: '9',
        variantId: '90',
        productName: '下一条商品',
        specification: 'M',
        unit: 'BOX',
      })
      await wrapper.setProps({ modelValue: next })
      expect(mode.props('modelValue')).toBe('LINKED')
      mode.vm.$emit('update:modelValue', 'MANUAL')
      await flushPromises()
      expect(next).toMatchObject({
        productId: null,
        variantId: null,
        productName: '下一条商品',
        specification: 'M',
        unit: 'BOX',
      })
    },
  )

  it('defaults a blank record to existing references and offers manual entry only after a successful empty lookup', async () => {
    const { wrapper } = mountGoods('purchases', {
      productId: null,
      productName: '',
      specification: '',
      unit: '',
    })
    expect(field(wrapper, '商品').getComponent(EntryMode).props('modelValue')).toBe('LINKED')
    const supplier = field(wrapper, '供应商')
    const selector = supplier.getComponent(ReferenceSelect)
    const select = selector.getComponent({ name: 'ElSelect' })
    vi.mocked(getCostReferences).mockRejectedValueOnce(new Error('供应商服务暂不可用'))
    select.vm.$emit('visible-change', true)
    await flushPromises()
    expect(selector.text()).toContain('供应商服务暂不可用')
    expect(document.body.textContent).not.toContain('未找到供应商，手动填写')
    expect(supplier.getComponent(EntryMode).props('modelValue')).toBe('LINKED')
    await selector.get('.reference-error button').trigger('click')
    await flushPromises()
    expect(selector.find('.reference-error').exists()).toBe(false)
    const manual = [...document.body.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('未找到供应商，手动填写'),
    )!
    expect(manual).toBeDefined()
    manual.click()
    await flushPromises()
    expect(supplier.getComponent(EntryMode).props('modelValue')).toBe('MANUAL')
  })

  it.each(['', '已手填供应商'])(
    'fills the purchase-order supplier without overwriting a cached manual name: %s',
    async (supplierName) => {
      const { wrapper, goods } = mountGoods('purchases', { supplierName })
      const expectedSupplier = supplierName || '采购单供应商'
      field(wrapper, '供应商').getComponent(EntryMode).vm.$emit('update:modelValue', 'LINKED')
      await flushPromises()
      vi.mocked(getCostPurchaseOrders).mockResolvedValue([
        {
          id: 'P1',
          documentNo: 'PO1',
          senderName: '采购单供应商',
          receiverName: '中心仓',
          cityCode: 'C1',
        },
      ] as CostSource[])
      const order = field(wrapper, '关联采购单')
      // 展开来源并选择系统单据后，原有采购单回填仍需可见。
      expect(order).toBeUndefined()
      wrapper
        .findAllComponents({ name: 'ElRadioGroup' })
        .find((group) => group.props('modelValue') === 'NONE')!
        .vm.$emit('update:modelValue', 'LINKED')
      await flushPromises()
      const selector = field(wrapper, '关联采购单').getComponent({ name: 'ElSelect' })
      selector.vm.$emit('visible-change', true)
      await flushPromises()
      selector.vm.$emit('update:modelValue', 'P1')
      selector.vm.$emit('change', 'P1')
      await flushPromises()
      expect(goods).toMatchObject({ supplierId: null, supplierName: expectedSupplier })
      expect(field(wrapper, '供应商').getComponent(EntryMode).props('modelValue')).toBe('MANUAL')
      expect(
        field(wrapper, '供应商').getComponent({ name: 'ElInput' }).get('input').element.value,
      ).toBe(expectedSupplier)
    },
  )

  it.each(['purchases', 'losses'] as const)(
    '%s carries an empty SKU specification and displays its unit name without changing the saved code',
    async (category) => {
      vi.mocked(getCostReferences).mockResolvedValue([
        { id: '2', code: 'SKU2', name: '测试商品', productId: '1', unit: 'BUCKET' },
      ])
      const { wrapper, goods } = mountGoods(category, {
        variantId: '2',
        specification: null as unknown as string,
      })
      const select = field(wrapper, '规格').getComponent({ name: 'ElSelect' })
      select.vm.$emit('visible-change', true)
      await flushPromises()
      select.vm.$emit('update:modelValue', '2')
      select.vm.$emit('change', '2')
      await flushPromises()
      expect(goods).toMatchObject({ variantId: '2', specification: '', unit: 'BUCKET' })
      expect(field(wrapper, '规格').text()).toContain('主档未填写规格名称，可正常保存')
      expect(select.findAllComponents({ name: 'ElOption' })[0]!.props('label')).toBe(
        '未维护规格 · 桶',
      )
      expect(field(wrapper, '单位').get('input').element.value).toBe('桶')

      // 名称取自当前字典配置，不是对 BUCKET 的硬编码翻译。
      seedBusinessDictionaryForTest('', 'PRODUCT_UNIT', [{ code: 'BUCKET', name: '包装桶' }])
      await flushPromises()
      expect(field(wrapper, '单位').get('input').element.value).toBe('包装桶')
      expect(goods.unit).toBe('BUCKET')
    },
  )

  it('keeps linked product specifications selectable and clears stale fields when the choice is cleared', async () => {
    const { wrapper, goods } = mountGoods('purchases', { variantId: '2', unit: 'BUCKET' })
    const selector = field(wrapper, '规格').getComponent(ReferenceSelect)
    selector.vm.$emit('update:modelValue', null)
    selector.vm.$emit('change', null)
    await flushPromises()
    expect(goods).toMatchObject({ specification: '', unit: '', variantId: null })
    expect(field(wrapper, '规格').findComponent(ReferenceSelect).exists()).toBe(true)
    expect(field(wrapper, '单位').get('input').attributes('disabled')).toBeDefined()
    expect(field(wrapper, '规格').text()).toContain('请先选择规格')

    const product = field(wrapper, '商品').getComponent(ReferenceSelect)
    product.vm.$emit('update:modelValue', null)
    product.vm.$emit('change', null)
    await flushPromises()
    expect(field(wrapper, '规格').getComponent({ name: 'ElSelect' }).props('disabled')).toBe(true)
    field(wrapper, '商品').getComponent(EntryMode).vm.$emit('update:modelValue', 'MANUAL')
    await flushPromises()
    await field(wrapper, '规格').get('input').setValue('手填规格')
    const unit = field(wrapper, '单位').getComponent({ name: 'ElSelect' })
    expect(
      unit.findAllComponents({ name: 'ElOption' }).map((option) => option.props('label')),
    ).toEqual(['桶', '箱'])
    unit.vm.$emit('update:modelValue', 'BOX')
    await flushPromises()
    expect(goods).toMatchObject({ productId: null, specification: '手填规格', unit: 'BOX' })
  })

  it('selects H directly in the specification dropdown and replaces all SKU fields when switching', async () => {
    vi.mocked(getCostReferences).mockResolvedValue([
      { id: '10', code: 'SKU-H', name: '皮头', productId: '1', specification: 'H', unit: 'BUCKET' },
      { id: '11', code: 'SKU-M', name: '皮头', productId: '1', specification: 'M', unit: 'BOX' },
    ])
    const { wrapper, goods } = mountGoods('purchases')
    expect(wrapper.text()).not.toContain('关联 SKU')
    const select = field(wrapper, '规格').getComponent({ name: 'ElSelect' })
    select.vm.$emit('visible-change', true)
    await flushPromises()
    expect(getCostReferences).toHaveBeenLastCalledWith('purchases', 'variants', '', '1', 0)
    expect(
      select.findAllComponents({ name: 'ElOption' }).map((option) => option.props('label')),
    ).toEqual(['H · 桶', 'M · 箱'])
    for (const [id, specification, unit] of [
      ['10', 'H', 'BUCKET'],
      ['11', 'M', 'BOX'],
    ]) {
      select.vm.$emit('update:modelValue', id)
      select.vm.$emit('change', id)
      await flushPromises()
      expect(goods).toMatchObject({ variantId: id, specification, unit })
    }
  })

  it('replaces the previous SKU snapshot when changing product', async () => {
    const { wrapper, goods } = mountGoods('purchases', { variantId: '2', unit: 'BUCKET' })
    const selector = field(wrapper, '商品').getComponent(ReferenceSelect)
    selector.vm.$emit('update:modelValue', '3')
    selector.vm.$emit('change', { id: '3', name: '新商品', specification: '6盒/箱', unit: 'BOX' })
    await flushPromises()
    expect(goods).toMatchObject({
      productId: '3',
      variantId: null,
      productName: '新商品',
      specification: '',
      unit: '',
    })
  })

  it('matches a numeric saved SKU ID to string reference IDs without a duplicate incomplete option', async () => {
    vi.mocked(getCostReferences).mockResolvedValue([
      { id: '30', code: 'SKU-H', name: '皮头', specification: 'H', unit: 'BUCKET' },
    ])
    // 实际业务 DTO 使用 Long，引用 DTO 使用字符串；模拟接口运行时的类型差异。
    const { wrapper, goods } = mountGoods('purchases', {
      variantId: 30 as unknown as string,
      specification: 'H',
      unit: 'BUCKET',
    })
    const select = field(wrapper, '规格').getComponent({ name: 'ElSelect' })
    select.vm.$emit('visible-change', true)
    await flushPromises()
    const options = select.findAllComponents({ name: 'ElOption' })
    expect(options.map((option) => option.props('label'))).toEqual(['H · 桶'])
    expect(select.props('modelValue')).toBe('30')
    select.vm.$emit('update:modelValue', '30')
    select.vm.$emit('change', '30')
    await flushPromises()
    expect(goods).toMatchObject({ variantId: '30', specification: 'H', unit: 'BUCKET' })
  })

  it('preserves a historical manual unit as a readback option without making it a new dictionary choice', () => {
    const { wrapper, goods } = mountGoods('purchases', { productId: null, unit: '旧包装单位' })
    const selected = field(wrapper, '单位')
      .findAllComponents({ name: 'ElOption' })
      .find((option) => option.props('value') === '旧包装单位')!
    expect(selected.props()).toMatchObject({ label: '旧包装单位', disabled: true })
    expect(goods.unit).toBe('旧包装单位')
  })

  it('uses the dictionary name in detail, audit and Excel while preserving historical source text', async () => {
    const fields = costSnapshotFields({ data: { goods: { unit: 'BUCKET' } }, sources: [] })
    expect(fields).toContainEqual({ label: '单位', value: '桶' })
    const workbook = await buildCostWorkbook(
      '进货记录',
      fields.map((f) => f.label),
      [fields.map((f) => f.value)],
    )
    const column = fields.findIndex((f) => f.label === '单位') + 1
    expect(workbook.worksheets[0]!.getCell(2, column).value).toBe('桶')
    expect(
      costSnapshotFields({ data: { goods: { unit: '旧包装单位' } }, sources: [] }),
    ).toContainEqual({ label: '单位', value: '旧包装单位' })
  })
})
