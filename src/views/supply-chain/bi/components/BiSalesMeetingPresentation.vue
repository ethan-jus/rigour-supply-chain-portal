<template>
  <Teleport to="body" :disabled="embedded">
    <BiSalesMeetingBoard
      :embedded="embedded"
      :snapshot="snapshot"
      :detail="detail"
      :period="period"
      :day-mode="dayMode"
      :annual-mode="annualMode"
      :selected-code="selectedCode"
      :region-code="region"
      :cities="cities"
      :max-date="today"
      :scope-label="scopeLabel"
      :loading="loading"
      :detail-loading="detailLoading"
      :error="error"
      :detail-error="detailError"
      :filtered-summary="filteredSummary"
      :summary-error="summaryError"
      :summary-loading="summaryLoading"
      @filter="selectedOwners = $event"
      @period="changePeriod"
      @day="changeDay"
      @city="changeCity"
      @select="selectPerson"
      @refresh="refresh"
      @close="$emit('close')"
    />
  </Teleport>
</template>
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  getSupplyDashboardOverview,
  getSupplyDashboardOperatingAnalysis,
  type SupplyDashboardQuery,
  type SupplyDashboardOverview,
} from '@/api/core/bi'
import {
  getSalesDashboardAnalysis,
  getSalesDashboardSummary,
  type SalesAnalysis,
  type SalesDashboardSummary,
} from '@/api/core/bi-sales-dashboard'
import { getBiEffectiveScope } from '@/api/core/bi-access'
import { businessDate, businessDateRange } from '@/utils/business-date'
import { overviewPeriods } from '../overview-model'
import { salesMonthPeriod, validSalesPeriod, type SalesPeriod } from '../sales-meeting-model'
import type { SalesDashboardSnapshot } from '../sales-dashboard-model'
import { biErrorMessage } from '../bi-error'
import { useDashboardFilters } from '../department-filters'
import BiSalesMeetingBoard from './BiSalesMeetingBoard.vue'
const props = defineProps<{ query: SupplyDashboardQuery; scopeLabel: string; embedded?: boolean }>()
const departmentScope = useDashboardFilters()
defineEmits<{ close: [] }>()
const today = businessDate(new Date())
const period = ref<SalesPeriod>(
  props.query.from && props.query.to
    ? { from: businessDate(props.query.from), to: businessDate(props.query.to) }
    : salesMonthPeriod(today.slice(0, 7), today),
)
const dayMode = ref(
  !!props.query.from &&
    !!props.query.to &&
    businessDate(props.query.from) === businessDate(props.query.to),
)
const annualMode = ref(period.value.from.slice(0, 7) !== period.value.to.slice(0, 7))
const region = ref(props.query.regionCode || '')
const selectedCode = ref(props.query.ownerStaffCode || '')
const cities = ref<{ code: string; name: string }[]>([])
const snapshot = ref<SalesDashboardSnapshot | null>(null),
  detail = ref<SalesDashboardSnapshot | null>(null)
const loading = ref(false),
  detailLoading = ref(false),
  error = ref(''),
  detailError = ref('')
let sequence = 0,
  detailSequence = 0
let reportRequest: AbortController | undefined
let detailRequest: AbortController | undefined
const selectedOwners = ref<string[] | null>(null)
const filteredSummary = ref<{
  current: SalesDashboardSummary
  previous: SalesDashboardSummary | null
} | null>(null)
const summaryLoading = ref(false),
  summaryError = ref('')
