import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import ElementPlus, { ElCheckbox, ElSelect, ElRadioGroup, ElDatePicker } from 'element-plus'
import BiReconciliationCenter from '@/views/supply-chain/bi/components/BiReconciliationCenter.vue'
import * as api from '@/api/core/bi-reconciliation-review'
import * as imports from '@/api/core/feishu-import'
import * as exports from '@/views/supply-chain/bi/reconciliation-export'

const { canWrite, canReadOrders, push } = vi.hoisted(() => ({
  canWrite: { value: true },
  canReadOrders: { value: true },
  push: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    hasPermission: (permission: string) =>
      permission === 'order:read' ? canReadOrders.value : canWrite.value,
  }),
}))
vi.mock('@/views/supply-chain/bi/reconciliation-export', () => ({
  readReconciliationExport: vi.fn(),
  buildReconciliationExcel: vi.fn(),
}))
vi.mock('@/api/core/feishu-import', () => ({
  getFeishuImportBatches: vi.fn(),
  preflightFeishuImportBundleFiles: vi.fn(),
  runFeishuImportBundle: vi.fn(),
}))
vi.mock('@/api/core/bi-reconciliation-review', () => ({
  captureReconciliationReview: vi.fn(),
  getReconciliationReview: vi.fn(),
  getReconciliationHistory: vi.fn(),
  getOnlineReconciliationSources: vi.fn(),
  captureOnlineReconciliationSource: vi.fn(),
}))
const batch = {
  batchId: '11111111-1111-1111-1111-111111111111',
  status: 'PREFLIGHTED',
  originalFileName: 'current.xlsx',
  createdAt: '2026-09-12T09:00:00Z',
  totalRows: 2,
}
const fact = {
  key: 'ORDER|DD1',
  orderNo: 'DD1',
  kind: 'ORDER',
  city: '北京',
  sales: '销售甲',
  customer: '客户甲',
  amount: '100.125',
  paid: '0',
  unpaid: '100.125',
  quantity: '1',
  excludedRefund: false,
  uncertainties: [],
}
const page = {
  id: 'review',
  from: '2026-09-01T00:00:00Z',
  to: '2026-09-12T00:00:00Z',
  capturedAt: '2026-09-12T09:00:00Z',
  completedAt: '2026-09-12T09:00:01Z',
  sourceVersion: {
    fileName: 'current.xlsx',
    uploadedAt: '2026-09-12T09:00:00Z',
    checksum: 'a'.repeat(64),
  },
  previousVersion: null,
  onlineStatus: 'UNVERIFIED',
  status: 'UNVERIFIED',
  sourceDeclaredComplete: false,
  notices: ['只读快照，当前在线未验证'],
  sourceExportedAt: null,
  summary: {
    count: 1,
    matched: 0,
    differences: 0,
    unverified: 1,
    excluded: 0,
    sourceAmount: null,
    businessAmount: '100.125',
    biAmount: '100.125',
    sourcePaid: null,
    businessPaid: '0',
    biPaid: '0',
  },
  cities: [{ name: '北京', summary: { differences: 0 } }],
  sales: [],
  total: 1,
  page: 1,
  pageSize: 50,
  rows: [
    {
      key: fact.key,
      orderNo: 'DD1',
      kind: 'ORDER',
      city: '北京',
      sales: '销售甲',
      status: 'UNVERIFIED',
      versionStatus: 'NOT_COMPARED',
      source: null,
      business: fact,
      bi: fact,
      previous: null,
      issues: ['来源未验证'],
    },
  ],
}
let wrapper: ReturnType<typeof mount> | undefined
beforeEach(() => {
  vi.clearAllMocks()
  canWrite.value = true
  canReadOrders.value = true
  vi.mocked(imports.getFeishuImportBatches).mockResolvedValue([batch] as never)
  vi.mocked(api.captureReconciliationReview).mockResolvedValue(structuredClone(page) as never)
  vi.mocked(api.getReconciliationReview).mockResolvedValue(structuredClone(page) as never)
  vi.mocked(api.getReconciliationHistory).mockResolvedValue([])
  vi.mocked(api.getOnlineReconciliationSources).mockResolvedValue([
    { id: 'sales-source', name: '销售订单与明细', filtered: false },
  ])
  vi.mocked(api.captureOnlineReconciliationSource).mockResolvedValue({
    id: 'online-capture',
    complete: true,
    completedAt: '2026-09-14T02:30:00Z',
  } as never)
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})
async function ready() {
  wrapper = mount(BiReconciliationCenter, {
    props: { from: '2026-09-01T00:00:00Z', to: '2026-09-12T00:00:00Z' },
    attachTo: document.body,
    global: { plugins: [ElementPlus] },
  })
  await flushPromises()
  wrapper.findAllComponents(ElSelect)[1].vm.$emit('update:modelValue', batch.batchId)
  await flushPromises()
}
async function capture() {
  await ready()
  await wrapper!
    .findAll('button')
    .find((b) => b.text() === '生成复核')!
    .trigger('click')
  await flushPromises()
}
describe('BI reconciliation center', () => {
  it('keeps monetary differences independent from inferred units and unconfirmed SKU binding', async () => {
    vi.mocked(api.captureReconciliationReview).mockResolvedValue({
      ...structuredClone(page),
      rows: [
        {
          ...page.rows[0],
          kind: 'SKU',
          status: 'DIFF',
          financialStatus: 'DIFF',
          quantityStatus: 'UNVERIFIED',
          associationStatus: 'UNVERIFIED',
          source: {
            ...fact,
            kind: 'SKU',
            unit: '箱',
            unitEvidence: 'COLUMN_INFERRED',
            associationEvidence: 'EXACT_NAME_SPEC',
          },
          business: { ...fact, kind: 'SKU', unit: '桶', unitEvidence: 'SYSTEM' },
        },
      ],
    } as never)
    await capture()
    const text = wrapper!.get('.review-table').text()
    expect(text).toContain('金额核对')
    expect(text).toContain('数量 / 单位核对')
    expect(text).toContain('业务归属 / 商品关联')
    expect(text).toContain('存在差异')
    expect(text).not.toContain('由数量列名推断')
    expect(text).not.toContain('名称规格匹配（关联待确认）')
    expect(text).toContain('100.13')
    expect(text).not.toMatch(/COLUMN_INFERRED|EXACT_NAME_SPEC|UNVERIFIED/)
    await wrapper!
      .findAll('button')
      .find((button) => button.text() === '查看明细')!
      .trigger('click')
    await flushPromises()
    const details = document.body.textContent || ''
    expect(details).toContain('由数量列名推断')
    expect(details).toContain('名称规格匹配（关联待确认）')
    expect(details).toContain('未进行数量换算')
  })
  it('shows an order money match without claiming its SKU assessment passed or aggregating header units', async () => {
    vi.mocked(api.captureReconciliationReview).mockResolvedValue({
      ...structuredClone(page),
      rows: [
        {
          ...page.rows[0],
          financialStatus: 'SNAPSHOT_MATCH',
          quantityStatus: 'NOT_APPLICABLE',
          associationStatus: 'UNVERIFIED',
        },
      ],
    } as never)
    await capture()
    const row = wrapper!.get('.review-table .el-table__body tr')
    expect(row.text()).toContain('所选快照一致')
    expect(row.text()).toContain('不适用（订单数量不汇总）')
    expect(row.text()).toContain('待核验')
    expect(row.text()).not.toContain('NOT_APPLICABLE')
  })
  it('marks missing and null historical dimensions as not evaluated even when the combined snapshot matches', async () => {
    vi.mocked(api.captureReconciliationReview).mockResolvedValue({
      ...structuredClone(page),
      rows: [
        {
          ...page.rows[0],
          status: 'SNAPSHOT_MATCH',
          financialStatus: null,
          associationStatus: null,
        },
      ],
    } as never)
    await capture()
    const text = wrapper!.get('.review-table').text()
    expect(text.match(/未单独评估/g)!.length).toBeGreaterThanOrEqual(3)
    expect(wrapper!.text()).toContain('历史记录未分项核验，请重新对账')
  })
  it('distinguishes review order counts from SKU comparison groups after drilldown', async () => {
    vi.mocked(api.getReconciliationReview).mockResolvedValue({
      ...structuredClone(page),
      total: 1915,
      summary: { ...page.summary, count: 2242, unverified: 327 },
      rows: [{ ...page.rows[0], kind: 'SKU' }],
    } as never)
    await capture()
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === 'DD1')!
      .trigger('click')
    await flushPromises()
    expect(wrapper!.get('.review-summary').text()).toContain('待核验订单（笔）327')
    expect(wrapper!.get('.detail-summary').text()).toContain('1915 个 SKU 比较组')
    expect(wrapper!.get('.review-table').text()).not.toContain('来源商品关联依据')
    expect(wrapper!.text()).not.toContain('327条')
  })
  it('opens the exact source order filter without issuing repair or capture writes', async () => {
    await capture()
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === '查看订单')!
      .trigger('click')
    expect(push).toHaveBeenCalledWith({
      name: 'SupplyOrderSalesOrders',
      query: { sourceOrderNo: 'DD1' },
    })
    expect(api.captureReconciliationReview).toHaveBeenCalledTimes(1)
    expect(imports.runFeishuImportBundle).not.toHaveBeenCalled()
  })
  it('hides the order link without order read permission', async () => {
    canReadOrders.value = false
    await capture()
    expect(wrapper!.text()).not.toContain('查看订单')
  })
  it('exports the applied query and reports incomplete reads without downloading a partial workbook', async () => {
    await capture()
    await wrapper!.get('input[aria-label="搜索对账明细"]').setValue('尚未查询的条件')
    vi.mocked(exports.readReconciliationExport).mockRejectedValueOnce(
      new Error('导出范围或分页结果不一致'),
    )
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === '导出当前筛选 Excel')!
      .trigger('click')
    await flushPromises()
    expect(exports.readReconciliationExport).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'review' }),
      { kind: 'ORDER', page: 1, pageSize: 50 },
    )
    expect(exports.buildReconciliationExcel).not.toHaveBeenCalled()
    expect(wrapper!.text()).toContain('导出范围或分页结果不一致')
    expect(wrapper!.get('.review-table').text()).toContain('100.13')
  })
  it('keeps calendar date selections and source export times in Shanghai time', async () => {
    await ready()
    const dates = wrapper!.findAllComponents(ElDatePicker)
    expect(dates[0]!.props('valueFormat')).toBe('YYYY-MM-DD')
    dates[0]!.vm.$emit('update:modelValue', ['2026-08-01', '2026-08-31'])
    dates[1]!.vm.$emit('update:modelValue', '2026-09-01T00:05:00')
    await flushPromises()
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === '生成复核')!
      .trigger('click')
    await flushPromises()
    expect(api.captureReconciliationReview).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '2026-08-01T00:00:00+08:00',
        to: '2026-08-31T23:59:59.999999+08:00',
        sourceExportedAt: '2026-09-01T00:05:00+08:00',
      }),
    )
  })

  async function chooseOnline() {
    await ready()
    const mode = wrapper!
      .findAllComponents(ElRadioGroup)
      .find((group) => group.attributes('aria-label') === '对账来源方式')!
    mode.vm.$emit('update:modelValue', 'ONLINE')
    mode.vm.$emit('change', 'ONLINE')
    await flushPromises()
    const source = wrapper!.findAllComponents(ElSelect)[1]
    source.vm.$emit('update:modelValue', 'sales-source')
    await flushPromises()
  }
  it('does not report a missing source binding when this account cannot read sources', async () => {
    canWrite.value = false
    await chooseOnline()
    expect(api.getOnlineReconciliationSources).not.toHaveBeenCalled()
    expect(wrapper!.text()).toContain('当前账号仅可查看复核记录')
    expect(wrapper!.text()).not.toContain('尚未配置本租户')
  })
  it('captures only a bound online source, then compares the immutable capture without importing', async () => {
    await chooseOnline()
    await wrapper!
      .findAll('button')
      .find((button) => button.text() === '采集并复核')!
      .trigger('click')
    await flushPromises()
    expect(api.captureOnlineReconciliationSource).toHaveBeenCalledWith('sales-source')
    expect(api.captureReconciliationReview).toHaveBeenCalledWith(
      expect.objectContaining({
        onlineCaptureId: 'online-capture',
        batchId: undefined,
        sourceDeclaredComplete: false,
        sourceExportedAt: undefined,
      }),
    )
    expect(imports.runFeishuImportBundle).not.toHaveBeenCalled()
    expect(imports.preflightFeishuImportBundleFiles).not.toHaveBeenCalled()
  })
  it('does not compare an incomplete online capture or fall back to an older uploaded file', async () => {
    vi.mocked(api.captureOnlineReconciliationSource).mockResolvedValue({
      id: 'partial',
      complete: false,
    } as never)
    await chooseOnline()
    await wrapper!
      .findAll('button')
      .find((button) => button.text() === '采集并复核')!
      .trigger('click')
    await flushPromises()
    expect(wrapper!.text()).toContain('飞书分页未完整')
    expect(api.captureReconciliationReview).not.toHaveBeenCalled()
    expect(wrapper!.text()).not.toContain('重试已采集版本的复核')
  })
  it('retries saved evidence without recapturing Feishu after a BI failure', async () => {
    vi.mocked(api.captureReconciliationReview).mockRejectedValueOnce({
      code: 'SERVICE_UNAVAILABLE',
      message: '服务暂不可用，请稍后重试',
      details: [{ reason: 'BI_ONLINE_SOURCE_READ_NOT_PROVISIONED' }],
    })
    await chooseOnline()
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === '采集并复核')!
      .trigger('click')
    await flushPromises()
    expect(wrapper!.text()).toContain('BI 服务尚未配置在线采集来源的只读权限')
    expect(wrapper!.text()).toContain('复核结果尚未确认')
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === '重试已采集版本的复核')!
      .trigger('click')
    await flushPromises()
    expect(api.captureOnlineReconciliationSource).toHaveBeenCalledTimes(1)
    expect(api.captureReconciliationReview).toHaveBeenCalledTimes(2)
    expect(api.captureReconciliationReview).toHaveBeenLastCalledWith(
      expect.objectContaining({ onlineCaptureId: 'online-capture', batchId: undefined }),
    )
    expect(wrapper!.text()).not.toContain('复核尚未完成')
    expect(imports.runFeishuImportBundle).not.toHaveBeenCalled()
  })
  it('does not offer another source capture as the current source retry', async () => {
    vi.mocked(api.getOnlineReconciliationSources).mockResolvedValue([
      { id: 'sales-source', name: '销售订单', filtered: false },
      { id: 'another-source', name: '另一来源', filtered: false },
    ])
    vi.mocked(api.captureReconciliationReview).mockRejectedValueOnce(new Error('暂时不可用'))
    await chooseOnline()
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === '采集并复核')!
      .trigger('click')
    await flushPromises()
    wrapper!.findAllComponents(ElSelect)[1]!.vm.$emit('update:modelValue', 'another-source')
    await flushPromises()
    expect(wrapper!.text()).not.toContain('重试已采集版本的复核')
  })
  it('shows permission/service failures as failures, not a no-source success', async () => {
    vi.mocked(api.getOnlineReconciliationSources).mockRejectedValue(new Error('飞书来源授权不可用'))
    await chooseOnline()
    expect(wrapper!.text()).toContain('飞书来源授权不可用')
    expect(
      wrapper!
        .findAll('button')
        .find((button) => button.text() === '采集并复核')!
        .attributes('disabled'),
    ).toBeDefined()
    expect(api.captureOnlineReconciliationSource).not.toHaveBeenCalled()
  })
  it('labels online evidence as a capture window without claiming live consistency', async () => {
    vi.mocked(api.captureReconciliationReview).mockResolvedValue({
      ...structuredClone(page),
      onlineStatus: 'CAPTURED_NON_ATOMIC',
      sourceVersion: {
        ...page.sourceVersion,
        onlineEvidence: {
          sourceId: 'sales-source',
          startedAt: '2026-09-14T00:00:00Z',
          completedAt: '2026-09-14T00:01:00Z',
          complete: true,
          filtered: false,
          pageCount: 4,
          recordCount: 1700,
          atomic: false,
        },
      },
    } as never)
    await chooseOnline()
    await wrapper!
      .findAll('button')
      .find((button) => button.text() === '采集并复核')!
      .trigger('click')
    await flushPromises()
    await wrapper!
      .findAll('button')
      .find((button) => button.text() === '来源与口径')!
      .trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('在线版本已采集，非实时一致性保证')
    expect(wrapper!.text()).not.toContain('当前在线：未验证')
    expect(wrapper!.text()).not.toContain('在线一致')
  })
  it('never presents a matching uploaded snapshot as verified current online Feishu', async () => {
    vi.mocked(api.captureReconciliationReview).mockResolvedValue({
      ...structuredClone(page),
      status: 'SNAPSHOT_MATCH',
      onlineStatus: 'UNVERIFIED',
      sourceDeclaredComplete: true,
    } as never)
    await capture()
    expect(wrapper!.text()).toContain('所选快照一致')
    await wrapper!
      .findAll('button')
      .find((button) => button.text() === '来源与口径')!
      .trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('当前在线：未验证')
    expect(wrapper!.text()).not.toContain('在线一致')
    expect(imports.runFeishuImportBundle).not.toHaveBeenCalled()
  })
  it('creates a named snapshot with explicit scope without executing a source import', async () => {
    await capture()
    expect(api.captureReconciliationReview).toHaveBeenCalledWith(
      expect.objectContaining({ batchId: batch.batchId, sourceDeclaredComplete: false }),
    )
    expect(wrapper!.text()).toContain('复核来源：current.xlsx')
    expect(wrapper!.text()).toContain('未核实')
    expect(wrapper!.text()).toContain('100.13')
    expect(wrapper!.text()).not.toContain('100.125')
    expect(imports.runFeishuImportBundle).not.toHaveBeenCalled()
  })
  it('reads selected-order SKU detail with a GET against the frozen review', async () => {
    await capture()
    await wrapper!
      .findAll('button')
      .find((b) => b.text() === 'DD1')!
      .trigger('click')
    await flushPromises()
    expect(api.getReconciliationReview).toHaveBeenLastCalledWith(
      'review',
      expect.objectContaining({ orderNo: 'DD1', kind: 'SKU', page: 1, pageSize: 50 }),
    )
    expect(imports.runFeishuImportBundle).not.toHaveBeenCalled()
    expect(api.captureReconciliationReview).toHaveBeenCalledTimes(1)
  })
  it('uploads to preflight only and does not imply a full export or execute it', async () => {
    vi.mocked(imports.preflightFeishuImportBundleFiles).mockResolvedValue({
      batchId: batch.batchId,
      status: 'PREFLIGHTED',
    } as never)
    await ready()
    const input = wrapper!.get('input[type=file]')
    const file = new File(['fixture'], 'source.xlsx')
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushPromises()
    expect(imports.preflightFeishuImportBundleFiles).toHaveBeenCalledWith([file])
    expect(imports.runFeishuImportBundle).not.toHaveBeenCalled()
    expect(api.captureReconciliationReview).not.toHaveBeenCalled()
  })
  it('selects a newly preflighted multi-file version and resets the completeness declaration', async () => {
    const uploadedBatch = {
      ...batch,
      batchId: '22222222-2222-2222-2222-222222222222',
      originalFileName: 'orders.xlsx, lines.xlsx',
    }
    vi.mocked(imports.preflightFeishuImportBundleFiles).mockResolvedValue(uploadedBatch as never)
    await ready()
    wrapper!.findComponent(ElCheckbox).vm.$emit('update:modelValue', true)
    await flushPromises()
    vi.mocked(imports.getFeishuImportBatches).mockResolvedValue([uploadedBatch, batch] as never)
    const files = [new File(['orders'], 'orders.xlsx'), new File(['lines'], 'lines.xlsx')]
    const input = wrapper!.get('input[type=file]')
    Object.defineProperty(input.element, 'files', { value: files, configurable: true })
    await input.trigger('change')
    await flushPromises()
    expect(imports.preflightFeishuImportBundleFiles).toHaveBeenCalledWith(files)
    expect(wrapper!.findAllComponents(ElSelect)[1].props('modelValue')).toBe(uploadedBatch.batchId)
    expect(wrapper!.findComponent(ElCheckbox).props('modelValue')).toBe(false)
    expect(api.captureReconciliationReview).not.toHaveBeenCalled()
    expect(imports.runFeishuImportBundle).not.toHaveBeenCalled()
  })
  it('shows rejected preflight issues without generating a review or running an import', async () => {
    const rejectedBatch = { ...batch, status: 'REJECTED' }
    vi.mocked(imports.preflightFeishuImportBundleFiles).mockResolvedValue(rejectedBatch as never)
    await ready()
    vi.mocked(imports.getFeishuImportBatches).mockResolvedValue([rejectedBatch] as never)
    const input = wrapper!.get('input[type=file]')
    Object.defineProperty(input.element, 'files', {
      value: [new File(['invalid'], 'incomplete.xlsx')],
      configurable: true,
    })
    await input.trigger('change')
    await flushPromises()
    expect(wrapper!.text()).toContain('文件预检未通过')
    expect(wrapper!.text()).toContain('未执行导入')
    expect(wrapper!.text()).not.toContain('所选快照一致')
    expect(api.captureReconciliationReview).not.toHaveBeenCalled()
    expect(imports.runFeishuImportBundle).not.toHaveBeenCalled()
  })
  it('preserves a structured preflight API error without treating the upload as a new version', async () => {
    vi.mocked(imports.preflightFeishuImportBundleFiles).mockRejectedValue({
      code: 'BAD_REQUEST',
      message: '来源文件缺少订单编号列',
    })
    await ready()
    const input = wrapper!.get('input[type=file]')
    Object.defineProperty(input.element, 'files', {
      value: [new File(['invalid'], 'source.xlsx')],
      configurable: true,
    })
    await input.trigger('change')
    await flushPromises()
    expect(wrapper!.text()).toContain('来源文件缺少订单编号列')
    expect(wrapper!.findAllComponents(ElSelect)[1].props('modelValue')).toBe(batch.batchId)
    expect(imports.getFeishuImportBatches).toHaveBeenCalledTimes(1)
    expect(api.captureReconciliationReview).not.toHaveBeenCalled()
    expect(imports.runFeishuImportBundle).not.toHaveBeenCalled()
  })
  it('disables evidence capture for callers without the independent write permission', async () => {
    canWrite.value = false
    await ready()
    const button = wrapper!.findAll('button').find((b) => b.text() === '生成复核')!
    expect(button.attributes('disabled')).toBeDefined()
    expect(wrapper!.text()).toContain('当前账号仅可查看复核记录')
    await button.trigger('click')
    await flushPromises()
    expect(api.captureReconciliationReview).not.toHaveBeenCalled()
  })
  it('keeps service failure distinct from an empty or passing report', async () => {
    vi.mocked(api.captureReconciliationReview).mockRejectedValue(new Error('对账服务未就绪'))
    await capture()
    expect(wrapper!.text()).toContain('对账服务未就绪')
    expect(wrapper!.text()).not.toContain('所选快照一致')
    expect(wrapper!.find('.review-table').exists()).toBe(false)
  })
  it('clears stale results after a failed filtered read and retries without recapturing', async () => {
    await capture()
    vi.mocked(api.getReconciliationReview).mockRejectedValueOnce(new Error('查询失败'))
    await wrapper!
      .findAll('button')
      .find((button) => button.text() === 'DD1')!
      .trigger('click')
    await flushPromises()
    expect(wrapper!.find('.review-table').exists()).toBe(false)
    expect(wrapper!.text()).toContain('查询失败')
    await wrapper!
      .findAll('button')
      .find((button) => button.text() === '重试读取复核')!
      .trigger('click')
    await flushPromises()
    expect(wrapper!.find('.review-table').exists()).toBe(true)
    expect(api.captureReconciliationReview).toHaveBeenCalledTimes(1)
    expect(api.getReconciliationReview).toHaveBeenCalledTimes(2)
    expect(imports.runFeishuImportBundle).not.toHaveBeenCalled()
  })
  it('opens a previous immutable review with read permission only', async () => {
    canWrite.value = false
    vi.mocked(api.getReconciliationHistory).mockResolvedValue([
      { id: 'review', fileName: 'source.xlsx', capturedAt: page.capturedAt, status: 'UNVERIFIED' },
    ])
    await ready()
    const select = wrapper!.findAllComponents(ElSelect)[0]
    select.vm.$emit('update:modelValue', 'review')
    select.vm.$emit('change', 'review')
    await flushPromises()
    expect(api.getReconciliationReview).toHaveBeenCalledWith(
      'review',
      expect.objectContaining({ kind: 'ORDER', page: 1 }),
    )
    expect(api.captureReconciliationReview).not.toHaveBeenCalled()
    expect(imports.runFeishuImportBundle).not.toHaveBeenCalled()
  })
})
