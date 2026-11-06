import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { reactive } from 'vue'
import ElementPlus, { ElInputNumber, ElDatePicker, ElSelect, ElMessage } from 'element-plus'
import View from '@/views/supply-chain/cost/ProcurementCostRecordsView.vue'
import type { ProcurementCostRecord } from '@/api/core/procurement-costs'
const state = vi.hoisted(() => ({
  route: { query: {} as Record<string, string> },
  denied: new Set<string>(),
}))
const api = vi.hoisted(() => ({
  list: vi.fn(),
  detail: vi.fn(),
  confirm: vi.fn(),
  draft: vi.fn(),
  history: vi.fn(),
  cost: vi.fn(),
  transition: vi.fn(),
  workbook: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRoute: () => state.route }))
vi.mock('@/composables/useSupplyPermissions', () => ({
  useSupplyPermissions: () => ({ can: (p: string) => !state.denied.has(p) }),
}))
vi.mock('@/api/core/procurement-costs', () => ({
  getProcurementCosts: api.list,
  getProcurementCost: api.detail,
  confirmProcurementFreight: api.confirm,
  saveProcurementFreightDraft: api.draft,
  getProcurementCostHistory: api.history,
}))
vi.mock('@/api/core/cost', () => ({ getCost: api.cost, changeCostStatus: api.transition }))
vi.mock('@/views/supply-chain/cost/cost-export', () => ({ exportCostRows: api.workbook }))
vi.mock('@/utils/business-dictionary', () => ({
  loadBusinessDictionaries: async () => undefined,
  businessDictionaryOptions: () => [],
  businessDictionaryLabel: (_m: string, _c: string, value: string) => value || '—',
}))
const row = (overrides: Partial<ProcurementCostRecord> = {}): ProcurementCostRecord => ({
  orderId: 1,
  procurementNo: 'PO001',
  orderRevision: 2,
  supplierName: '华东食品供应有限公司',
  warehouseName: '武汉仓',
  purchaseDate: '2026-11-04',
  goodsAmount: 240,
  agreedFreightAmount: 18,
  freightBearerCode: 'BUYER',
  actualFreightAmount: null,
  freightRecordId: null,
  freightRevision: null,
  freightRecordStatus: null,
  freightStatus: 'PENDING',
  confirmedAmount: 240,
  lines: [],
  ...overrides,
})
let w: VueWrapper
const button = (text: string) => w.findAll('button').find((b) => b.text() === text)!
async function open() {
  w = mount(View, {
    global: {
      plugins: [ElementPlus],
      stubs: {
        CostAttachments: true,
        ElDialog: {
          props: ['modelValue', 'title'],
          template:
            '<section v-if="modelValue" class="dialog-probe"><h2>{{title}}</h2><slot/><slot name="footer"/></section>',
        },
      },
    },
  })
  await flushPromises()
}
beforeEach(() => {
  vi.resetAllMocks()
  state.route = reactive({ query: {} })
  state.denied.clear()
  api.list.mockResolvedValue({ total: 1, begin: 0, step: 20, items: [row()] })
  api.detail.mockResolvedValue(row())
  api.history.mockResolvedValue([])
  api.workbook.mockResolvedValue(undefined)
})
afterEach(() => {
  w?.unmount()
  ElMessage.closeAll()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})
