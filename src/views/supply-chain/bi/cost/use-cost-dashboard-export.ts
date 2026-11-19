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
import { categories, statusName } from './cost-presentation'

/** A downloadable task belongs to the exact filters and snapshot that created it. */
export function useCostDashboardExport(
  request: Readonly<Ref<CostQuery>>,
  cities: Ref<CostReport['cities']>,
  onDownloadStarted?: () => void,
) {
  const exportTask = ref<CostExport | null>(null),
    exportError = ref(''),
    exportSubmitting = ref(false),
    exportDownloading = ref(false),
    exportCancelling = ref(false),
    exportContext = ref('')
  const exportPreparing = computed(
    () => !!exportTask.value && ['PENDING', 'RUNNING'].includes(exportTask.value.status),
  )
  const exportBusy = computed(
    () => exportSubmitting.value || exportPreparing.value || exportDownloading.value,
  )
  const canCancelExport = computed(() => exportPreparing.value && !exportCancelling.value)
  const exportLabel = computed(() =>
    exportCancelling.value
      ? '正在取消导出…'
      : exportBusy.value
        ? '正在生成 Excel…'
        : exportTask.value?.status === 'CANCELLED'
          ? '导出已取消'
          : exportTask.value?.status === 'FAILED'
            ? '导出失败，请重试'
            : '',
  )
  let exportTimer: ReturnType<typeof setTimeout> | undefined,
    disposed = false,
    exportGeneration = 0
  let exportFields: string[] | undefined
  async function startExport(fields?: string[]) {
    if (exportBusy.value) return
    if (fields && !fields.length) {
      exportError.value = '请至少选择一个导出字段'
      return
    }
    const selectedFields = fields ? [...fields] : undefined
    const generation = ++exportGeneration
    exportSubmitting.value = true
    exportError.value = ''
    const query = { ...request.value }
    const context = [
      `${query.year}年${query.month === 0 ? '全年' : `${query.month}月`}`,
      query.periodSide === 'previous' ? '可比期' : '本期',
      query.city
        ? cities.value.find((city) => city.key === query.city)?.label || '所选费用归属'
        : '全部授权归属',
      query.category
        ? categories[query.category]
        : query.scope === 'purchase'
          ? '采购成本'
          : query.scope === 'loss'
            ? '商品损耗'
            : '经营费用',
      query.payment && query.payment !== 'ALL' ? statusName(query.payment) : '全部付款状态',
      query.search ? `搜索：${query.search}` : '',
    ]
      .filter(Boolean)
      .join(' / ')
    try {
      const task = await createCostExport(query)
      if (disposed || generation !== exportGeneration) {
        if (['PENDING', 'RUNNING'].includes(task.status))
          void cancelCostExport(task.id).catch(() => {})
        return
      }
      exportContext.value = context
      exportFields = selectedFields
      handleTask(task, generation)
    } catch (e) {
      if (!disposed && generation === exportGeneration)
        exportError.value = errorMessage(e, '导出失败')
    } finally {
      if (generation === exportGeneration) exportSubmitting.value = false
    }
  }
  function handleTask(task: CostExport, generation: number) {
    exportTask.value = task
    if (task.status === 'READY') {
      void downloadExport(task.id, generation)
    } else {
      pollExport(generation)
    }
  }
  function pollExport(generation: number) {
    const taskId = exportTask.value?.id
    if (disposed || generation !== exportGeneration || !taskId || !exportPreparing.value)
      return
    exportTimer = setTimeout(async () => {
      try {
        const task = await getCostExport(taskId)
        if (generation !== exportGeneration || disposed) return
        handleTask(task, generation)
      } catch (e) {
        if (generation !== exportGeneration || disposed) return
        exportError.value = errorMessage(e, '导出状态读取失败')
        exportTask.value = null
      }
    }, 2000)
  }
  async function cancelExport() {
    if (!canCancelExport.value || !exportTask.value) return
    const generation = ++exportGeneration
    const task = exportTask.value
    clearTimeout(exportTimer)
    exportCancelling.value = true
    try {
      await cancelCostExport(task.id)
      if (disposed || generation !== exportGeneration) return
      exportTask.value = { ...task, status: 'CANCELLED' }
    } catch (e) {
      if (!disposed && generation === exportGeneration) {
        exportError.value = errorMessage(e, '取消导出失败')
        pollExport(generation)
      }
    } finally {
      if (generation === exportGeneration) exportCancelling.value = false
    }
  }
  async function downloadExport(taskId: string, generation: number) {
    const isCurrent = () => !disposed && generation === exportGeneration
    exportDownloading.value = true
    try {
      const blob = await downloadCostExport(taskId)
      if (!isCurrent()) return
      const { exportCostDashboardWorkbook } = await import('./cost-report-export')
      if (!isCurrent()) return
      await exportCostDashboardWorkbook(blob, exportContext.value, exportFields, isCurrent)
      if (isCurrent()) {
        exportError.value = ''
        onDownloadStarted?.()
      }
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
    exportFields = undefined
    exportSubmitting.value = false
    exportDownloading.value = false
    exportCancelling.value = false
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
    canCancelExport,
    exportLabel,
    startExport,
    cancelExport,
  }
}