let summarySequence = 0
let summaryBypass = false
let summaryTimer: ReturnType<typeof setTimeout> | undefined
watch([selectedOwners, snapshot], () => {
  const request = ++summarySequence
  clearTimeout(summaryTimer)
  filteredSummary.value = null
  summaryError.value = ''
  summaryLoading.value = false
  const owners = selectedOwners.value,
    data = snapshot.value
  const cacheBypass = summaryBypass
  if (owners === null || !data) return
  if (!owners.length) {
    const zero = {
      sales: 0,
      receipts: 0,
      customers: 0,
      newCustomers: 0,
      returningCustomers: 0,
      annualReturningCustomers: 0,
    }
    filteredSummary.value = { current: zero, previous: data.previous ? zero : null }
    return
  }
  summaryLoading.value = true
  summaryTimer = setTimeout(async () => {
    if (data.previous) summaryBypass = false
    const base = { ...props.query, regionCode: region.value || props.query.regionCode }
    try {
      const [current, previous] = await Promise.all([
        getSalesDashboardSummary({ ...base, from: data.current.from, to: data.current.to }, owners, cacheBypass),
        data.previous
          ? getSalesDashboardSummary(
              { ...base, from: data.previous.from, to: data.previous.to },
              owners,
              cacheBypass,
            )
          : Promise.resolve(null),
      ])
      if (request === summarySequence) filteredSummary.value = { current, previous }
    } catch (reason) {
      if (request === summarySequence)
        summaryError.value = biErrorMessage(reason, '筛选汇总读取失败，请刷新重试')
    } finally {
      if (request === summarySequence) summaryLoading.value = false
    }
  }, 250)
})
async function fetchSnapshot(
  owner: string | undefined,
  feedback: { cacheBypass: boolean; signal: AbortSignal; errorFeedback: 'inline' },
  publish: (snapshot: SalesDashboardSnapshot) => void,
) {
  if (props.query.productCategoryId)
    throw new Error('请取消全局商品分类筛选；商品筛选位于个人详情的商品分析区域。')
  const annual = annualMode.value
  const previousDay = new Date(Date.parse(period.value.from) - 86400000).toISOString().slice(0, 10)
  const dates = dayMode.value
    ? {
        current: businessDateRange(period.value.from, period.value.to),
        previous: businessDateRange(previousDay, previousDay),
      }
    : overviewPeriods(
        Number(period.value.from.slice(0, 4)),
        annual ? null : Number(period.value.from.slice(5, 7)),
      )
  const base = {
    ...props.query,
    regionCode: region.value || props.query.regionCode,
    ownerStaffCode: owner || props.query.ownerStaffCode,
  }
  const query = { ...base, ...dates.current },
    previousQuery = { ...base, ...dates.previous }
  const { cacheBypass } = feedback
  const previousResults = Promise.allSettled([
    getSupplyDashboardOverview(previousQuery, feedback, 'SALES_COMPARISON'),
    getSalesDashboardAnalysis(previousQuery, cacheBypass, 'COMPARISON', feedback),
  ] as const)
  const legacyOptions = !departmentScope && !owner
    ? getSupplyDashboardOperatingAnalysis(query, feedback, true).then((data) => data, () => null)
    : Promise.resolve(null)
  const [current, sales] = await Promise.all([
    getSupplyDashboardOverview(query, feedback, 'SALES'),
    getSalesDashboardAnalysis(query, cacheBypass, owner ? undefined : 'RANKING', feedback),
    getBiEffectiveScope(feedback).then((access) => {
      if (access.accessLevel === 'DENIED')
        throw new Error(access.reason || '当前账号无销售经营数据权限')
    }),
  ])
  // Use the sales-analysis series so the summary and ranking share the same scoped payment facts.
  // Payment facts retain the receipt owner captured when the receipt was synchronized.
  function ownerCash(overview: SupplyDashboardOverview, source: SalesAnalysis) {
    const ready =
      overview.freshness.find((f) => f.sourceCode === 'ORDER_PAYMENT_RECORD')?.status === 'READY'
    const total = source.dailyReceipts.reduce((sum, p) => sum + p.value, 0)
    return {
      ...overview,
      metrics: [
        ...overview.metrics.filter((m) => m.metricCode !== 'receipt_amount'),
        ...(ready
          ? [
              {
                metricCode: 'receipt_amount',
                metricName: '本期到账',
                value: total,
                unit: 'CNY',
                previousValue: null,
                changeRate: null,
                description: null,
              },
            ]
          : []),
      ],
      collectionTrend: source.dailyReceipts.map((p) => ({
        ...p,
        metricCode: 'receipt_amount',
        secondaryValue: 0,
      })),
    }
  }
  let result: SalesDashboardSnapshot = {
    current: ownerCash(current, sales),
    previous: null,
    analysis: null,
    sales,
    previousSales: null,
    notice: props.query.customerTypeCode || props.query.sourceSystemCode
        ? '保留原报表筛选，当前展示筛选范围内的业绩。'
        : '',
  }
  publish(result)
  await Promise.all([
    previousResults.then(([previous, previousSales]) => {
      result = previous.status === 'fulfilled' && previousSales.status === 'fulfilled'
        ? { ...result, previous: ownerCash(previous.value, previousSales.value), previousSales: previousSales.value }
        : { ...result, notice: ['上期数据读取失败，请刷新重试。', result.notice].filter(Boolean).join(' ') }
      publish(result)
    }),
    legacyOptions.then((analysis) => {
      if (!analysis) return
      result = { ...result, analysis }
      publish(result)
    }),
  ])
}
async function load(cacheBypass = false) {
  summaryBypass = cacheBypass
  const request = ++sequence
  ++detailSequence
  reportRequest?.abort()
  detailRequest?.abort()
  const controller = new AbortController()
  reportRequest = controller
  snapshot.value = null
  detail.value = null
  loading.value = true
  error.value = ''
  detailError.value = ''
  try {
    if (selectedCode.value) void selectPerson(selectedCode.value, cacheBypass)
    await fetchSnapshot(undefined, { cacheBypass, signal: controller.signal, errorFeedback: 'inline' }, (result) => {
      if (request !== sequence) return
      snapshot.value = result
      loading.value = false
      if (result.analysis && (!region.value || !cities.value.length))
        cities.value = [
          ...new Map((result.analysis.cityMonthlyGoals ?? []).map((c) => [
            c.regionCode, { code: c.regionCode, name: c.regionName },
          ])).values(),
        ]
    })
  } catch (reason) {
    if (request === sequence) error.value = biErrorMessage(reason, '销售看板读取失败')
  } finally {
    controller.abort()
    if (request === sequence) loading.value = false
  }
}
async function selectPerson(code: string, cacheBypass = false) {
  const request = ++detailSequence
  detailRequest?.abort()
  selectedCode.value = code
  detail.value = null
  detailError.value = ''
  detailLoading.value = !!code
  if (!code) return
  const controller = new AbortController()
  detailRequest = controller
  try {
    await fetchSnapshot(code, { cacheBypass, signal: controller.signal, errorFeedback: 'inline' }, (result) => {
      if (request !== detailSequence) return
      detail.value = result
      detailLoading.value = false
    })
  } catch (reason) {
    if (request === detailSequence) detailError.value = biErrorMessage(reason, '个人业绩读取失败')
  } finally {
    controller.abort()
    if (request === detailSequence) detailLoading.value = false
  }
}
function changePeriod(value: SalesPeriod, annual = false) {
  if (validSalesPeriod(value, today)) {
    dayMode.value = false
    annualMode.value = annual
    period.value = value
    void load()
  }
}
function changeDay(day: string) {
  if (!validSalesPeriod({ from: day, to: day }, today)) return
  dayMode.value = true
  annualMode.value = false
  period.value = { from: day, to: day }
  void load()
}
function changeCity(code: string) {
  region.value = code
  selectedCode.value = props.query.ownerStaffCode || ''
  void load()
}
function refresh() {
  void load(true)
}
onMounted(() => void load())
onBeforeUnmount(() => {
  sequence++
  detailSequence++
  summarySequence++
  reportRequest?.abort()
  detailRequest?.abort()
  clearTimeout(summaryTimer)
})
</script>
