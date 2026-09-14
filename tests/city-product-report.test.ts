import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ExcelJS from 'exceljs'
import * as excelExport from '@/views/supply-chain/bi/city-product-excel'
import { cityProductColumns } from '@/views/supply-chain/bi/city-product-export'
import type { CityProductReportView } from '@/api/core/bi-city-product-report'
import type { ErpProductCategoryView } from '@/api/core/erp-internal'
import { cityProductReport, reportRow } from './fixtures/city-product-report'
import { seedBusinessDictionaryForTest } from '@/utils/business-dictionary'

const { getReport, erpProducts, erpProduct, erpCategories, erpBrands } = vi.hoisted(() => ({
  getReport: vi.fn(),
  erpProducts: vi.fn(),
  erpProduct: vi.fn(),
  erpCategories: vi.fn(),
  erpBrands: vi.fn(),
}))
vi.mock('@/api/core/bi-city-product-report', () => ({
  getCityProductReport: getReport,
  getCityProductSupply: vi.fn(),
}))
vi.mock('@/api/core/erp-internal', () => ({
  getErpProductCategories: erpCategories,
  getErpProductBrands: erpBrands,
  getErpInventoryWarehouses: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}))
vi.mock('@/api/core/erp-product', () => ({
  getErpManagedProducts: erpProducts,
  getErpManagedProduct: erpProduct,
}))
vi.mock('@/views/supply-chain/bi/components/EchartsChart.vue', () => ({
  default: {
    name: 'EchartsChart',
    props: ['option', 'height'],
    template: '<div class="chart-stub" />',
  },
}))
import CityProductReport from '@/views/supply-chain/bi/components/CityProductReport.vue'

const NativeURL = URL
const query = {
  from: '2026-09-01T00:00:00+08:00',
  to: '2026-09-12T23:59:59.999999+08:00',
  regionCode: 'WH',
  ownerStaffCode: 'E001',
  productCategoryId: 1,
}
const categories = ['方便面', '饮用水'].map((categoryName, index): ErpProductCategoryView => ({
  id: String(index + 1),
  categoryCode: String(index + 1),
  categoryName,
  parentId: null,
  categoryLevel: 1,
  ordinal: index,
  remark: null,
  revision: 1,
  createdBy: null,
  createdTime: '',
  updatedBy: null,
  updatedTime: '',
}))
const stubs = {
  ElDialog: {
    name: 'ElDialog',
    props: ['modelValue', 'width'],
    emits: ['update:modelValue'],
    template: '<div v-if="modelValue"><slot /></div>',
  },
  ElSelect: {
    name: 'ElSelect',
    props: ['modelValue'],
    emits: ['update:modelValue', 'change'],
    template: '<div><slot /></div>',
  },
  ElOption: true,
  ElTreeSelect: {
    name: 'ElSelect',
    props: ['modelValue', 'data', 'checkStrictly'],
    emits: ['update:modelValue', 'change'],
    template: '<div />',
  },
  ElRadioGroup: { template: '<div><slot /></div>' },
  ElRadioButton: true,
  ElDatePicker: {
    name: 'ElDatePicker',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<div />',
  },
  ElPopover: { template: '<div><slot name="reference" /><slot /></div>' },
  ElCheckboxGroup: {
    name: 'ElCheckboxGroup',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<div><slot /></div>',
  },
  ElCheckbox: true,
  ElButton: {
    props: ['disabled', 'loading'],
    emits: ['click'],
    template: '<button :disabled="disabled || loading" @click="$emit(\'click\')"><slot /></button>',
  },
  ElTooltip: { name: 'ElTooltip', props: ['content'], template: '<span><slot /></span>' },
  ElTabs: {
    name: 'ElTabs',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    template: '<div><slot /></div>',
  },
  ElTabPane: true,
  ElAlert: { name: 'ElAlert', props: ['title'], template: '<div class="alert">{{ title }}</div>' },
  ElEmpty: { props: ['description'], template: '<div>{{ description }}</div>' },
  ElSkeleton: { template: '<div>正在查询</div>' },
  ElCollapse: { template: '<div><slot /></div>' },
  ElCollapseItem: { template: '<div><slot /></div>' },
  ElTable: { name: 'ElTable', props: ['data', 'rowKey'], template: '<div><slot /></div>' },
  ElTableColumn: { template: '<div />' },
  ElPagination: {
    name: 'ElPagination',
    props: ['currentPage', 'total'],
    emits: ['update:currentPage'],
    template: '<div />',
  },
}
const wrappers: ReturnType<typeof mount>[] = []
function render(open = true) {
  const wrapper = mount(CityProductReport, {
    props: {
      modelValue: open,
      query: { ...query },
      productCategories: categories,
      filterOptions: {
        region: [{ value: 'BJ', label: '北京' }],
        owner: [{ value: 'E002', label: '员工二' }],
        customerType: [{ value: 'STORE', label: '门店' }],
        source: [{ value: 'DHB', label: '订货宝' }],
      },
    },
    global: { stubs },
  })
  wrappers.push(wrapper)
  return wrapper
}
function pending() {
  let resolve!: (value: CityProductReportView) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<CityProductReportView>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const readBlob = (blob: Blob) =>
  new Promise<ArrayBuffer>((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.readAsArrayBuffer(blob)
  })
const detailTabs = (wrapper: ReturnType<typeof mount>) =>
  wrapper
    .findAllComponents({ name: 'ElTabs' })
    .find((tab) => tab.attributes('aria-label') === '报表核对范围')!
const select = (wrapper: ReturnType<typeof mount>, label: string) =>
  wrapper
    .findAllComponents({ name: 'ElSelect' })
    .find((field) => field.attributes('aria-label') === label)!
async function downloadedWorkbook() {
  await vi.waitFor(() => expect(URL.createObjectURL).toHaveBeenCalledOnce(), { timeout: 5000 })
  const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob
  expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await readBlob(blob))
  return workbook
}

