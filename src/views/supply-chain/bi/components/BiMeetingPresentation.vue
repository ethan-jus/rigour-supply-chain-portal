<template>
  <Teleport to="body" :disabled="embedded">
    <BiCityMeetingBoard
      v-if="cityMode"
      :embedded="embedded"
      :snapshot="citySnapshot"
      :all-snapshot="snapshot"
      :region-code="regionCode"
      :month="month"
      :annual="overviewMonth == null"
      :year="year"
      :max-month="maxMonth"
      :scope-label="scopeLabel"
      :loading="loading"
      :error="error"
      @city="selectCity"
      @month="changeMonth"
      @year="changePeriod($event, null)"
      @period="changePeriod"
      @refresh="load"
      @close="emit('close')"
      @back="embedded ? emit('overview', snapshot?.query || query) : (cityMode = false)"
      @report="openCityReport" />
    <BiOverviewBoard
      v-else-if="embedded"
      :snapshot="snapshot"
      :year="year"
      :selected-month="overviewMonth"
      :scope-label="scopeLabel"
      :initial-page="initialPage"
      :loading="loading"
      :error="error"
      @period="changePeriod"
      @refresh="load"
      @city="openCity" />
    <BiMeetingBoard
      v-else
      :embedded="embedded"
      :initial-page="initialPage"
      :snapshot="snapshot"
      :month="month"
      :max-month="maxMonth"
      :scope-label="scopeLabel"
      :loading="loading"
      :error="error"
      @month="changeMonth"
      @refresh="load"
      @close="emit('close')"
      @open-report="openReport"
      @city="openCity"
  /></Teleport>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  getSupplyDashboardOverview,
  getSupplyDashboardDataTrust,
  getSupplyDashboardOperatingAnalysis,
  type SupplyDashboardQuery,
} from '@/api/core/bi'
import { getBiEffectiveScope } from '@/api/core/bi-access'
import { businessDate } from '@/utils/business-date'
import { meetingPeriods, type MeetingSnapshot } from '../meeting-model'
import { biErrorMessage } from '../bi-error'
import BiMeetingBoard from './BiMeetingBoard.vue'
import BiOverviewBoard from './BiOverviewBoard.vue'
import { overviewPeriods } from '../overview-model'
import BiCityMeetingBoard from './BiCityMeetingBoard.vue'
import { cityMeetingRows } from '../city-meeting-model'

