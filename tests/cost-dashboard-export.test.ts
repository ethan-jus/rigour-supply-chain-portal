import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { useCostDashboardExport } from '@/views/supply-chain/bi/cost/use-cost-dashboard-export'
import type { CostExport, CostQuery } from '@/api/core/bi-cost-dashboard'

const api = vi.hoisted(() => ({
  createCostExport: vi.fn(),
  getCostExport: vi.fn(),
  cancelCostExport: vi.fn(),
  downloadCostExport: vi.fn(),
  exportCostDashboardWorkbook: vi.fn(),
}))
vi.mock('@/api/core/bi-cost-dashboard', () => api)
vi.mock('@/views/supply-chain/bi/cost/cost-report-export', () => ({
  exportCostDashboardWorkbook: api.exportCostDashboardWorkbook,
}))
const task = (id: string, status = 'READY'): CostExport => ({
  id,
  status,
  errorCode: null,
  rowCount: status === 'READY' ? 1 : null,
  downloadPath: null,
})
function setup() {
  const request = ref<CostQuery>({
    year: 2026,
    month: 10,
    city: 'COST_HEADQUARTERS',
    snapshotId: 's1',
  })
  let state!: ReturnType<typeof useCostDashboardExport>
  const wrapper = mount(
    defineComponent({
      setup() {
        state = useCostDashboardExport(request, ref([{ key: 'COST_HEADQUARTERS', label: '总部' }]))
        return () => h('div')
      },
    }),
  )
  return { state, request, wrapper }
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  api.createCostExport.mockResolvedValue(task('e1'))
  api.cancelCostExport.mockResolvedValue(undefined)
  api.exportCostDashboardWorkbook.mockResolvedValue(undefined)
})
afterEach(() => vi.useRealTimers())

describe('成本报表与筛选、快照保持一致', () => {
  it('exports the selected attribution and snapshot, retains it for paging, and clears it after refresh', async () => {
    const { state, request, wrapper } = setup()
    await state.startExport()
    expect(api.createCostExport).toHaveBeenCalledWith(
      expect.objectContaining({ city: 'COST_HEADQUARTERS', snapshotId: 's1' }),
    )
    expect(state.exportContext.value).toContain('总部')
    request.value = { ...request.value, page: 2, size: 50 }
    expect(state.exportTask.value?.id).toBe('e1')
    request.value = { ...request.value, snapshotId: undefined }
    expect(state.exportTask.value).toBeNull()
    expect(state.exportContext.value).toBe('')
    wrapper.unmount()
  })

  it('cancels a late task from an old scope without replacing the current export', async () => {
    const { state, request, wrapper } = setup()
    let resolve!: (value: CostExport) => void
    api.createCostExport.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const old = state.startExport()
    request.value = { ...request.value, city: 'WH' }
    api.createCostExport.mockResolvedValueOnce(task('new'))
    await state.startExport()
    resolve(task('old', 'RUNNING'))
    await old
    expect(api.cancelCostExport).toHaveBeenCalledWith('old')
    expect(state.exportTask.value?.id).toBe('new')
    expect(state.exportSubmitting.value).toBe(false)
    wrapper.unmount()
  })

  it('ignores an obsolete polling result and stops polling after changing filters', async () => {
    const { state, request, wrapper } = setup()
    api.createCostExport.mockResolvedValueOnce(task('old', 'RUNNING'))
    let resolve!: (value: CostExport) => void
    api.getCostExport.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    await state.startExport()
    await vi.advanceTimersByTimeAsync(2000)
    request.value = { ...request.value, search: '新费用' }
    resolve(task('old'))
    await flushPromises()
    await vi.advanceTimersByTimeAsync(4000)
    expect(state.exportTask.value).toBeNull()
    expect(api.cancelCostExport).toHaveBeenCalledWith('old')
    expect(api.getCostExport).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('does not download an old report when its filters change during retrieval', async () => {
    const { state, request, wrapper } = setup()
    await state.startExport()
    let resolve!: (value: Blob) => void
    api.downloadCostExport.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const downloading = state.downloadExport()
    request.value = { ...request.value, status: 'VOID' }
    resolve(new Blob(['old report']))
    await downloading
    expect(api.exportCostDashboardWorkbook).not.toHaveBeenCalled()
    expect(state.exportTask.value).toBeNull()
    expect(state.exportDownloading.value).toBe(false)
    wrapper.unmount()
  })

  it('does not let a late cancellation overwrite a newer task', async () => {
    const { state, request, wrapper } = setup()
    await state.startExport()
    let resolve!: () => void
    api.cancelCostExport.mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          resolve = done
        }),
    )
    const cancelling = state.cancelExport()
    request.value = { ...request.value, snapshotId: 's2' }
    api.createCostExport.mockResolvedValueOnce(task('new'))
    await state.startExport()
    resolve()
    await cancelling
    expect(state.exportTask.value?.id).toBe('new')
    expect(state.exportTask.value?.status).toBe('READY')
    wrapper.unmount()
  })
})
