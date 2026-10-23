import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue'
import {
  cancelCostExport,
  createCostExport,
  downloadCostExport,
  getCostExport,
  type CostExport,
  type CostQuery,
  type CostReport,
} from '@/api/core/bi-cost-dashboard'
import { errorMessage } from '@/api/core/error'

/** A downloadable task belongs to the exact filters and snapshot that created it. */
export function useCostDashboardExport(
  request: Readonly<Ref<CostQuery>>,
  cities: Ref<CostReport['cities']>,
) {
  const exportTask = ref<CostExport | null>(null),
    exportError = ref(''),
    exportSubmitting = ref(false),
    exportDownloading = ref(false),
    exportContext = ref('')
  const exportBusy = computed(
    () => !!exportTask.value && ['PENDING', 'RUNNING'].includes(exportTask.value.status),
  )
  const exportLabel = computed(() =>
    exportTask.value?.status === 'READY'
      ? `导出完成，共 ${exportTask.value.rowCount} 笔匹配记录`
      : exportTask.value?.status === 'CANCELLED'
        ? '导出已取消'
        : exportTask.value?.status === 'FAILED'
          ? '导出失败，请重试'
          : '正在生成全部匹配单据…',
  )
  let exportTimer: ReturnType<typeof setTimeout> | undefined,
    disposed = false,
    exportGeneration = 0
  async function startExport() {
    if (exportBusy.value || exportSubmitting.value) return
    const generation = ++exportGeneration
    exportSubmitting.value = true
    exportError.value = ''
    const query = { ...request.value }
    const context = `${query.year}年${query.month === 0 ? '全年' : `${query.month}月`} / ${query.periodSide === 'previous' ? '可比期' : '本期'} / ${query.city ? cities.value.find((city) => city.key === query.city)?.label || query.city : '全部授权归属'}`
    try {
      const task = await createCostExport(query)
      if (disposed || generation !== exportGeneration) {
        if (['PENDING', 'RUNNING'].includes(task.status))
          void cancelCostExport(task.id).catch(() => {})
        return
      }
      exportTask.value = task
      exportContext.value = context
      pollExport(generation)
    } catch (e) {
      if (!disposed && generation === exportGeneration)
        exportError.value = errorMessage(e, '导出失败')
    } finally {
      if (generation === exportGeneration) exportSubmitting.value = false
    }
  }
  function pollExport(generation: number) {
    if (disposed || generation !== exportGeneration || !exportTask.value || !exportBusy.value)
      return
    exportTimer = setTimeout(async () => {
      try {
        const task = await getCostExport(exportTask.value!.id)
        if (generation !== exportGeneration || disposed) return
        exportTask.value = task
        pollExport(generation)
      } catch (e) {
        if (generation !== exportGeneration || disposed) return
        exportError.value = errorMessage(e, '导出状态读取失败')
        exportTask.value = null
      }
    }, 2000)
  }
  async function cancelExport() {
    if (!exportTask.value) return
    const generation = exportGeneration
    const task = exportTask.value
    try {
      await cancelCostExport(task.id)
      if (disposed || generation !== exportGeneration) return
      exportGeneration++
      clearTimeout(exportTimer)
      exportTask.value = { ...task, status: 'CANCELLED' }
    } catch (e) {
      if (!disposed && generation === exportGeneration)
        exportError.value = errorMessage(e, '取消导出失败')
    }
  }
  async function downloadExport() {
    if (!exportTask.value || exportDownloading.value) return
    const generation = exportGeneration
    exportDownloading.value = true
    try {
      const blob = await downloadCostExport(exportTask.value.id)
      if (disposed || generation !== exportGeneration) return
      const { exportCostDashboardWorkbook } = await import('./cost-report-export')
      if (!disposed && generation === exportGeneration) await exportCostDashboardWorkbook(blob)
    } catch (e) {
      if (!disposed && generation === exportGeneration)
        exportError.value = errorMessage(e, '下载失败，请重新导出')
    } finally {
      if (generation === exportGeneration) exportDownloading.value = false
    }
  }
  function resetExport() {
    const task = exportTask.value
    exportGeneration++
    clearTimeout(exportTimer)
    exportTask.value = null
    exportError.value = ''
    exportContext.value = ''
    exportSubmitting.value = false
    exportDownloading.value = false
    if (task && ['PENDING', 'RUNNING'].includes(task.status))
      void cancelCostExport(task.id).catch(() => {})
  }
  watch(
    () => {
      return JSON.stringify(
        Object.fromEntries(
          Object.entries(request.value).filter(([key]) => !['page', 'size'].includes(key)),
        ),
      )
    },
    resetExport,
    { flush: 'sync' },
  )
  onBeforeUnmount(() => {
    disposed = true
    resetExport()
  })
  return {
    exportTask,
    exportError,
    exportSubmitting,
    exportDownloading,
    exportContext,
    exportBusy,
    exportLabel,
    startExport,
    cancelExport,
    downloadExport,
  }
}