const props = defineProps<{
  query: SupplyDashboardQuery
  scopeLabel: string
  initialCity?: boolean
  embedded?: boolean
  initialPage?: number
}>()
const emit = defineEmits<{
  close: []
  report: [page: number, query: SupplyDashboardQuery]
  overview: [query: SupplyDashboardQuery]
  city: [query: SupplyDashboardQuery]
}>()
const maxMonth = businessDate(new Date()).slice(0, 7)
const month = ref(
  props.embedded && props.query.from
    ? businessDate(props.query.from).slice(0, 7)
    : businessDate(new Date()).slice(8) === '01'
      ? new Date(Date.parse(`${maxMonth}-01`) - 86400000).toISOString().slice(0, 7)
      : maxMonth,
)
const year = ref(Number(month.value.slice(0, 4)))
const overviewMonth = ref<number | null>(
  props.query.from &&
    props.query.to &&
    businessDate(props.query.from).slice(0, 7) !== businessDate(props.query.to).slice(0, 7)
    ? null
    : Number(month.value.slice(5)),
)
function changePeriod(value: number, selected: number | null) {
  year.value = value
  overviewMonth.value = selected
  if (selected) month.value = `${value}-${String(selected).padStart(2, '0')}`
  snapshot.value = null
  citySnapshot.value = null
  void load()
}
const snapshot = ref<MeetingSnapshot | null>(null)
const citySnapshot = ref<MeetingSnapshot | null>(null)
const cityMode = ref(props.initialCity || false)
const regionCode = ref(props.query.regionCode || '')
const loading = ref(false)
const error = ref('')
let sequence = 0
async function load() {
  const request = ++sequence
  loading.value = true
  error.value = ''
  try {
    const periods =
      props.embedded || cityMode.value
        ? overviewPeriods(year.value, overviewMonth.value)
        : meetingPeriods(month.value)
    const access = await getBiEffectiveScope()
    if (request !== sequence) return
    if (access.accessLevel === 'DENIED') {
      snapshot.value = null
      throw new Error(access.reason || '当前账号无经营数据权限')
    }
    // Preserve every applied business filter. The server remains authoritative for authorization.
    const query = {
      ...props.query,
      ...periods.current,
      ...(cityMode.value ? { regionCode: undefined } : {}),
    }
    const previousQuery = {
      ...props.query,
      ...periods.previous,
      ...(cityMode.value ? { regionCode: undefined } : {}),
    }
    const [currentResult, previousResult, trustResult, analysisResult, previousAnalysisResult] =
      await Promise.allSettled([
        getSupplyDashboardOverview(query),
        getSupplyDashboardOverview(previousQuery),
        getSupplyDashboardDataTrust(),
        getSupplyDashboardOperatingAnalysis(query),
        props.embedded && !cityMode.value
          ? getSupplyDashboardOperatingAnalysis(previousQuery)
          : Promise.resolve(null),
      ])
    if (request !== sequence) return
    if (currentResult.status === 'rejected') {
      snapshot.value = null
      throw currentResult.reason
    }
    snapshot.value = {
      current: currentResult.value,
      previous: previousResult.status === 'fulfilled' ? previousResult.value : null,
      query,
      previousQuery,
      previousAnalysis:
        previousAnalysisResult.status === 'fulfilled' ? previousAnalysisResult.value : null,
      analysis: analysisResult.status === 'fulfilled' ? analysisResult.value : null,
      analysisError:
        analysisResult.status === 'rejected' ? '复购与城市到账数据读取失败，请刷新重试' : undefined,
      trust: trustResult.status === 'fulfilled' ? trustResult.value : null,
      comparisonError:
        previousResult.status === 'rejected'
          ? biErrorMessage(previousResult.reason, '前期比较读取失败')
          : undefined,
      trustError:
        trustResult.status === 'rejected'
          ? biErrorMessage(trustResult.reason, '数据来源状态读取失败')
          : undefined,
    }
    citySnapshot.value = snapshot.value
    if (cityMode.value) {
      const available = cityMeetingRows(snapshot.value).filter((row) => row.selectable)
      const code =
        available.find((row) => row.code === regionCode.value)?.code || available[0]?.code
      if (code) {
        await selectCity(code)
        return
      }
    }
  } catch (reason) {
    if (request === sequence) {
      snapshot.value = null
      citySnapshot.value = null
      error.value = biErrorMessage(reason, '会议数据读取失败')
    }
  } finally {
    if (request === sequence) loading.value = false
  }
}
function changeMonth(value: string) {
  month.value = value
  year.value = Number(value.slice(0, 4))
  overviewMonth.value = Number(value.slice(5, 7))
  snapshot.value = null
  citySnapshot.value = null
  void load()
}
async function openCity(code?: string) {
  if (props.embedded) {
    emit('city', { ...snapshot.value?.query, regionCode: code || props.query.regionCode })
    return
  }
  cityMode.value = true
  const selected =
    code ||
    props.query.regionCode ||
    cityMeetingRows(snapshot.value).find((row) => row.selectable)?.code
  if (selected) await selectCity(selected)
  else citySnapshot.value = snapshot.value
}
async function selectCity(code: string) {
  if (!snapshot.value || !code) return
  if (code && !cityMeetingRows(snapshot.value).some((row) => row.code === code && row.selectable))
    return
  const request = ++sequence
  regionCode.value = code
  error.value = ''
  if (code === snapshot.value?.query.regionCode) {
    citySnapshot.value = snapshot.value
    loading.value = false
    return
  }
  citySnapshot.value = null
  loading.value = true
  try {
    const access = await getBiEffectiveScope()
    if (request !== sequence) return
    if (access.accessLevel === 'DENIED') {
      snapshot.value = null
      throw new Error(access.reason || '当前账号无经营数据权限')
    }
    if (!snapshot.value) return
    const query = { ...snapshot.value.query, regionCode: code }
    const previousQuery = { ...snapshot.value.previousQuery, regionCode: code }
    const [current, previous, analysis, previousAnalysis] = await Promise.allSettled([
      getSupplyDashboardOverview(query),
      getSupplyDashboardOverview(previousQuery),
      getSupplyDashboardOperatingAnalysis(query),
      getSupplyDashboardOperatingAnalysis(previousQuery),
    ])
    if (request !== sequence) return
    if (current.status === 'rejected') throw current.reason
    citySnapshot.value = {
      current: current.value,
      previous: previous.status === 'fulfilled' ? previous.value : null,
      query,
      previousQuery,
      trust: snapshot.value.trust,
      analysis: analysis.status === 'fulfilled' ? analysis.value : null,
      previousAnalysis: previousAnalysis.status === 'fulfilled' ? previousAnalysis.value : null,
      analysisError: analysis.status === 'rejected' ? '复购数据读取失败，请刷新重试' : undefined,
      comparisonError:
        previous.status === 'rejected' || previousAnalysis.status === 'rejected'
          ? '上期对比数据读取失败'
          : undefined,
    }
  } catch (reason) {
    if (request === sequence) error.value = biErrorMessage(reason, '城市数据读取失败')
  } finally {
    if (request === sequence) loading.value = false
  }
}
function openCityReport(page: number) {
  const query = page === 1 ? snapshot.value?.query : citySnapshot.value?.query
  if (query) emit('report', page, query)
}
function openReport(page: number) {
  if (snapshot.value) emit('report', page, snapshot.value.query)
}
onMounted(() => void load())
onBeforeUnmount(() => {
  sequence++
})
</script>
