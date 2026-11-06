import {
  computed,
  onActivated,
  onDeactivated,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from 'vue'
import { errorMessage } from '@/api/core/error'
import {
  getCostDetail,
  getCostWorkspace,
  getCostReport,
  type CostCategory,
  type CostDetail,
  type CostQuery,
  type CostRecord,
  type CostRecords,
  type CostReport,
  type CostScope,
} from '@/api/core/bi-cost-dashboard'
import { dimensions, resolveObjectLabels } from './cost-presentation'
import { loadCostDictionaries } from '../../cost/cost-dictionaries'
export function useCostDashboard() {
  const report = ref<CostReport | null>(null),
    records = ref<CostRecords | null>(null),
    error = ref(''),
    loading = ref(false)
  const section = ref<'overview' | 'analysis' | 'records'>('overview'),
    perspective = ref<'cities' | 'structure' | 'objects'>('cities')
  const filters = reactive<CostQuery>({
    compare: 'previous',
    scope: 'opex',
    status: 'CONFIRMED',
    payment: 'ALL',
    periodSide: 'current',
    page: 1,
    size: 20,
  })
  const drill = ref<CostQuery>({}),
    modalReport = ref<CostReport | null>(null),
    modalQuery = ref<CostQuery | null>(null),
    modalError = ref(''),
    modalLoading = ref(false)
  const recordSearch = ref('')
  const detail = ref<CostDetail | null>(null),
    detailOpen = ref(false),
    detailError = ref(''),
    detailLoading = ref(false)
  const cutoff = ref(''),
    snapshot = ref<string>(),
    cities = ref<CostReport['cities']>([]),
    available = ref<CostCategory[]>([])
  let generation = 0,
    controller: AbortController | undefined,
    modalGeneration = 0,
    modalController: AbortController | undefined
  const request = computed<CostQuery>(() => ({
    ...filters,
    ...(section.value === 'records' ? drill.value : {}),
    status: 'CONFIRMED',
    snapshotId: snapshot.value,
  }))
  function clearDrill() {
    drill.value = {}
    filters.search = undefined
    recordSearch.value = ''
    filters.periodSide = 'current'
    filters.page = 1
    filters.category = undefined
    filters.dimension = undefined
    filters.dimensionKey = undefined
    filters.missingAmount = false
    closeModal()
    detail.value = null
    detailOpen.value = false
  }
  async function load(resetSnapshot = false) {
    if (import.meta.env.VITE_COST_DASHBOARD_ENABLED === 'false') {
      report.value = null
      records.value = null
      error.value = '成本数据看板尚未开放'
      return
    }
    const serial = ++generation
    controller?.abort()
    controller = new AbortController()
    const signal = controller.signal
    if (resetSnapshot) snapshot.value = undefined
    loading.value = true
    error.value = ''
    report.value = null
    records.value = null
    try {
      const dictionaryReady = loadCostDictionaries(undefined, resetSnapshot)
      const q = { ...request.value }
      // 明细页由一次在线授权同时返回汇总和分页，避免重复权限和快照读取。
      const workspace = section.value === 'records' ? await getCostWorkspace(q, signal) : null
      const result = workspace?.report ?? (await getCostReport(q, signal))
      await dictionaryReady
      if (serial !== generation) return
      snapshot.value = result.meta.snapshotId
      cutoff.value = result.meta.effectiveCutoff
      available.value = result.meta.availableCategories
      cities.value = result.cities
      filters.year ??= Number(result.meta.period.from.slice(0, 4))
      filters.month ??= Number(result.meta.period.from.slice(5, 7))
      if (section.value === 'records') {
        const rows = workspace!.records
        if (serial !== generation) return
        if (rows.meta.snapshotId !== result.meta.snapshotId)
          throw new Error('费用数据批次不一致，请刷新后重试')
        records.value = rows
      }
      report.value = resolveObjectLabels(result)
    } catch (e) {
      if (serial === generation && !signal.aborted)
        error.value = errorMessage(e, '费用数据读取失败，请重试')
    } finally {
      if (serial === generation) loading.value = false
    }
  }
  function globalChange() {
    clearDrill()
    if (filters.month === 0) filters.compare = 'yoy'
    if (
      filters.year === Number(cutoff.value.slice(0, 4)) &&
      (filters.month ?? 0) > Number(cutoff.value.slice(5, 7))
    )
      filters.month = Number(cutoff.value.slice(5, 7))
    if (section.value === 'overview') filters.scope = 'opex'
    if (perspective.value === 'objects') setDefaultTopic()
    else if (filters.scope === 'purchase' && section.value === 'analysis') {
      filters.category = 'purchase'
      filters.dimension = 'component'
    }
    // 改筛选沿用当前完整批次；手动刷新及重新进入页面才重新核对来源。
    void load()
  }
  const activePeriod = computed(() => {
    const year = Number(cutoff.value.slice(0, 4)),
      month = Number(cutoff.value.slice(5, 7))
    if (filters.year === year && filters.month === 0) return 'year'
    if (filters.year === year && filters.month === month) return 'current'
    const previousYear = month === 1 ? year - 1 : year,
      previousMonth = month === 1 ? 12 : month - 1
    return filters.year === previousYear && filters.month === previousMonth ? 'previous' : undefined
  })
  function applyPeriod(preset: 'current' | 'previous' | 'year') {
    if (!cutoff.value) return
    const year = Number(cutoff.value.slice(0, 4)),
      month = Number(cutoff.value.slice(5, 7))
    filters.year = preset === 'previous' && month === 1 ? year - 1 : year
    filters.month =
      preset === 'year' ? 0 : preset === 'previous' ? (month === 1 ? 12 : month - 1) : month
    globalChange()
  }
  function setDefaultTopic() {
    filters.category = available.value.find(
      (k) => filters.scope === (k === 'purchase' || k === 'loss' ? k : 'opex'),
    )
    filters.dimension = filters.category ? dimensions[filters.category][0] : undefined
  }
  function goSection(value: typeof section.value) {
    section.value = value
    clearDrill()
    if (value === 'overview') filters.scope = 'opex'
    if (value === 'analysis' && perspective.value === 'objects') setDefaultTopic()
    else if (value === 'analysis' && filters.scope === 'purchase') {
      filters.category = 'purchase'
      filters.dimension = 'component'
    }
    void load()
  }
  function chooseScope(scope: CostScope) {
    filters.scope = scope
    clearDrill()
    if (section.value !== 'records') {
      section.value = 'analysis'
      perspective.value = scope === 'purchase' ? 'structure' : 'cities'
    }
    if (scope === 'purchase') {
      filters.category = 'purchase'
      filters.dimension = 'component'
    }
    void load()
  }
  function choosePerspective(value: typeof perspective.value) {
    perspective.value = value
    clearDrill()
    if (value === 'objects') setDefaultTopic()
    else if (filters.scope === 'purchase') {
      filters.category = 'purchase'
      filters.dimension = 'component'
    }
    void load()
  }
  function topicChange() {
    filters.dimension = filters.category ? dimensions[filters.category][0] : undefined
    filters.dimensionKey = undefined
    void load()
  }
  async function openAnalysis(extra: CostQuery) {
    const serial = ++modalGeneration
    modalController?.abort()
    modalController = new AbortController()
    const signal = modalController.signal
    modalQuery.value = {
      ...request.value,
      ...extra,
      status: 'CONFIRMED',
      payment: 'ALL',
      search: undefined,
      periodSide: 'current',
      page: 1,
    }
    modalReport.value = null
    modalError.value = ''
    modalLoading.value = true
    try {
      const result = await getCostReport(modalQuery.value, signal)
      if (serial === modalGeneration) modalReport.value = resolveObjectLabels(result)
    } catch (e) {
      if (serial === modalGeneration && !signal.aborted)
        modalError.value = errorMessage(e, '费用变动读取失败')
    } finally {
      if (serial === modalGeneration) modalLoading.value = false
    }
  }
  function closeModal() {
    modalGeneration++
    modalController?.abort()
    modalQuery.value = null
    modalReport.value = null
    modalError.value = ''
  }
  function openRecords(extra: CostQuery = {}) {
    section.value = 'records'
    drill.value = Object.fromEntries(
      Object.entries({
        city: extra.city,
        category: extra.category ?? filters.category,
        dimension: extra.dimension ?? filters.dimension,
        dimensionKey: extra.dimensionKey ?? filters.dimensionKey,
      }).filter(([, value]) => value !== undefined),
    )
    if (extra.scope) filters.scope = extra.scope
    filters.category = undefined
    filters.dimension = undefined
    filters.dimensionKey = undefined
    filters.search = undefined
    recordSearch.value = ''
    filters.status = 'CONFIRMED'
    filters.payment = extra.payment || 'ALL'
    filters.missingAmount = extra.missingAmount || false
    filters.page = 1
    filters.periodSide = extra.periodSide || 'current'
    closeModal()
    void load()
  }
  function modalRecords(side: 'current' | 'previous') {
    if (!modalQuery.value) return
    const q = { ...modalQuery.value, periodSide: side }
    openRecords(q)
  }
  async function openDetail(row: CostRecord) {
    const serial = ++modalGeneration
    detail.value = null
    detailError.value = ''
    detailOpen.value = true
    detailLoading.value = true
    try {
      const result = await getCostDetail(
        row.source,
        row.sourceId,
        modalQuery.value || request.value,
      )
      if (serial === modalGeneration) detail.value = result
    } catch (e) {
      if (serial === modalGeneration) detailError.value = errorMessage(e, '源单据读取失败')
    } finally {
      if (serial === modalGeneration) detailLoading.value = false
    }
  }
  function clearLedgerDrill() {
    drill.value = {}
    filters.search = undefined
    recordSearch.value = ''
    filters.page = 1
    void load()
  }
  function searchRecords() {
    // 输入草稿不改变已显示的结果及导出范围，提交查询后统一应用。
    filters.search = recordSearch.value.trim() || undefined
    filters.page = 1
    void load()
  }
  onMounted(() => {
    void load()
  })
  let deactivated = false
  onDeactivated(() => {
    deactivated = true
    generation++
    modalGeneration++
    controller?.abort()
    modalController?.abort()
  })
  onActivated(() => {
    if (deactivated) {
      deactivated = false
      closeModal()
      detailOpen.value = false
      void load(true)
    }
  })
  onBeforeUnmount(() => {
    generation++
    modalGeneration++
    controller?.abort()
    modalController?.abort()
  })
  return {
    report,
    records,
    error,
    loading,
    section,
    perspective,
    filters,
    recordSearch,
    drill,
    request,
    cutoff,
    cities,
    available,
    modalReport,
    modalQuery,
    modalError,
    modalLoading,
    detail,
    detailOpen,
    detailLoading,
    detailError,
    load,
    globalChange,
    applyPeriod,
    activePeriod,
    goSection,
    chooseScope,
    choosePerspective,
    topicChange,
    openAnalysis,
    closeModal,
    openRecords,
    modalRecords,
    openDetail,
    clearLedgerDrill,
    searchRecords,
  }
}
