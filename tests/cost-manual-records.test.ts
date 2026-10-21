import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import ElementPlus from 'element-plus'
import { createPinia } from 'pinia'
import View from '@/views/supply-chain/cost/CostManagementView.vue'
import RouteSummary from '@/views/supply-chain/cost/CostLogisticsRoute.vue'
import DictSelect from '@/views/supply-chain/cost/CostDictSelect.vue'
import DocumentSelect from '@/views/supply-chain/cost/CostDocumentSelect.vue'
import { logisticsRoute } from '@/views/supply-chain/cost/cost-logistics'
import { loadCostDictionaries } from '@/views/supply-chain/cost/cost-dictionaries'
import { loadBusinessDictionaries } from '@/utils/business-dictionary'
import ExternalFields from '@/views/supply-chain/cost/CostExternalDocumentFields.vue'
import { costSourceLabel } from '@/views/supply-chain/cost/cost-source'
import { costSnapshotFields } from '@/views/supply-chain/cost/cost-audit'
import {
  getCosts,
  getCostSources,
  saveCost,
  exportCosts,
  type CostRecord,
  type CostCommand,
} from '@/api/core/cost'
const state = vi.hoisted(() => ({ route: { path: '/supply-chain/cost/logistics' } }))
vi.mock('vue-router', () => ({
  onBeforeRouteLeave: vi.fn(),
  onBeforeRouteUpdate: vi.fn(),
  useRoute: () => state.route,
}))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: () => true }),
}))
vi.mock('@/api/core/cost', () => ({
  getCosts: vi.fn(),
  exportCosts: vi.fn(),
  saveCost: vi.fn(),
  getCost: vi.fn(),
  getCostSources: vi.fn(),
  getCostCities: vi.fn().mockResolvedValue([{ code: 'C1', name: '武汉' }]),
  getCostEmployees: vi.fn().mockResolvedValue([]),
  getCostWarehouses: vi.fn().mockResolvedValue([]),
  getCostReferences: vi.fn().mockResolvedValue([]),
  getCostPurchaseOrders: vi.fn().mockResolvedValue([]),
  getCostCustomers: vi.fn().mockResolvedValue([]),
  getCostAttachments: vi.fn().mockResolvedValue([]),
  getCostHistory: vi.fn(),
  changeCostStatus: vi.fn(),
}))
vi.mock('@/utils/business-dictionary', () => ({
  loadBusinessDictionaries: vi.fn().mockResolvedValue(undefined),
  businessDictionaryLabel: (_m: string, _c: string, v: string) => v,
  businessDictionaryOptions: () => [],
}))
const exportRows = vi.hoisted(() => vi.fn())
vi.mock('@/views/supply-chain/cost/cost-export', () => ({ exportCostRows: exportRows }))
const empty = { items: [], total: 0, begin: 0, step: 20 }
beforeEach(() => {
  vi.clearAllMocks()
  state.route = reactive({ path: '/supply-chain/cost/logistics' })
  vi.mocked(getCosts).mockResolvedValue(empty)
})
function record(data: CostCommand): CostRecord {
  return {
    id: '1',
    documentNo: 'CST1',
    revision: 1,
    statusCode: 'DRAFT',
    categoryCode: 'LOGISTICS',
    data,
    sources: [],
    warehouseName: null,
    ownerEmployeeName: null,
    createdTime: '2026-10-15',
    updatedTime: '2026-10-15',
  }
}
async function mountView() {
  const w = mount(View, {
    global: {
      plugins: [ElementPlus, createPinia()],
      stubs: {
        SupplyPageTitle: true,
        ElDialog: { template: '<div><slot/><slot name="footer"/></div>' },
        ElDrawer: { template: '<div><slot/></div>' },
        CostAttachments: true,
      },
    },
  })
  await flushPromises()
  return w
}
describe('manual source documents', () => {
  it.each([
    ['purchases', ['商品与供应商', '进货信息', '来源与补充']],
    ['losses', ['损耗对象', '损耗情况', '来源与补充']],
    ['warehouse-rentals', ['仓库信息', '本次租金']],
    ['office-rentals', ['办公室信息', '本次租金']],
    ['marketing', ['营销事项', '金额与经办']],
  ])('orders the %s editor around its own business object', async (category, headings) => {
    state.route.path = '/supply-chain/cost/' + category
    const w = await mountView()
    try {
      const editor = w.get('.cost-editor')
      expect(editor.findAll('h3').map((node) => node.text())).toEqual(headings)
      if (category === 'office-rentals') expect(editor.text()).not.toContain('关联仓库')
      if (category === 'marketing')
        expect(editor.findAll('label').map((node) => node.text())).not.toContain('费用标题')
    } finally {
      w.unmount()
    }
  })
  it('offers external document entry and stores DHB provenance without local source IDs', async () => {
    const w = await mountView()
    try {
      await w
        .findAll('button')
        .find((b) => b.text() === '新增运费')!
        .trigger('click')
      await flushPromises()
      const mode = w.findAllComponents({ name: 'ElRadioGroup' })[0]!
      mode.vm.$emit('update:modelValue', 'MANUAL')
      mode.vm.$emit('change', 'MANUAL')
      await flushPromises()
      const external = w.getComponent(ExternalFields)
      expect(external.props('modelValue')).toMatchObject({
        sourceSystem: 'DHB',
        documentType: 'PURCHASE',
      })
      external.vm.$emit('update:modelValue', {
        sourceSystem: 'DHB',
        documentType: 'PURCHASE',
        documentNo: 'DHB-1',
        documentDate: '2026-10-01',
        senderName: '厂家',
        receiverName: '中心仓',
        remark: '',
      })
      const vm = w.vm as unknown as { form: CostCommand }
      Object.assign(vm.form, {
        title: '采购运费',
        cityCode: 'C1',
        cityName: '武汉',
        costDate: '2026-10-15',
        amount: null,
      })
      Object.assign(vm.form.logistics!, {
        senderName: '厂家',
        receiverName: '中心仓',
        originAddress: '工厂',
        destinationAddress: '仓库',
        transportMethodCode: 'EXPRESS',
      })
      vi.mocked(saveCost).mockImplementation(async (_c, _i, d) => record(d))
      await w
        .findAll('button')
        .find((b) => b.text() === '保存')!
        .trigger('click')
      await flushPromises()
      expect(saveCost).toHaveBeenCalledWith(
        'logistics',
        null,
        expect.objectContaining({
          amount: null,
          logistics: expect.objectContaining({
            entryMode: 'MANUAL',
            sourceIds: [],
            externalDocuments: [
              expect.objectContaining({ documentNo: 'DHB-1', sourceSystem: 'DHB' }),
            ],
          }),
        }),
      )
      expect(getCostSources).not.toHaveBeenCalled()
    } finally {
      w.unmount()
    }
  })
  it('drops manual document data when switching back to system association', async () => {
    const w = await mountView()
    try {
      await w
        .findAll('button')
        .find((b) => b.text() === '新增运费')!
        .trigger('click')
      await flushPromises()
      const mode = w.findAllComponents({ name: 'ElRadioGroup' })[0]!
      mode.vm.$emit('update:modelValue', 'MANUAL')
      mode.vm.$emit('change', 'MANUAL')
      await flushPromises()
      mode.vm.$emit('update:modelValue', 'LINKED')
      mode.vm.$emit('change', 'LINKED')
      await flushPromises()
      expect((w.vm as unknown as { form: CostCommand }).form.logistics).toMatchObject({
        externalDocuments: [],
        sourceIds: [],
        supplierId: null,
        customerId: null,
      })
      expect(w.findComponent(ExternalFields).exists()).toBe(false)
    } finally {
      w.unmount()
    }
  })
  it('labels local, DHB and unrelated manual records accurately in details and export', () => {
    const data = {
      logistics: {
        externalDocuments: [
          {
            sourceSystem: 'DHB',
            documentNo: 'DHB-9',
            documentDate: '2026-10-01',
            senderName: '仓',
            receiverName: '客户',
          },
        ],
      },
    } as CostCommand
    const r = record(data)
    expect(costSourceLabel(r)).toBe('订货宝 · 手工补录')
    expect(costSnapshotFields(r).find((f) => f.label === '单据来源')?.value).toBe(
      '订货宝 · 手工补录',
    )
    expect(costSnapshotFields(r).some((f) => f.value.includes('DHB-9'))).toBe(true)
    expect(costSourceLabel({ ...r, sources: [{ id: '9' }] as CostRecord['sources'] })).toBe(
      '来源待核对 · 已关联；订货宝 · 手工补录',
    )
    expect(costSourceLabel(record({} as CostCommand))).toBe('手工登记 · 无来源单据')
  })
  it('exports all filtered pages using the separately authorized export API', async () => {
    const r = record({ title: '运费', cityName: '武汉', amount: null } as CostCommand)
    vi.mocked(getCosts).mockResolvedValue({ ...empty, total: 2, items: [r] })
    vi.mocked(exportCosts)
      .mockResolvedValueOnce({ ...empty, total: 2, items: [r] })
      .mockResolvedValueOnce({ ...empty, total: 2, items: [{ ...r, id: '2', documentNo: 'CST2' }] })
    const w = await mountView()
    try {
      await w
        .findAll('button')
        .find((b) => b.text() === '导出筛选结果')!
        .trigger('click')
      await flushPromises()
      expect(exportCosts).toHaveBeenNthCalledWith(
        2,
        'logistics',
        expect.objectContaining({ begin: 1, step: 200 }),
      )
      expect(exportRows.mock.calls[0]![2]).toHaveLength(2)
    } finally {
      w.unmount()
    }
  })
})

