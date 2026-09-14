import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ElementPlus from 'element-plus'
import FeishuImportPage from '@/views/supply-chain/feishu/FeishuImportPage.vue'
import * as api from '@/api/core/feishu-import'

vi.mock('@/api/core/feishu-import', () => ({
  getFeishuImportBatches: vi.fn(),
  getFeishuImportTemplates: vi.fn().mockResolvedValue([]),
  getFeishuImportRunStatus: vi.fn(),
  runFeishuImportBundle: vi.fn(),
  preflightFeishuImportBundle: vi.fn(),
  preflightFeishuImportBundleFiles: vi.fn(),
}))

const batch = {
  batchId: 'history-batch', status: 'PARTIAL', originalFileName: 'source.xlsx',
  totalSheets: 1, totalRows: 2257, duplicateRows: 0, fileSizeBytes: 100,
  createdAt: '2026-09-09T10:31:00Z',
}
let wrapper: ReturnType<typeof mount> | undefined
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.getFeishuImportBatches).mockResolvedValue([batch] as never)
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})

async function openHistory() {
  wrapper = mount(FeishuImportPage, { attachTo: document.body, global: { plugins: [ElementPlus] } })
  await flushPromises()
  await wrapper.findAll('button').find((button) => button.text() === '查看结果')!.trigger('click')
  await flushPromises()
}

describe('Feishu import read-only history', () => {
  it('reads an existing result without submitting or replaying an import', async () => {
    vi.mocked(api.getFeishuImportRunStatus).mockResolvedValue({
      batchId: batch.batchId, status: 'PARTIAL', dryRun: false, totalRows: 2257,
      projectedRows: 2242, skippedRows: 0, waitingMappingRows: 15, failedRows: 0,
      executedAt: batch.createdAt,
      issueSummaries: [{ targetObjectType: 'SALES_ORDER', projectionStatus: 'WAITING_MAPPING', rowCount: 15, message: '待补齐归属' }],
      rows: [{ sheetName: '订单', rowNumber: 2, sourceDocumentNo: 'DD001', projectionStatus: 'WAITING_MAPPING', message: '待补齐归属' }],
    } as never)
    await openHistory()
    expect(api.getFeishuImportRunStatus).toHaveBeenCalledWith(batch.batchId, 2257)
    expect(api.runFeishuImportBundle).not.toHaveBeenCalled()
    expect(api.preflightFeishuImportBundle).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('DD001')
    expect(document.body.textContent).toContain('待补齐归属')
    expect(document.body.textContent).toContain('已读取明细 1 / 2257 行')
    expect(document.body.textContent).toContain('当前为部分明细')
  })
  it('shows a read failure without trying a re-import', async () => {
    vi.mocked(api.getFeishuImportRunStatus).mockRejectedValue(new Error('执行结果暂不可用'))
    await openHistory()
    expect(document.body.textContent).toContain('执行结果暂不可用')
    expect(api.runFeishuImportBundle).not.toHaveBeenCalled()
  })
  it('keeps skipped refunds separate from pending rows and supports searching', async () => {
    vi.mocked(api.getFeishuImportRunStatus).mockResolvedValue({
      batchId: batch.batchId, status: 'PARTIAL', dryRun: false, totalRows: 3,
      projectedRows: 0, skippedRows: 1, waitingMappingRows: 2, failedRows: 0,
      executedAt: batch.createdAt, issueSummaries: [],
      rows: [
        { sourceDocumentNo: 'REFUND-001', projectionStatus: 'SKIPPED', message: '退款排除' },
        { sourceDocumentNo: 'PENDING-001', projectionStatus: 'PENDING', message: '待执行' },
        { sourceDocumentNo: 'MAPPING-001', projectionStatus: 'WAITING_MAPPING', message: '待补齐' },
      ],
    } as never)
    await openHistory()
    // The drawer is teleported, so select its controls from the rendered DOM.
    const pending = document.querySelector<HTMLInputElement>('input[value="WAITING_MAPPING"]')!
    pending.click()
    await flushPromises()
    expect(document.body.textContent).toContain('PENDING-001')
    expect(document.body.textContent).toContain('MAPPING-001')
    expect(document.body.textContent).not.toContain('REFUND-001')
    document.querySelector<HTMLInputElement>('input[value="SKIPPED"]')!.click()
    await flushPromises()
    expect(document.body.textContent).toContain('REFUND-001')
    expect(document.body.textContent).not.toContain('PENDING-001')
    const search = document.querySelector<HTMLInputElement>('input[aria-label="搜索历史导入明细"]')!
    search.value = 'no-match'
    search.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    expect(document.body.textContent).not.toContain('REFUND-001')
    expect(api.runFeishuImportBundle).not.toHaveBeenCalled()
  })
})
