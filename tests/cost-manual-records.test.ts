import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'
import ElementPlus from 'element-plus'
import { createPinia } from 'pinia'
import View from '@/views/supply-chain/cost/CostManagementView.vue'
import Attachments from '@/views/supply-chain/cost/CostAttachments.vue'
import { apiClient } from '@/api/core/client'
import RouteSummary from '@/views/supply-chain/cost/CostLogisticsRoute.vue'
import DictSelect from '@/views/supply-chain/cost/CostDictSelect.vue'
import DocumentSelect from '@/views/supply-chain/cost/CostDocumentSelect.vue'
import { logisticsRoute } from '@/views/supply-chain/cost/cost-logistics'
import { loadCostDictionaries } from '@/views/supply-chain/cost/cost-dictionaries'
import { loadBusinessDictionaries } from '@/utils/business-dictionary'
import ExternalFields from '@/views/supply-chain/cost/CostExternalDocumentFields.vue'
import EntryMode from '@/views/supply-chain/cost/CostEntryMode.vue'
import LogisticsParties from '@/views/supply-chain/cost/CostLogisticsParties.vue'
import ReferenceSelect from '@/views/supply-chain/cost/CostReferenceSelect.vue'
import { costSourceLabel } from '@/views/supply-chain/cost/cost-source'
import { costSnapshotFields } from '@/views/supply-chain/cost/cost-audit'
import {
  getCosts,
  getCostSources,
  saveCost,
  exportCosts,
  getCostHistory,
  getCostAttachments,
  type CostRecord,
  type CostCommand,
} from '@/api/core/cost'
const state = vi.hoisted(() => ({ route: { path: '/supply-chain/cost/logistics' } }))
const auth = vi.hoisted(() => ({ value: '' }))
vi.mock('@/utils/token', () => ({ getAuthorizationHeader: () => auth.value }))
vi.mock('@/api/core/client', () => ({ apiClient: { post: vi.fn() } }))
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
const creator = '11111111-1111-4111-8111-111111111111'
const modifier = '22222222-2222-4222-8222-222222222222'
let session = 0
beforeEach(() => {
  vi.clearAllMocks()
  auth.value = `Bearer cost-audit-${++session}`
  vi.mocked(apiClient.post).mockResolvedValue({
    [creator]: '测试录入员工',
    [modifier]: '测试修改员工',
  })
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
    ['cost/purchases', '进货记录'],
    ['cost/losses', '损耗记录'],
    ['cost/logistics', '运费'],
    ['cost/warehouse-rentals', '仓储费用'],
    ['cost/office-rentals', '办公室费用'],
    ['cost/marketing', '营销费用'],
    ['hr/expenses', '报销费用'],
  ])('%s 的自动初始化不触发离开警告，实际输入后才保护未保存内容', async (path, title) => {
    state.route.path = `/supply-chain/${path}`
    const w = await mountView()
    try {
      await w
        .findAll('button')
        .find((b) => b.text() === `新增${title}`)!
        .trigger('click')
      await flushPromises()
      const vm = w.vm as unknown as { dirty: boolean; form: CostCommand }
      expect(vm.dirty).toBe(false)
      expect(w.get('.cost-editor').text()).not.toMatch(
        /看板归类|看板分类|源记录|统计口径|确认前请补充费用信息/,
      )
      vm.form.title = '实际修改的业务事项'
      await flushPromises()
      expect(vm.dirty).toBe(true)
    } finally {
      w.unmount()
    }
  })
  it('缺金额不能确认，已登记零元保留确认入口并交由原流程核对说明', async () => {
    vi.mocked(getCosts).mockResolvedValueOnce({
      ...empty,
      total: 2,
      missingAmountCount: 1,
      items: [
        record({ amount: null } as CostCommand),
        { ...record({ amount: 0 } as CostCommand), id: '2', documentNo: 'CST2' },
      ],
    })
    const w = await mountView()
    try {
      const buttons = w.findAll('button').filter((button) => button.text() === '确认')
      expect(buttons).toHaveLength(2)
      expect(buttons[0]!.attributes('disabled')).toBeDefined()
      expect(buttons[0]!.attributes('title')).toBe('补齐金额后可确认')
      expect(buttons[1]!.attributes('disabled')).toBeUndefined()
      expect(w.text()).toContain('已登记金额（已知部分）')
      expect(w.text()).toContain('另有 1 条金额待补，未计入小计')
    } finally {
      w.unmount()
    }
  })
  it('业务经办按待补、待确认和作废处理记录，并保留运输环节筛选', async () => {
    const w = await mountView()
    try {
      await w
        .findAll('button')
        .find((b) => b.text() === '中心仓 → 城市仓')!
        .trigger('click')
      await flushPromises()
      for (const [label, query] of [
        ['待补金额', { missingAmount: true }],
        ['待确认', { statusCode: 'DRAFT' }],
        ['已确认', { statusCode: 'CONFIRMED' }],
        ['已作废', { statusCode: 'VOID' }],
        ['全部记录', {}],
      ] as const) {
        await w
          .get('[aria-label="按处理阶段查看费用"]')
          .findAll('button')
          .find((b) => b.text() === label)!
          .trigger('click')
        await flushPromises()
        const last = vi.mocked(getCosts).mock.calls.at(-1)![1]
        expect(last).toEqual({ begin: 0, step: 20, typeCode: 'TRANSFER', ...query })
      }
      expect(w.text()).toContain('按当前筛选汇总，金额不含作废记录')
      expect(w.text()).toContain('待补金额不按 0 元计算')
    } finally {
      w.unmount()
    }
  })
  it('查询失败后不会把旧记录数和旧汇总误当作当前结果', async () => {
    vi.mocked(getCosts).mockResolvedValueOnce({
      ...empty,
      total: 3,
      registeredAmount: 1200,
      confirmedAmount: 1200,
      missingAmountCount: 1,
      pendingCount: 1,
    })
    const w = await mountView()
    try {
      vi.mocked(getCosts).mockRejectedValueOnce(new Error('测试网络失败'))
      await w
        .findAll('button')
        .find((b) => b.text() === '刷新')!
        .trigger('click')
      await flushPromises()
      expect(w.text()).toContain('测试网络失败')
      expect(w.text()).not.toContain('共 3 条记录')
      expect(w.find('.cost-summary').exists()).toBe(false)
    } finally {
      w.unmount()
    }
  })
  it('营销人员可直接维护投放渠道和服务期间，不藏在可选补充信息中', async () => {
    state.route.path = '/supply-chain/cost/marketing'
    const w = await mountView()
    try {
      await w
        .findAll('button')
        .find((b) => b.text() === '新增营销费用')!
        .trigger('click')
      await flushPromises()
      expect(w.get('.cost-editor').text()).toContain('投放与合作信息')
      const channel = w
        .get('.cost-editor')
        .findAll('.el-form-item')
        .find((item) => item.text().includes('投放渠道／平台'))!
      expect(channel.element.closest('.el-collapse')).toBeNull()
      await channel.get('input').setValue('测试投放平台')
      expect((w.vm as unknown as { form: CostCommand }).form.marketing?.channelName).toBe(
        '测试投放平台',
      )
      expect(w.text()).toContain('员工底薪、绩效、提成归入人力成本')
    } finally {
      w.unmount()
    }
  })
  it.each(['LINKED', 'MANUAL'] as const)(
    'opens purchase freight ready for %s party entry and saves without requiring a purchase order',
    async (partyMode) => {
      const w = await mountView()
      try {
        await w
          .findAll('button')
          .find((button) => button.text() === '新增运费')!
          .trigger('click')
        await flushPromises()
        const vm = w.vm as unknown as { form: CostCommand }
        expect(vm.form.logistics).toMatchObject({
          legCode: 'PURCHASE',
          entryMode: 'NONE',
          sourceIds: [],
          externalDocuments: [],
        })
        expect(w.get('.cost-editor').findComponent(DocumentSelect).exists()).toBe(false)
        expect(w.get('.cost-editor').findComponent(RouteSummary).exists()).toBe(false)
        const parties = w.getComponent(LogisticsParties)
        const values = [
          { label: '供应商（厂家）', id: 'S1', name: '供应商甲' },
          {
            label: '中心仓',
            id: 'W1',
            name: '收货中心仓',
            warehouseTypeCode: 'CENTER',
            address: '中心仓地址',
          },
        ]
        for (const row of values) {
          const entry = parties
            .findAllComponents(EntryMode)
            .find((component) => component.props('label') === row.label)!
          if (partyMode === 'MANUAL') {
            entry.vm.$emit('update:modelValue', 'MANUAL')
            await flushPromises()
            await entry.getComponent({ name: 'ElInput' }).get('input').setValue(row.name)
          } else {
            const selector = entry.getComponent(ReferenceSelect)
            selector.vm.$emit('update:modelValue', row.id)
            selector.vm.$emit('change', row)
            await flushPromises()
          }
        }
        Object.assign(vm.form, {
          cityCode: 'C1',
          cityName: '武汉',
          costDate: '2026-10-19',
          amount: 10,
        })
        vi.mocked(saveCost).mockImplementation(async (_category, _id, command) => record(command))
        await w
          .findAll('button')
          .find((button) => button.text() === '保存')!
          .trigger('click')
        await flushPromises()
        expect(saveCost).toHaveBeenCalledWith(
          'logistics',
          null,
          expect.objectContaining({
            logistics: expect.objectContaining({
              entryMode: 'NONE',
              sourceIds: [],
              externalDocuments: [],
              senderName: '供应商甲',
              receiverName: '收货中心仓',
              supplierId: partyMode === 'LINKED' ? 'S1' : null,
              targetWarehouseId: partyMode === 'LINKED' ? 'W1' : null,
              customerId: null,
              sourceWarehouseId: null,
            }),
          }),
        )
      } finally {
        w.unmount()
      }
    },
  )

  it('saves manual goods and supplier names without the IDs cached by existing-record selection', async () => {
    state.route.path = '/supply-chain/cost/purchases'
    const w = await mountView()
    try {
      const vm = w.vm as unknown as { form: CostCommand }
      vm.form = {
        ...vm.form,
        title: '进货记录',
        cityCode: 'C1',
        cityName: '武汉',
        costDate: '2026-10-19',
        amount: 10,
        goods: {
          ...vm.form.goods!,
          productId: '1',
          variantId: '2',
          productName: '系统商品',
          specification: 'H',
          unit: 'BOX',
          supplierId: 'S1',
          supplierName: '系统供应商',
          unitPrice: 1,
          quantity: 10,
        },
      }
      await flushPromises()
      for (const label of ['商品', '供应商']) {
        const entry = w
          .findAllComponents(EntryMode)
          .find((component) => component.props('label') === label)!
        entry.vm.$emit('update:modelValue', 'MANUAL')
        await flushPromises()
        await entry
          .getComponent({ name: 'ElInput' })
          .get('input')
          .setValue('实际' + label)
      }
      vi.mocked(saveCost).mockImplementation(async (_category, _id, command) => record(command))
      await w
        .findAll('button')
        .find((button) => button.text() === '保存')!
        .trigger('click')
      await flushPromises()
      expect(saveCost).toHaveBeenCalledWith(
        'purchases',
        null,
        expect.objectContaining({
          goods: expect.objectContaining({
            productId: null,
            variantId: null,
            productName: '实际商品',
            specification: 'H',
            unit: 'BOX',
            supplierId: null,
            supplierName: '实际供应商',
          }),
        }),
      )
    } finally {
      w.unmount()
    }
  })

  it('saves a manually entered marketing owner with no employee or department association', async () => {
    state.route.path = '/supply-chain/cost/marketing'
    const w = await mountView()
    try {
      const vm = w.vm as unknown as { form: CostCommand }
      vm.form = {
        ...vm.form,
        title: '活动费用',
        typeCode: 'PROMOTION',
        cityCode: 'C1',
        cityName: '武汉',
        costDate: '2026-10-19',
        amount: 10,
        ownerEmployeeCode: 'E1',
        ownerName: '系统经办人',
        departmentId: 7,
      }
      await flushPromises()
      const entry = w.getComponent(EntryMode)
      entry.vm.$emit('update:modelValue', 'MANUAL')
      await flushPromises()
      await entry.getComponent({ name: 'ElInput' }).get('input').setValue('实际经办人')
      vi.mocked(saveCost).mockImplementation(async (_category, _id, command) => record(command))
      await w
        .findAll('button')
        .find((button) => button.text() === '保存')!
        .trigger('click')
      await flushPromises()
      expect(saveCost).toHaveBeenCalledWith(
        'marketing',
        null,
        expect.objectContaining({
          ownerEmployeeCode: null,
          ownerName: '实际经办人',
          departmentId: null,
        }),
      )
    } finally {
      w.unmount()
    }
  })

  it.each(['purchases', 'losses'])(
    '%s requires selecting a linked product specification before saving',
    async (category) => {
      state.route.path = '/supply-chain/cost/' + category
      const w = await mountView()
      try {
        const vm = w.vm as unknown as { form: CostCommand }
        Object.assign(vm.form.goods!, { productId: '1', variantId: null, specification: 'H' })
        await flushPromises()
        const save = w.findAll('button').find((b) => b.text() === '保存')!
        expect(save.attributes('disabled')).toBeDefined()
        await save.trigger('click')
        expect(saveCost).not.toHaveBeenCalled()
        vm.form.goods!.variantId = '30'
        await flushPromises()
        expect(save.attributes('disabled')).toBeUndefined()
        Object.assign(vm.form.goods!, { productId: null, variantId: null })
        await flushPromises()
        expect(save.attributes('disabled')).toBeUndefined()
      } finally {
        w.unmount()
      }
    },
  )

  it.each([
    ['purchases', ['商品与供应商', '进货信息', '来源与补充']],
    ['losses', ['损耗对象', '损耗情况', '来源与补充', '损耗照片与凭证']],
    ['warehouse-rentals', ['仓库信息', '本次租金']],
    ['office-rentals', ['办公室信息', '本次租金']],
    ['marketing', ['营销事项', '金额与经办', '投放与合作信息']],
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
    Object.assign(r, {
      createdBy: creator,
      updatedBy: modifier,
      createdTime: '2026-10-19T03:52:49.014886Z',
      updatedTime: '2026-10-19T06:02:28.392666Z',
    })
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
      const [, headers, values] = exportRows.mock.calls[0]!
      expect(
        Object.fromEntries(headers.map((key: string, index: number) => [key, values[0][index]])),
      ).toMatchObject({ 费用单号: 'CST1', 费用归属: '武汉', 金额: '' })
      expect(
        headers.some((label: string) =>
          ['录入人', '修改人', '录入时间', '修改时间', '单据来源'].includes(label),
        ),
      ).toBe(false)
      expect(JSON.stringify(values)).not.toMatch(/加载中|11111111|22222222|014886Z/)
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
        senderCode: 'SUPPLIER-CODE',
        targetWarehouseId: 'W1',
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
      const mode = w.findAllComponents({ name: 'ElRadioGroup' })[0]!
      mode.vm.$emit('update:modelValue', 'LINKED')
      mode.vm.$emit('change', 'LINKED')
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
      mode.vm.$emit('update:modelValue', 'NONE')
      mode.vm.$emit('change', 'NONE')
      await flushPromises()
      expect((w.vm as unknown as { form: CostCommand }).form.logistics).toMatchObject({
        sourceIds: [],
        supplierId: null,
        senderName: '食品供应商',
        targetWarehouseId: 'W1',
        receiverName: '一号中心仓',
      })
      const parties = w.getComponent(LogisticsParties)
      expect(
        parties
          .findAllComponents(EntryMode)
          .find((entry) => entry.props('label') === '供应商（厂家）')!
          .props('modelValue'),
      ).toBe('MANUAL')
      expect(
        parties
          .findAllComponents(EntryMode)
          .find((entry) => entry.props('label') === '中心仓')!
          .props('modelValue'),
      ).toBe('LINKED')

      // 混合来源换了供应商时，不保留上一家供应商的 ID，并回显单据中的真实名称。
      Object.assign((w.vm as unknown as { form: CostCommand }).form.logistics!, {
        supplierId: 'OLD',
        senderName: '原供应商',
      })
      mode.vm.$emit('update:modelValue', 'MIXED')
      mode.vm.$emit('change', 'MIXED')
      await flushPromises()
      const mixedSelect = w.getComponent(DocumentSelect).getComponent({ name: 'ElSelect' })
      mixedSelect.vm.$emit('visible-change', true)
      await flushPromises()
      mixedSelect.vm.$emit('update:modelValue', ['P1'])
      mixedSelect.vm.$emit('change', ['P1'])
      await flushPromises()
      expect((w.vm as unknown as { form: CostCommand }).form.logistics).toMatchObject({
        supplierId: null,
        senderName: '食品供应商',
        targetWarehouseId: 'W1',
      })
      expect(
        w
          .getComponent(LogisticsParties)
          .findAllComponents(EntryMode)
          .find((entry) => entry.props('label') === '供应商（厂家）')!
          .getComponent({ name: 'ElInput' })
          .get('input').element.value,
      ).toBe('食品供应商')
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

  it('loads only cost presentation dictionaries for the dashboard', async () => {
    await loadCostDictionaries()
    const codes = vi.mocked(loadBusinessDictionaries).mock.calls.at(-1)![0].map((d) => d.code)
    expect(codes).toContain('REIMBURSEMENT_EXPENSE_TYPE')
    expect(codes).toContain('COST_LOGISTICS_LEG')
    expect(codes.some((code) => code.startsWith('PAYROLL_'))).toBe(false)
    expect(codes).not.toContain('COMMISSION_RECIPIENT_ROLE')
  })
})