describe('explicit logistics business roles', () => {
  it('requests an actual city warehouse when a linked imported order has none', async () => {
    const w = await mountView()
    try {
      await w
        .findAll('button')
        .find((b) => b.text() === '新增运费')!
        .trigger('click')
      w.findAllComponents(DictSelect)
        .find((c) => c.props('code') === 'COST_LOGISTICS_LEG')!
        .vm.$emit('update:modelValue', 'DELIVERY')
      await flushPromises()
      const selector = w.getComponent(DocumentSelect)
      selector.vm.$emit('sources', [
        { id: 'S1', cityCode: 'C1', warehouseId: null, senderName: null, receiverName: '客户甲' },
      ])
      selector.vm.$emit('update:modelValue', ['S1'])
      selector.vm.$emit('change')
      await flushPromises()
      expect(w.text()).toContain('本次发货城市仓')
      expect(w.getComponent(RouteSummary).text()).toContain('城市仓待补录')
      expect(w.text()).toContain('客户甲收货地址')
      expect((w.vm as unknown as { form: CostCommand }).form.logistics?.deliveryStops).toEqual([
        { sourceId: 'S1', customerName: '客户甲', address: '' },
      ])
    } finally {
      w.unmount()
    }
  })
  it('shows the supplemental route without claiming the source order contained a warehouse', () => {
    const source = {
      warehouseId: null,
      senderName: '',
      receiverName: '客户甲',
    } as CostRecord['sources'][number]
    const route = logisticsRoute(
      { legCode: 'DELIVERY', senderName: '实际城市仓' } as NonNullable<CostCommand['logistics']>,
      [source],
    )
    expect(route.senderName).toBe('实际城市仓')
    expect(source.warehouseId).toBeNull()
    expect(source.senderName).toBe('')
  })
  it.each([
    ['PURCHASE', '供应商（厂家）', '中心仓', '华中食品厂', '武汉中心仓'],
    ['TRANSFER', '中心仓', '城市仓', '武汉中心仓', '长沙城市仓'],
    ['DELIVERY', '城市仓', '客户', '长沙城市仓', '星城门店'],
  ])(
    'shows %s parties in list, details and audit/export for linked records',
    async (leg, sender, receiver, from, to) => {
      const r = record({
        title: '运输费用',
        cityName: '武汉',
        logistics: { legCode: leg, sourceIds: ['S1'], entryMode: 'LINKED' },
      } as CostCommand)
      r.sources = [
        { id: 'S1', documentNo: 'PO-100', senderName: from, receiverName: to },
      ] as CostRecord['sources']
      vi.mocked(getCosts).mockResolvedValue({ ...empty, total: 1, items: [r] })
      const w = await mountView()
      try {
        const summary = w.getComponent(RouteSummary)
        expect(summary.text()).toContain(sender + from)
        expect(summary.text()).toContain(receiver + to)
        await w
          .findAll('button')
          .find((b) => b.text() === 'CST1')!
          .trigger('click')
        await flushPromises()
        const detailRoute = w.findAllComponents(RouteSummary).at(-1)!
        expect(detailRoute.text()).toContain(sender + from)
        expect(detailRoute.text()).toContain(receiver + to)
        expect(costSnapshotFields(r)).toEqual(
          expect.arrayContaining([
            { label: sender!, value: from! },
            { label: receiver!, value: to! },
          ]),
        )
      } finally {
        w.unmount()
      }
    },
  )

  it.each([
    ['PURCHASE', '供应商（厂家）', '中心仓', '客户'],
    ['TRANSFER', '中心仓', '城市仓', '供应商'],
    ['DELIVERY', '城市仓', '客户', '中心仓'],
  ])(
    'offers only the relevant manual parties for %s and clears old references when changing leg',
    async (leg, sender, receiver, excluded) => {
      const w = await mountView()
      try {
        await w
          .findAll('button')
          .find((b) => b.text() === '新增运费')!
          .trigger('click')
        await flushPromises()
        const type = w
          .findAllComponents(DictSelect)
          .find((c) => c.props('code') === 'COST_LOGISTICS_LEG')!
        type.vm.$emit('update:modelValue', leg)
        await flushPromises()
        const mode = w.findAllComponents({ name: 'ElRadioGroup' })[0]!
        mode.vm.$emit('update:modelValue', 'MANUAL')
        mode.vm.$emit('change', 'MANUAL')
        await flushPromises()
        const fields = w.get('.manual-route-fields')
        expect(fields.text()).toContain(sender)
        expect(fields.text()).toContain(receiver)
        expect(fields.text()).not.toContain(excluded)
        const vm = w.vm as unknown as { form: CostCommand }
        vm.form.logistics!.senderName = '真实发货方'
        vm.form.logistics!.receiverName = '真实收货方'
        await flushPromises()
        expect(vm.form.logistics!.externalDocuments![0]).toMatchObject({
          senderName: '真实发货方',
          receiverName: '真实收货方',
        })
        vm.form.logistics!.supplierId = 'stale'
        type.vm.$emit('update:modelValue', leg === 'TRANSFER' ? 'DELIVERY' : 'TRANSFER')
        await flushPromises()
        expect(vm.form.logistics).toMatchObject({
          supplierId: null,
          customerId: null,
          sourceWarehouseId: null,
          targetWarehouseId: null,
          sourceIds: [],
          senderName: '',
          receiverName: '',
        })
      } finally {
        w.unmount()
      }
    },
  )

  it('shows selected purchase supplier and warehouse immediately in the editor', async () => {
    vi.mocked(getCostSources).mockResolvedValue([
      {
        id: 'P1',
        documentNo: 'PO1',
        senderName: '食品供应商',
        receiverName: '一号中心仓',
        cityCode: 'C1',
      },
    ] as CostRecord['sources'])
    const w = await mountView()
    try {
      await w
        .findAll('button')
        .find((b) => b.text() === '新增运费')!
        .trigger('click')
      await flushPromises()
      const select = w.findAllComponents({ name: 'ElSelect' }).find((c) => c.props('multiple'))!
      select.vm.$emit('visible-change', true)
      await flushPromises()
      select.vm.$emit('update:modelValue', ['P1'])
      select.vm.$emit('change', ['P1'])
      await flushPromises()
      expect(w.getComponent(RouteSummary).text()).toContain('供应商（厂家）食品供应商')
      expect(w.getComponent(RouteSummary).text()).toContain('中心仓一号中心仓')
      expect((w.vm as unknown as { form: CostCommand }).form.cityName).toBe('武汉')
    } finally {
      w.unmount()
    }
  })

  it('keeps every customer on a combined delivery and marks missing historical names for checking', () => {
    const route = logisticsRoute(
      { legCode: 'DELIVERY' } as NonNullable<CostCommand['logistics']>,
      [
        { senderName: '城市仓', receiverName: '客户甲' },
        { senderName: '城市仓', receiverName: '客户乙' },
        { senderName: '城市仓', receiverName: '' },
      ] as CostRecord['sources'],
    )
    expect(route.senderName).toBe('城市仓')
    expect(route.receiverName).toBe('客户甲、客户乙、待核对')
  })

  it('filters by leg and initializes the new record to that leg', async () => {
    const w = await mountView()
    try {
      await w
        .get('.logistics-segments')
        .findAll('button')
        .find((b) => b.text() === '中心仓 → 城市仓')!
        .trigger('click')
      await flushPromises()
      expect(getCosts).toHaveBeenLastCalledWith(
        'logistics',
        expect.objectContaining({ typeCode: 'TRANSFER' }),
      )
      await w
        .findAll('button')
        .find((b) => b.text() === '新增运费')!
        .trigger('click')
      await flushPromises()
      expect((w.vm as unknown as { form: CostCommand }).form.logistics).toMatchObject({
        legCode: 'TRANSFER',
        entryMode: 'MANUAL',
        externalDocuments: [expect.objectContaining({ documentType: 'TRANSFER' })],
      })
    } finally {
      w.unmount()
    }
  })

  it('does not depend on premises or payroll dictionaries when recording freight', async () => {
    await loadCostDictionaries('logistics')
    const codes = vi
      .mocked(loadBusinessDictionaries)
      .mock.calls.at(-1)![0]
      .map((d) => d.code)
    expect(codes).toContain('COST_LOGISTICS_LEG')
    expect(codes).not.toContain('COST_PREMISES_TYPE')
    expect(codes).not.toContain('PAYROLL_STATUS')
  })
})