beforeEach(() => {
  erpCategories.mockResolvedValue({ items: categories, total: categories.length })
  erpBrands.mockResolvedValue({ items: [{ id: '7', brandName: '品牌甲' }], total: 1 })
  erpProducts.mockResolvedValue({ items: [{ id: '100', productName: '测试商品' }], total: 1 })
  erpProduct.mockResolvedValue({
    id: '100',
    productName: '测试商品',
    variants: [{ id: '1000', specificationSnapshot: '12桶/箱', unitCode: 'BOX' }],
  })
  seedBusinessDictionaryForTest('COMMON', 'PRODUCT_UNIT', [
    { code: 'BOX', name: '箱' },
    { code: 'BOTTLE', name: '瓶' },
    { code: 'BUCKET', name: '桶' },
  ])
  getReport.mockReset().mockResolvedValue(cityProductReport())
  vi.stubGlobal(
    'URL',
    Object.assign(class extends NativeURL {}, {
      createObjectURL: vi.fn(() => 'blob:city-product-report'),
      revokeObjectURL: vi.fn(),
    }),
  )
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(async () => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  await new Promise((resolve) => setTimeout(resolve, 0))
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('CityProductReport dialog', () => {
  it('warns at the quantity area for a mixed report containing Feishu while retaining amounts, quantities and export access', async () => {
    const report = cityProductReport()
    report.orderTrace.push({
      ...report.orderTrace[0],
      orderId: 'feishu-order',
      sourceSystemCode: 'FEISHU',
    })
    const original = structuredClone(report)
    getReport.mockResolvedValue(report)
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('.report-quantity-notice').text()).toBe(
      '包含飞书导入订单，数量沿用系统原记录，交易单位/包装换算尚未核验；不得直接作为订货箱数。',
    )
    expect(wrapper.get('.report-quantities').text()).toContain('2.5 箱')
    expect(wrapper.get('.report-summary').text()).toContain('100.13')
    expect(wrapper.get('[data-testid="report-export"]').attributes('disabled')).toBeUndefined()
    expect(report).toEqual(original)
  })
  it.each(['DHB', 'DINGHUOBAO', 'MANUAL', 'UNKNOWN'])(
    'does not generalize a Feishu warning to %s orders',
    async (sourceSystemCode) => {
      const report = cityProductReport()
      report.orderTrace[0].sourceSystemCode = sourceSystemCode
      getReport.mockResolvedValue(report)
      const wrapper = render()
      await flushPromises()
      expect(wrapper.find('.report-quantity-notice').exists()).toBe(false)
      expect(wrapper.get('.report-quantities').text()).toContain('2.5 箱')
      expect(wrapper.get('[data-testid="report-export"]').attributes('disabled')).toBeUndefined()
    },
  )
  it('blocks an unfinished selected warehouse attachment, while allowing an explicit sales-only export', async () => {
    const wrapper = render(false)
    await wrapper.setProps({ modelValue: true, query: { ...query, productId: '100' } })
    await flushPromises()
    wrapper.findComponent({ name: 'CityProductSupplyInvestigation' }).vm.$emit('evidence-change', {
      query: { ...query, productId: '100' },
      warehouseId: '9',
      warehouseName: '供货仓',
      snapshot: null,
      loading: true,
      error: '',
    })
    await nextTick()
    expect(wrapper.get('[data-testid="report-export"]').attributes('disabled')).toBeDefined()
    expect(wrapper.findComponent({ name: 'ElTooltip' }).props('content')).toContain(
      '库存与采购仍在查询',
    )
    const checkbox = wrapper
      .findAllComponents({ name: 'ElCheckbox' })
      .find((item) => item.attributes('modelvalue') === 'true')
    expect(checkbox).toBeDefined()
    checkbox!.vm.$emit('update:modelValue', false)
    await nextTick()
    expect(wrapper.get('[data-testid="report-export"]').attributes('disabled')).toBeUndefined()
  })
  it('drills city to SKU and restores the original applied scope without mutating the parent', async () => {
    const wrapper = render()
    await flushPromises()
    wrapper.findComponent({ name: 'CityProductInvestigation' }).vm.$emit('select-product', {
      regionCode: 'BJ',
      brandId: '7',
      productId: '100',
      skuId: '1000',
    })
    await flushPromises()
    expect(getReport.mock.lastCall?.[0]).toMatchObject({
      ...query,
      productCategoryId: '1',
      regionCode: 'BJ',
      brandId: '7',
      productId: '100',
      skuId: '1000',
      allocationMode: 'EXACT_ONLY',
    })
    expect(wrapper.get('[aria-label="商品分析钻取路径"]').text()).toContain('北京')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '返回上一步')!
      .trigger('click')
    await flushPromises()
    expect(getReport.mock.lastCall?.[0]).toMatchObject({
      ...query,
      productCategoryId: '1',
      productId: undefined,
      skuId: undefined,
      brandId: undefined,
    })
    expect(wrapper.findAll('button').some((button) => button.text() === '返回上一步')).toBe(false)
    expect(wrapper.props('query')).toEqual(query)
  })
  it('does not let a chart merge unapplied draft filters into a drilldown', async () => {
    const wrapper = render()
    await flushPromises()
    select(wrapper, '城市').vm.$emit('update:modelValue', 'BJ')
    await nextTick()
    wrapper
      .findComponent({ name: 'CityProductInvestigation' })
      .vm.$emit('select-product', { productId: '100' })
    await flushPromises()
    expect(getReport).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('筛选条件尚未查询')
    expect(wrapper.findAll('button').some((button) => button.text() === '返回上一步')).toBe(false)
  })
  it('keeps failed SKU drills recoverable with the back action', async () => {
    const wrapper = render()
    await flushPromises()
    getReport.mockRejectedValueOnce({ message: '商品查询失败' })
    wrapper
      .findComponent({ name: 'CityProductInvestigation' })
      .vm.$emit('select-product', { productId: '100' })
    await flushPromises()
    expect(wrapper.text()).toContain('商品查询失败')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '返回上一步')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.find('.report-summary').exists()).toBe(true)
    expect(getReport.mock.lastCall?.[0].productId).toBeUndefined()
  })
  it('preserves a SKU-only drilldown and resolves its parent only from returned fact IDs', async () => {
    getReport.mockResolvedValue(
      cityProductReport({ rows: [reportRow({ productId: '100', skuId: '1000' })] }),
    )
    const wrapper = render(false)
    await wrapper.setProps({ modelValue: true, query: { ...query, skuId: '1000' } })
    await flushPromises()
    expect(getReport.mock.lastCall?.[0]).toMatchObject({ skuId: '1000', productId: undefined })
    expect(select(wrapper, 'SKU规格').props('modelValue')).toBe('1000')
    expect(erpProduct).toHaveBeenCalledWith('100')
    const investigation = wrapper.findComponent({ name: 'CityProductSupplyInvestigation' })
    expect(investigation.props('query')).toMatchObject({ productId: '100', skuId: '1000' })
    expect(wrapper.props('query')).not.toHaveProperty('productId')
  })
  it('keeps ERP brand, category, product and SKU independent and exports their applied business names', async () => {
    const wrapper = render()
    await flushPromises()
    select(wrapper, '品牌').vm.$emit('update:modelValue', '7')
    select(wrapper, '商品').vm.$emit('update:modelValue', '100')
    select(wrapper, '商品').vm.$emit('change')
    await flushPromises()
    select(wrapper, 'SKU规格').vm.$emit('update:modelValue', '1000')
    select(wrapper, 'SKU规格').vm.$emit('change')
    await flushPromises()
    expect(getReport.mock.lastCall?.[0]).toMatchObject({
      brandId: '7',
      productCategoryId: '1',
      productId: '100',
      skuId: '1000',
      allocationMode: 'EXACT_ONLY',
      regionCode: 'WH',
    })
    expect(erpProduct).toHaveBeenCalledWith('100')
    expect(erpBrands).toHaveBeenCalledWith({ begin: 0, step: 200 })
    await wrapper.get('[data-testid="report-export"]').trigger('click')
    const workbook = await downloadedWorkbook()
    const metadata = workbook.getWorksheet('统计口径')!.getSheetValues().flat()
    expect(metadata).toContain('品牌甲')
    expect(metadata).toContain('测试商品')
    expect(metadata).toContain('12桶/箱 · 箱')
    expect(metadata).not.toContain('1000')
    expect(wrapper.findComponent({ name: 'CityProductSupplyInvestigation' }).exists()).toBe(true)
  })

  it('searches products in every descendant category and retains the selected parent for report scope', async () => {
    erpCategories.mockResolvedValue({
      total: 3,
      items: [
        categories[0],
        { ...categories[1], parentId: '1' },
        { ...categories[1], id: '3', parentId: '2', categoryName: '三级类' },
      ],
    })
    const wrapper = render()
    await flushPromises()
    erpProducts.mockClear()
    select(wrapper, '商品分类').vm.$emit('update:modelValue', '1')
    select(wrapper, '商品分类').vm.$emit('change')
    await flushPromises()
    expect(erpProducts.mock.calls.map(([value]) => value.categoryId)).toEqual(['1', '2', '3'])
    expect(getReport.mock.lastCall?.[0].productCategoryId).toBe('1')
  })
  it('defaults to exact city-category attribution, independently of unresolved SKU totals', async () => {
    const report = cityProductReport({
      rows: [reportRow({ paidAmount: null, unallocatedOrderCount: 1 })],
      categoryRows: [
        reportRow({
          paidAmount: '88.000001',
          unallocatedOrderCount: 0,
          allocationStatus: 'EXACT',
          unitCode: null,
          quantity: null,
          quantities: [
            { unitCode: 'BOX', quantity: '2.500' },
            { unitCode: 'BOTTLE', quantity: '12.125' },
          ],
        }),
      ],
    })
    report.summary!.paidAmount = null
    report.summary!.categoryPaidAmount = '88.000001'
    report.summary!.unallocatedCategoryOrderCount = 0
    getReport.mockResolvedValue(report)
    const wrapper = render()
    await flushPromises()
    expect(getReport).toHaveBeenCalledExactlyOnceWith({
      ...query,
      productCategoryId: '1',
      allocationMode: 'EXACT_ONLY',
    })
    expect(wrapper.findComponent({ name: 'ElDialog' }).props('width')).toBe('min(1200px, 96vw)')
    expect(wrapper.find('.report-summary').text()).toContain('¥88.00')
    expect(wrapper.find('.report-summary').text()).not.toContain('¥88.000001')
    expect(wrapper.findAll('.alert')).toHaveLength(0)
    expect(wrapper.find('.report-quantities').text()).toContain('2.5 箱')
    expect(wrapper.find('.report-quantities').text()).toContain('12.125 瓶')
    const chart = wrapper.findComponent({ name: 'EchartsChart' })
    expect(chart.props('option').series[1].data).toEqual([88.000001])
    expect(chart.props('option').tooltip.confine).toBe(true)
    expect(wrapper.findComponent({ name: 'ElTable' }).props('rowKey')).toBeUndefined()
    select(wrapper, '报表类型').vm.$emit('update:modelValue', 'details')
    await nextTick()
    detailTabs(wrapper).vm.$emit('update:modelValue', 'rows')
    await nextTick()
    expect(chart.props('option').series[1].data).toEqual([null])
    expect(wrapper.findAll('.alert').some((row) => row.text().includes('1 笔订单回款待核对'))).toBe(
      true,
    )
    expect(getReport).toHaveBeenCalledTimes(1)
  })

  it('shows business-time dates and update times without changing the response used for export', async () => {
    const report = cityProductReport({
      from: '2026-08-31T16:00:00Z',
      to: '2026-09-12T15:59:59Z',
      generatedAt: '2026-09-12T08:30:42Z',
      dataUpdatedAt: '2026-09-12T16:12:33+08:00',
    })
    const originalResponse = structuredClone(report)
    getReport.mockResolvedValue(report)
    const wrapper = render()
    await flushPromises()
    const scope = wrapper.find('.report-scope').text()
    expect(wrapper.findComponent({ name: 'ElDatePicker' }).props('modelValue')).toEqual([
      '2026-09-01',
      '2026-09-12',
    ])
    expect(wrapper.findComponent({ name: 'ElDatePicker' }).attributes('type')).toBe('daterange')
    expect(scope).toContain('2026-09-01 至 2026-09-12（北京时间）')
    expect(scope).toContain('09-12 16:30')
    expect(scope).toContain('09-12 16:12')
    expect(scope).not.toContain('T23:59:59')
    expect(wrapper.find('.report-summary').text()).toContain('商品销售额')
    expect(wrapper.find('.report-quantities').text()).toContain('订货数量（未扣退货）')
    await wrapper.get('[data-testid="report-export"]').trigger('click')
    const workbook = await downloadedWorkbook()
    const metadata = workbook.getWorksheet('统计口径')!.getSheetValues().flat()
    expect(metadata).toContain('开始时间（北京时间）')
    expect(metadata).toContain('2026-09-01 00:00:00')
    expect(metadata).toContain('2026-09-12 23:59:59')
    expect(metadata).toContain('生成时间（北京时间）')
    expect(metadata).toContain('2026-09-12 16:30:42')
    expect(metadata).toContain('2026-09-12 16:12:33')
    expect(metadata).not.toContain('2026-09-12T08:30:42Z')
    expect(workbook.getWorksheet('商品SKU')!.getSheetValues().flat()).toContain('箱')
    expect(report).toEqual(originalResponse)
  })

  it('drops out-of-order responses while category selection remains local to the dialog', async () => {
    const first = pending()
    const second = pending()
    getReport.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const wrapper = render()
    const category = select(wrapper, '商品分类')
    category.vm.$emit('update:modelValue', '2')
    category.vm.$emit('change')
    await nextTick()
    expect(getReport.mock.lastCall?.[0]).toMatchObject({
      productCategoryId: '2',
      allocationMode: 'EXACT_ONLY',
    })
    expect(wrapper.props('query')).toEqual(query)
    second.resolve(
      cityProductReport({
        categoryRows: [
          reportRow({ categoryId: '2', categoryName: '饮用水', regionName: '最新城市' }),
        ],
      }),
    )
    await flushPromises()
    first.resolve(cityProductReport({ categoryRows: [reportRow({ regionName: '迟到城市' })] }))
    await flushPromises()
    expect(wrapper.findComponent({ name: 'EchartsChart' }).props('option').xAxis.data).toEqual([
      '最新城市',
    ])
    expect(wrapper.find('.report-scope').text()).toContain('饮用水')
  })

  it('keeps loading and error states separate from zero, and blocks stale exports after a failed filter change', async () => {
    const wrapper = render()
    await flushPromises()
    const next = pending()
    getReport.mockReturnValueOnce(next.promise)
    const mode = select(wrapper, '回款分摊口径')
    mode.vm.$emit('update:modelValue', 'PROPORTIONAL')
    mode.vm.$emit('change')
    await nextTick()
    expect(getReport.mock.lastCall?.[0].allocationMode).toBe('PROPORTIONAL')
    expect(wrapper.find('.report-summary').exists()).toBe(false)
    expect(wrapper.get('[data-testid="report-export"]').attributes('disabled')).toBeDefined()
    next.reject({ message: '报表暂时不可用' })
    await flushPromises()
    expect(wrapper.text()).toContain('报表暂时不可用')
    expect(wrapper.findComponent({ name: 'EchartsChart' }).exists()).toBe(false)
    expect(wrapper.get('[data-testid="report-export"]').attributes('disabled')).toBeDefined()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('invalidates requests on close, forwards the close event, and reloads parent query changes', async () => {
    const first = pending()
    getReport.mockReturnValueOnce(first.promise)
    const wrapper = render(false)
    expect(getReport).not.toHaveBeenCalled()
    await wrapper.setProps({ modelValue: true })
    wrapper.findComponent({ name: 'ElDialog' }).vm.$emit('update:modelValue', false)
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false])
    await wrapper.setProps({ modelValue: false })
    first.resolve(cityProductReport())
    await flushPromises()
    expect(wrapper.find('.report-summary').exists()).toBe(false)
    await wrapper.setProps({ modelValue: true, query: { ...query, regionCode: 'SH' } })
    await flushPromises()
    expect(getReport.mock.lastCall?.[0]).toMatchObject({
      regionCode: 'SH',
      allocationMode: 'EXACT_ONLY',
    })
    await wrapper.setProps({ query: { ...query, regionCode: 'BJ' } })
    await flushPromises()
    expect(getReport.mock.lastCall?.[0].regionCode).toBe('BJ')
  })

  it.each([
    { truncated: true, summary: null },
    { exportBlocked: true, summary: null },
    { sample: true },
    { rows: [], categoryRows: [], orderTrace: [] },
  ])('does not export blocked, sample or empty data: %j', async (overrides) => {
    getReport.mockResolvedValue(cityProductReport(overrides))
    const wrapper = render()
    await flushPromises()
    expect(wrapper.get('[data-testid="report-export"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.report-summary').exists()).toBe(false)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('exports all four sheets regardless of the selected tab and detail page', async () => {
    getReport.mockResolvedValue(
      cityProductReport({
        rows: Array.from({ length: 1203 }, (_, index) =>
          reportRow({ skuCode: `SKU-${index}`, productName: `商品-${index}` }),
        ),
      }),
    )
    const wrapper = render()
    await flushPromises()
    select(wrapper, '报表类型').vm.$emit('update:modelValue', 'details')
    await nextTick()
    detailTabs(wrapper).vm.$emit('update:modelValue', 'rows')
    await nextTick()
    wrapper.findComponent({ name: 'ElPagination' }).vm.$emit('update:currentPage', 2)
    await nextTick()
    const visible = wrapper.findComponent({ name: 'ElTable' }).props('data')
    expect(visible).toHaveLength(100)
    expect(visible[0].skuCode).toBe('SKU-100')
    await wrapper.get('[data-testid="report-export"]').trigger('click')
    const workbook = await downloadedWorkbook()
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      '城市分类',
      '商品SKU',
      '订单核对',
      '统计口径',
    ])
    expect(workbook.getWorksheet('商品SKU')!.rowCount).toBe(1204)
    expect(workbook.getWorksheet('商品SKU')!.getRow(1204).values).toContain('商品-1202')
    expect(workbook.getWorksheet('统计口径')!.getSheetValues().flat()).toContain('方便面')
    expect(workbook.getWorksheet('统计口径')!.getSheetValues().flat()).toContain(
      '不分摊（仅精确归属）',
    )
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce()
  })

  it('defaults all sheet columns, blocks zero selected columns and restores defaults', async () => {
    const wrapper = render()
    await flushPromises()
    select(wrapper, '报表类型').vm.$emit('update:modelValue', 'details')
    await nextTick()
    const fields = wrapper.findComponent({ name: 'ElCheckboxGroup' })
    expect(fields.props('modelValue')).toEqual(
      cityProductColumns.categoryRows.map((column) => column.key),
    )
    fields.vm.$emit('update:modelValue', [])
    await nextTick()
    expect(wrapper.get('[data-testid="report-export"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('至少选择一个')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '全选')!
      .trigger('click')
    expect(fields.props('modelValue')).toHaveLength(cityProductColumns.categoryRows.length)
    fields.vm.$emit('update:modelValue', ['regionName'])
    await nextTick()
    expect(wrapper.get('[data-testid="report-export"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-testid="report-export"]').trigger('click')
    const workbook = await downloadedWorkbook()
    expect(workbook.getWorksheet('城市分类')!.columnCount).toBe(1)
    expect(workbook.getWorksheet('商品SKU')!.columnCount).toBe(cityProductColumns.rows.length)
    expect(workbook.getWorksheet('订单核对')!.columnCount).toBe(
      cityProductColumns.orderTrace.length,
    )
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '恢复默认')!
      .trigger('click')
    expect(fields.props('modelValue')).toHaveLength(cityProductColumns.categoryRows.length)
  })

  it('blocks dirty filters until queried and exports only the applied query', async () => {
    const wrapper = render()
    await flushPromises()
    for (const [label, value] of [
      ['城市', 'BJ'],
      ['销售员工', 'E002'],
      ['客户类型', 'STORE'],
      ['来源系统', 'DHB'],
    ])
      select(wrapper, label).vm.$emit('update:modelValue', value)
    wrapper
      .findComponent({ name: 'ElDatePicker' })
      .vm.$emit('update:modelValue', ['2026-08-01', '2026-08-31'])
    await nextTick()
    expect(getReport).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="report-export"]').attributes('disabled')).toBeDefined()
    expect(wrapper.findComponent({ name: 'ElTooltip' }).props('content')).toContain('先查询')
    expect(wrapper.props('query')).toEqual(query)
    getReport.mockResolvedValueOnce(
      cityProductReport({ from: '2026-08-01T00:00:00Z', to: '2026-08-31T23:59:59.999999Z' }),
    )
    await wrapper.get('[aria-label="重新查询城市商品报表"]').trigger('click')
    await flushPromises()
    expect(getReport.mock.lastCall?.[0]).toMatchObject({
      from: '2026-08-01T00:00:00+08:00',
      to: '2026-08-31T23:59:59.999999+08:00',
      regionCode: 'BJ',
      ownerStaffCode: 'E002',
      customerTypeCode: 'STORE',
      sourceSystemCode: 'DHB',
      allocationMode: 'EXACT_ONLY',
    })
    expect(wrapper.get('[data-testid="report-export"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-testid="report-export"]').trigger('click')
    const workbook = await downloadedWorkbook()
    const metadata = workbook.getWorksheet('统计口径')!.getSheetValues().flat()
    for (const value of ['北京', '员工二', '门店', '订货宝']) expect(metadata).toContain(value)
  })

  it('discards an in-flight export if filters become dirty or the dialog closes', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof excelExport.buildCityProductExcel>>) => void
    vi.spyOn(excelExport, 'buildCityProductExcel').mockImplementationOnce(
      () =>
        new Promise((yes) => {
          resolve = yes
        }),
    )
    const wrapper = render()
    await flushPromises()
    await wrapper.get('[data-testid="report-export"]').trigger('click')
    select(wrapper, '城市').vm.$emit('update:modelValue', 'BJ')
    await nextTick()
    resolve({ buffer: new ArrayBuffer(0), filename: 'stale.xlsx', precisionWarningCount: 0 })
    await flushPromises()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    await wrapper.setProps({ modelValue: false })
  })
})
