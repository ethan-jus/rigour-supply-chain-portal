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
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  getSupplyDashboardOverview,
  getSupplyDashboardOperatingAnalysis,
  type SupplyDashboardQuery,
  type SupplyDashboardOverview,
} from '@/api/core/bi'
import { getSalesDashboardAnalysis, type SalesAnalysis } from '@/api/core/bi-sales-dashboard'
import { getBiEffectiveScope } from '@/api/core/bi-access'
import { businessDate, businessDateRange } from '@/utils/business-date'
import { overviewPeriods } from '../overview-model'
import { salesMonthPeriod, validSalesPeriod, type SalesPeriod } from '../sales-meeting-model'
import type { SalesDashboardSnapshot } from '../sales-dashboard-model'
import { biErrorMessage } from '../bi-error'
import BiSalesMeetingBoard from './BiSalesMeetingBoard.vue'
const props = defineProps<{ query: SupplyDashboardQuery; scopeLabel: string; embedded?: boolean }>()
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
async function fetchSnapshot(owner?: string): Promise<SalesDashboardSnapshot> {
  const access = await getBiEffectiveScope()
  if (access.accessLevel === 'DENIED')
    throw new Error(access.reason || '当前账号无销售经营数据权限')
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
  const results = await Promise.allSettled([
    getSupplyDashboardOverview(query),
    getSupplyDashboardOverview(previousQuery),
    getSupplyDashboardOperatingAnalysis(query),
    getSalesDashboardAnalysis(query),
    getSalesDashboardAnalysis(previousQuery),
  ] as const)
  const [current, previous, analysis, sales, previousSales] = results
  if (current.status === 'rejected') throw current.reason
  if (sales.status === 'rejected') throw sales.reason
  // The legacy overview cash series belongs to receipt handlers. Replace it only in this
  // salesperson dashboard with the scoped, order-owner cash series from sales-analysis.
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
  return {
    current: ownerCash(current.value, sales.value),
    previous:
      previous.status === 'fulfilled' && previousSales.status === 'fulfilled'
        ? ownerCash(previous.value, previousSales.value)
        : null,
    analysis: analysis.status === 'fulfilled' ? analysis.value : null,
    sales: sales.value,
    previousSales: previousSales.status === 'fulfilled' ? previousSales.value : null,
    notice: [
      previous.status === 'rejected' || previousSales.status === 'rejected'
        ? '上期数据读取失败，请刷新重试。'
        : '',
      analysis.status === 'rejected' ? '客户统计读取失败，请刷新重试。' : '',
      props.query.customerTypeCode || props.query.sourceSystemCode
        ? '保留原报表筛选，当前展示筛选范围内的业绩。'
        : '',
    ]
      .filter(Boolean)
      .join(' '),
  }
}
async function load() {
  const request = ++sequence
  ++detailSequence
  snapshot.value = null
  detail.value = null
  loading.value = true
  error.value = ''
  detailError.value = ''
  try {
    const result = await fetchSnapshot()
    if (request !== sequence) return
    snapshot.value = result
    if (!region.value || !cities.value.length)
      cities.value = [
        ...new Map(
          (result.analysis?.cityMonthlyGoals || []).map((c) => [
            c.regionCode,
            { code: c.regionCode, name: c.regionName },
          ]),
        ).values(),
      ]
    if (selectedCode.value) await selectPerson(selectedCode.value)
  } catch (reason) {
    if (request === sequence) error.value = biErrorMessage(reason, '销售看板读取失败')
  } finally {
    if (request === sequence) loading.value = false
  }
}
async function selectPerson(code: string) {
  const request = ++detailSequence
  selectedCode.value = code
  detail.value = null
  detailError.value = ''
  detailLoading.value = !!code
  if (!code) return
  try {
    const result = await fetchSnapshot(code)
    if (request === detailSequence) detail.value = result
  } catch (reason) {
    if (request === detailSequence) detailError.value = biErrorMessage(reason, '个人业绩读取失败')
  } finally {
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
  void load()
}
onMounted(() => void load())
onBeforeUnmount(() => {
  sequence++
  detailSequence++
})
</script>