describe('cost category business columns', () => {
  it.each([
    ['purchases', ['单据 / 归属', '商品 / 规格', '数量 × 单价', '供应商']],
    ['losses', ['商品 / 规格', '损耗数量', '损耗原因', '仓库／发生地点']],
    ['warehouse-rentals', ['仓库名称', '面积（㎡）', '单据 / 归属']],
    ['marketing', ['类型', '收款方／合作方', '经办人', '单据 / 归属']],
    ['office-rentals', ['办公室名称', '面积（㎡）', '单据 / 归属']],
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
  it.each([
    'purchases',
    'losses',
    'logistics',
    'warehouse-rentals',
    'office-rentals',
    'marketing',
    'expenses',
  ])('%s详情和历史快照异步显示员工姓名，操作时间显示北京时间到秒', async (category) => {
    state.route.path = `/supply-chain/cost/${category}`
    const r = {
      ...record({
        title: '审计展示测试',
        cityName: '测试城市',
        costDate: '2026-10-19',
        amount: 12,
      } as CostCommand),
      createdBy: creator,
      updatedBy: modifier,
      createdTime: '2026-10-19T03:52:49.014886Z',
      updatedTime: '2026-10-19T06:02:28.392666Z',
    }
    vi.mocked(getCosts).mockResolvedValue({ ...empty, total: 1, items: [r] })
    vi.mocked(getCostHistory).mockResolvedValue([
      {
        action: 'CONFIRM',
        actorId: modifier,
        reason: '测试确认',
        occurredTime: r.updatedTime,
        snapshot: r,
      },
      {
        action: 'CREATE',
        actorId: creator,
        reason: '测试录入',
        occurredTime: r.createdTime,
        snapshotJson: JSON.stringify(r),
      },
    ])
    const w = await mountView()
    try {
      await w
        .findAll('button')
        .find((button) => button.text() === 'CST1')!
        .trigger('click')
      await flushPromises()
      expect(w.text()).toContain('测试录入员工')
      expect(w.text()).toContain('测试修改员工')
      expect(w.text()).toContain('2026-10-19 11:52:49')
      expect(w.text()).toContain('2026-10-19 14:02:28')
      await w
        .findAll('button')
        .find((button) => button.text() === '记录')!
        .trigger('click')
      await flushPromises()
      expect(w.findAll('.el-timeline-item__timestamp').map((item) => item.text())).toEqual([
        '2026-10-19 14:02:28',
        '2026-10-19 11:52:49',
      ])
      expect(w.text()).toContain('操作人：测试修改员工')
      expect(w.text()).not.toMatch(/11111111|22222222|014886Z|392666Z/)
      expect(apiClient.post).toHaveBeenCalledTimes(1)
      expect(r.createdBy).toBe(creator)
      expect(r.updatedTime).toBe('2026-10-19T06:02:28.392666Z')
    } finally {
      w.unmount()
    }
  })
  it('费用附件上传人和上传时间与详情采用相同展示规则', async () => {
    vi.mocked(getCostAttachments).mockResolvedValue([
      {
        id: 'attachment',
        fileName: '测试凭证.pdf',
        contentType: 'application/pdf',
        size: 12,
        createdBy: creator,
        createdTime: '2026-10-19T03:52:49.014886Z',
      },
    ])
    const w = mount(Attachments, {
      props: { category: 'expenses', row: record({} as CostCommand), editable: false },
      global: { plugins: [ElementPlus] },
    })
    try {
      await flushPromises()
      expect(w.text()).toContain('测试录入员工')
      expect(w.text()).toContain('2026-10-19 11:52:49')
      expect(w.text()).not.toContain(creator)
    } finally {
      w.unmount()
    }
  })
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