describe('cost category business columns', () => {
  it.each([
    ['purchases', ['进货日期', '商品', '规格', '进货单价（元）', '供应商']],
    ['losses', ['商品', '数量', '损耗原因', '仓库／发生地点']],
    ['warehouse-rentals', ['仓库名称', '面积（㎡）', '费用月份']],
    ['marketing', ['类型', '收款方／合作方', '经办人', '费用日期']],
    ['office-rentals', ['办公室名称', '面积（㎡）', '费用月份']],
  ] as const)('shows business-specific columns for %s', async (category, columns) => {
    state.route.path = `/supply-chain/cost/${category}`
    const w = await mountView()
    try {
      const headers = w.findAll('th').map((th) => th.text())
      for (const label of columns) expect(headers).toContain(label)
      if (category !== 'marketing') expect(headers).not.toContain('费用事项')
      expect(headers).not.toContain('付款状态')
      w.getComponent({ name: 'ElSwitch' }).vm.$emit('update:modelValue', true)
      await flushPromises()
      expect(w.findAll('th').map((th) => th.text())).toContain('付款状态')
    } finally {
      w.unmount()
    }
  })

  it('keeps the freight list focused while allowing additional filters to be expanded', async () => {
    const w = await mountView()
    try {
      expect(w.find('input[aria-label="费用事项"]').exists()).toBe(false)
      expect(w.find('input[aria-label="来源单号"]').exists()).toBe(false)
      await w
        .findAll('button')
        .find((b) => b.text() === '更多筛选')!
        .trigger('click')
      expect(w.find('input[aria-label="费用事项"]').exists()).toBe(true)
      expect(w.find('input[aria-label="运单号"]').exists()).toBe(true)
      expect(w.find('input[aria-label="来源单号"]').exists()).toBe(true)
    } finally {
      w.unmount()
    }
  })
})

describe('historical cost detail snapshots', () => {
  it('renders goods warehouse without requiring rental data', () => {
    const fields = costSnapshotFields({
      data: { goods: { productName: '商品', unit: '箱', quantity: 2 } },
      warehouseName: '城市仓',
      sources: [],
    })
    expect(fields).toContainEqual({ label: '仓库', value: '城市仓' })
  })
  it('does not classify a legacy premises name as an inventory warehouse', () => {
    const fields = costSnapshotFields({
      data: { rental: { premisesName: '旧办公室', warehouseId: null } },
      warehouseName: '旧办公室',
      sources: [],
    })
    expect(fields).toContainEqual({ label: '场地类型', value: '类型待核对' })
    expect(fields.find((field) => field.label === '仓库')).toBeUndefined()
  })
})