describe('采购成本实际运费核实', () => {
  it('采购自定义字段只导出勾选记录，缺金额和实际0保持原义', async () => {
    const selected = row({ procurementNo: 'PO002', goodsAmount: null, actualFreightAmount: 0 })
    api.list.mockResolvedValue({ total: 2, begin: 0, step: 20, items: [row(), selected] })
    await open()
    const body = w
      .findAll('.el-table__body-wrapper tbody tr')
      .find((r) => r.text().includes('PO002'))!
    await body.get('input[type="checkbox"]').setValue(true)
    await button('自定义导出').trigger('click')
    await flushPromises()
    expect(w.find('.export-scope').text()).toContain('已勾选的 1 条记录')
    const fields = w.findAll('.export-fields input[type="checkbox"]')
    expect(fields).toHaveLength(10)
    for (const [i, field] of fields.entries())
      if (![0, 5, 7].includes(i)) await field.setValue(false)
    await button('开始导出').trigger('click')
    await flushPromises()
    expect(api.workbook).toHaveBeenLastCalledWith(
      '采购成本记录',
      ['采购单号', '货款（元）', '实际我方运费（元）'],
      [['PO002', '-', 0]],
    )
    await button('自定义导出').trigger('click')
    await flushPromises()
    expect(w.findAll('.export-fields input:checked')).toHaveLength(10)
    await button('清空').trigger('click')
    expect(button('开始导出').attributes('disabled')).toBeDefined()
  })
  it('约定金额不预填为实际运费，空金额或缺核实说明不可提交，明确0可以保存', async () => {
    await open()
    await button('确认').trigger('click')
    await flushPromises()
    expect(w.findComponent(ElInputNumber).props('modelValue')).toBeNull()
    await button('确认并计入采购成本').trigger('click')
    await flushPromises()
    expect(api.confirm).not.toHaveBeenCalled()
    w.findComponent(ElInputNumber).vm.$emit('update:modelValue', 0)
    await w.vm.$nextTick()
    await button('确认并计入采购成本').trigger('click')
    expect(api.confirm).not.toHaveBeenCalled()
    await w.get('textarea').setValue('厂家包邮，经核实无我方额外支出')
    api.confirm.mockResolvedValue(row({ actualFreightAmount: 0, freightStatus: 'CONFIRMED' }))
    await button('确认并计入采购成本').trigger('click')
    await flushPromises()
    expect(api.confirm).toHaveBeenCalledExactlyOnceWith(
      'PO001',
      expect.objectContaining({
        actualAmount: 0,
        orderRevision: 2,
        freightRevision: null,
        paymentStatusCode: 'UNKNOWN',
        reason: '厂家包邮，经核实无我方额外支出',
      }),
    )
  })
  it('原约定与承担方只读显示，金额未知显示横线，货款异常不阻止确认运费', async () => {
    const mismatch = row({
      goodsAmount: null,
      agreedFreightAmount: 18,
      freightBearerCode: 'SUPPLIER',
      confirmedAmount: null,
      sourceSystemCode: 'DINGHUOBAO',
      sourceDocumentNo: 'JH.20260901.0000',
      goodsSource: { issue: 'AMOUNT_MISMATCH', orderAmount: 99255.52, linesAmount: 109392 },
    })
    api.detail.mockResolvedValue(mismatch)
    api.list.mockResolvedValue({ total: 1, items: [mismatch] })
    await open()
    await button('查看').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('99,255.52')
    expect(w.text()).toContain('109,392.00')
    await button('确认').trigger('click')
    await flushPromises()
    const reference = w.get('.freight-reference')
    expect(reference.text()).toContain('采购单约定运费（元）')
    expect(reference.text()).toContain('18.00')
    expect(reference.text()).toContain('SUPPLIER')
    expect(reference.text()).toContain('JH.20260901.0000')
    expect(w.findComponent(ElInputNumber).props('modelValue')).toBeNull()
    w.findComponent(ElInputNumber).vm.$emit('update:modelValue', 0)
    await w.get('textarea').setValue('供应商承担运费，我方无支出')
    api.confirm.mockResolvedValue(mismatch)
    await button('确认并计入采购成本').trigger('click')
    await flushPromises()
    expect(api.confirm).toHaveBeenCalledWith('PO001', expect.objectContaining({ actualAmount: 0 }))
  })
  it('列表全部未知金额显示横线，明确0保留数值，确认状态和操作使用统一文案', async () => {
    api.list.mockResolvedValue({
      total: 2,
      items: [
        row({
          goodsAmount: null,
          agreedFreightAmount: null,
          actualFreightAmount: null,
          confirmedAmount: null,
        }),
        row({
          procurementNo: 'PO002',
          goodsAmount: 0,
          agreedFreightAmount: 0,
          actualFreightAmount: 0,
          confirmedAmount: 0,
          freightStatus: 'CONFIRMED',
          freightRecordId: 'C2',
          freightRecordStatus: 'CONFIRMED',
        }),
      ],
    })
    await open()
    const headers = w.findAll('th').map((cell) => cell.text())
    const rows = w.findAll('tr.el-table__row')
    for (const name of [
      '货款（元）',
      '采购单约定运费（元）',
      '实际我方运费（元）',
      '已明确成本（元）',
    ]) {
      const index = headers.indexOf(name)
      expect(rows[0]!.findAll('td')[index]!.text()).toBe('-')
      expect(rows[1]!.findAll('td')[index]!.text()).toBe('0.00')
    }
    expect(rows[0]!.text()).toContain('待确认')
    expect(rows[0]!.findAll('button').map((button) => button.text())).toContain('确认')
    expect(rows[1]!.text()).toContain('已确认')
    expect(rows[1]!.text()).toContain('撤销')
    expect(w.text()).not.toContain('暂无法合计')
    expect(w.text()).not.toContain('待核实')
  })
  it('订货宝折前明细与折后应付不同不标异常，成本按整单折后货款展示', async () => {
    const discounted = row({
      sourceSystemCode: 'DINGHUOBAO',
      sourceDocumentNo: 'JH.20260901.0000',
      goodsAmount: 99255.52,
      confirmedAmount: 99255.52,
      goodsSource: { issue: null, orderAmount: 99255.52, linesAmount: 109392 },
      lines: [
        {
          productName: '油泼辣子拌面',
          variantCode: 'SKU1',
          unitCode: 'BUCKET',
          quantity: 18420,
          unitPrice: 4,
          amount: 73680,
        },
      ],
    })
    api.list.mockResolvedValue({ total: 1, items: [discounted] })
    api.detail.mockResolvedValue(discounted)
    await open()
    expect(w.text()).toContain('99,255.52')
    expect(w.find('.el-tag').text()).toBe('待确认')
    expect(w.text()).not.toContain('来源金额不一致')
    await button('查看').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('折前小计（元）')
    expect(w.get('.dialog-probe .el-descriptions').text()).toContain('折后货款（元）')
    expect(w.get('.dialog-probe .el-descriptions').text()).toContain('99,255.52')
    expect(w.get('.dialog-probe .el-descriptions').text()).toContain('折前商品金额（元）')
    expect(w.text()).toContain('109,392.00')
    expect(w.text()).toContain('73,680.00')
  })
  it('没有约定运费时明确显示-，不把缺省值展示为0', async () => {
    api.detail.mockResolvedValue(row({ agreedFreightAmount: null }))
    await open()
    await button('确认').trigger('click')
    await flushPromises()
    const cells = w.get('.freight-reference').findAll('td')
    const quoteLabel = cells.findIndex((cell) => cell.text() === '采购单约定运费（元）')
    expect(cells[quoteLabel + 1]!.text()).toBe('-')
    expect(w.get('.freight-reference').text()).not.toContain('0.00')
  })
  it('保存失败保留输入，重复点击不产生并行核实', async () => {
    await open()
    await button('确认').trigger('click')
    await flushPromises()
    w.findComponent(ElInputNumber).vm.$emit('update:modelValue', 12.34)
    await w.get('textarea').setValue('按承运方账单核实')
    let reject!: (reason: Error) => void
    api.confirm.mockReturnValue(
      new Promise((_r, j) => {
        reject = j
      }),
    )
    await button('确认并计入采购成本').trigger('click')
    await button('确认并计入采购成本').trigger('click')
    expect(api.confirm).toHaveBeenCalledTimes(1)
    reject(new Error('仓库未维护业务归属地区'))
    await flushPromises()
    expect(w.findComponent(ElInputNumber).props('modelValue')).toBe(12.34)
    expect(w.get('textarea').element.value).toBe('按承运方账单核实')
    expect(w.text()).toContain('仓库未维护业务归属地区')
  })
  it('更正沿用运费版本；记录按采购单读取，包含作废前后的历史金额', async () => {
    const actual = row({
      actualFreightAmount: 12.34,
      freightRecordId: 'C2',
      freightRevision: 4,
      freightRecordStatus: 'DRAFT',
      freightStatus: 'PENDING',
    })
    api.list.mockResolvedValue({ total: 1, items: [actual] })
    api.detail.mockResolvedValue(actual)
    api.cost.mockResolvedValue({
      id: 'C2',
      revision: 4,
      statusCode: 'DRAFT',
      data: {
        requestId: 'R2',
        costDate: '2026-10-20',
        paymentStatusCode: 'PAID',
        amount: 12.34,
        reason: '上次确认依据',
      },
    })
    api.history.mockResolvedValue([
      {
        action: 'VOID',
        actorId: 'A',
        reason: '账单撤销',
        occurredTime: '2026-11-04T01:00:00Z',
        snapshot: { documentNo: 'C1', data: { amount: 15 } },
      },
      {
        action: 'CONFIRM',
        actorId: 'A',
        reason: '重新核实',
        occurredTime: '2026-11-04T02:00:00Z',
        snapshot: { documentNo: 'C2', data: { amount: 12.34 } },
      },
    ])
    await open()
    expect(w.find('.el-tag').text()).toBe('待确认')
    await button('确认').trigger('click')
    await flushPromises()
    expect(w.findComponent(ElInputNumber).props('modelValue')).toBe(12.34)
    expect(
      w
        .findAllComponents(ElDatePicker)
        .find((c) => c.props('type') === 'date')!
        .props('modelValue'),
    ).toBe('2026-10-20')
    expect(w.findAllComponents(ElSelect).some((c) => c.props('modelValue') === 'PAID')).toBe(true)
    expect(w.get('.previous-confirmation').text()).toContain('上次确认依据')
    expect(w.get('textarea').element.value).toBe('')
    expect(w.text()).toContain('确认采购实际运费')
    await w.get('textarea').setValue('更正说明')
    api.confirm.mockResolvedValue(actual)
    await button('确认并计入采购成本').trigger('click')
    await flushPromises()
    expect(api.confirm).toHaveBeenCalledWith(
      'PO001',
      expect.objectContaining({
        freightRevision: 4,
        costDate: '2026-10-20',
        paymentStatusCode: 'PAID',
        reason: '更正说明',
      }),
    )
    await button('查看').trigger('click')
    await flushPromises()
    await button('操作记录').trigger('click')
    await flushPromises()
    expect(api.history).toHaveBeenCalledWith('PO001')
    expect(w.text()).toContain('账单撤销')
    expect(w.text()).toContain('重新核实')
    expect(w.text()).toContain('C1')
  })
  it('首次确认仅展示一个业务动作，保留不同运费记录的独立新增审计', async () => {
    const confirmed = row({ freightStatus: 'CONFIRMED', freightRecordId: 'C1', freightRevision: 2 })
    api.list.mockResolvedValue({ total: 1, items: [confirmed] })
    api.detail.mockResolvedValue(confirmed)
    const create = {
      action: 'CREATE',
      actorId: 'A',
      reason: '包邮',
      occurredTime: '2026-11-05T01:00:00Z',
      snapshot: { id: 'C1', documentNo: 'CST1', data: { requestId: 'REQ1', amount: 0 } },
    }
    const data = [
      { ...create, action: 'CONFIRM' },
      create,
      { ...create, snapshot: { ...create.snapshot, id: 'C2', documentNo: 'CST2' } },
    ]
    api.history.mockResolvedValue(data)
    await open()
    await button('查看').trigger('click')
    await flushPromises()
    await button('操作记录').trigger('click')
    await flushPromises()
    const historyRows = w
      .findAll('.dialog-probe')
      .find((dialog) => dialog.text().includes('采购运费操作记录'))!
      .findAll('tr.el-table__row')
    expect(historyRows).toHaveLength(2)
    expect(historyRows[0]!.text()).toContain('确认')
    expect(historyRows[0]!.text()).toContain('CST1')
    expect(historyRows[1]!.text()).toContain('新增')
    expect(historyRows[1]!.text()).toContain('CST2')
    expect(data).toHaveLength(3)
  })
  it('更正原记录读取失败时不打开带默认值的表单', async () => {
    const confirmed = row({
      freightStatus: 'PENDING',
      freightRecordStatus: 'DRAFT',
      freightRecordId: 'C1',
      freightRevision: 2,
    })
    api.list.mockResolvedValue({ total: 1, items: [confirmed] })
    api.detail.mockResolvedValue(confirmed)
    api.cost.mockRejectedValue(new Error('运费原记录读取失败'))
    await open()
    await button('编辑').trigger('click')
    await flushPromises()
    expect(w.find('textarea').exists()).toBe(false)
    expect(api.confirm).not.toHaveBeenCalled()
  })
  it('导出使用已查询条件覆盖跨页全部结果，缺金额与明确0分开', async () => {
    await open()
    const input = w.findAll('.filters input')[0]!
    await input.setValue('PO0')
    await button('查询').trigger('click')
    await flushPromises()
    await input.setValue('尚未查询的新条件')
    const rows = Array.from({ length: 201 }, (_, i) =>
      row({ procurementNo: `PO${i}`, goodsAmount: i === 0 ? null : 0 }),
    )
    api.list.mockImplementation(async (q: { begin: number; step: number }) => ({
      total: 201,
      begin: q.begin,
      step: q.step,
      items: rows.slice(q.begin, q.begin + q.step),
    }))
    await button('自定义导出').trigger('click')
    await flushPromises()
    await button('开始导出').trigger('click')
    await flushPromises()
    expect(api.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ procurementNo: 'PO0', begin: 200, step: 200 }),
    )
    const exported = api.workbook.mock.calls[0]![2]
    expect(exported).toHaveLength(201)
    expect(exported[0][5]).toBe('-')
    expect(exported[1][5]).toBe(0)
    expect(exported[0][7]).toBe('-')
    expect(exported[0][8]).toBe('待确认')
  })
  it('无写入或确认权限仅可查看，原单跳转仍能打开自动采购成本详情', async () => {
    state.denied.add('erp:cost:purchase:confirm')
    state.route.query.sourceId = 'ORIGINAL'
    api.cost.mockResolvedValue({ procurementReference: { orderCode: 'PO001' }, data: {} })
    await open()
    expect(button('确认')).toBeUndefined()
    expect(api.cost).toHaveBeenCalledWith('purchases', 'ORIGINAL')
    expect(api.detail).toHaveBeenCalledWith('PO001')
    expect(w.text()).toContain('采购成本详情')
  })
})
