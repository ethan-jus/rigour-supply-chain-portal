<template>
  <div class="track-comparison">
    <div class="track-toolbar">
      <el-select v-model="salesProfileId" placeholder="选择销售" filterable class="sales-select">
        <el-option v-for="person in people" :key="person.salesProfileId" :label="person.salesNo" :value="person.salesProfileId" />
      </el-select>
      <label><span>主路线</span><el-date-picker v-model="dateA" type="date" value-format="YYYY-MM-DD" :clearable="false" /></label>
      <label><span>对比路线</span><el-date-picker v-model="dateB" type="date" value-format="YYYY-MM-DD" :clearable="true" placeholder="可选" /></label>
      <el-button type="primary" :loading="loading" :disabled="!salesProfileId" @click="loadTracks">查看路线</el-button>
    </div>

    <el-alert
      v-if="!amapConfigured"
      title="Portal 未配置高德地图"
      description="请在 Portal 的 .env.local 配置 VITE_AMAP_JS_KEY 和 VITE_AMAP_SECURITY_CODE；精确轨迹接口不会因此降级为公开数据。"
      type="warning"
      :closable="false"
      show-icon
    />
    <el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" show-icon />

    <div class="track-metrics">
      <article class="route-card route-card--a">
        <span><i />主路线 · {{ dateA }}</span>
        <strong>{{ trackA ? formatDistance(trackA.totalDistanceMeters) : '--' }}</strong>
        <p>{{ trackA ? `${trackA.visits.length} 家拜访 · 轨迹跨度 ${formatMinutes(trackA.trackedDurationMinutes)}` : errorA || '请选择后查看' }}</p>
      </article>
      <article class="route-card route-card--b">
        <span><i />对比路线 · {{ dateB || '未选择' }}</span>
        <strong>{{ trackB ? formatDistance(trackB.totalDistanceMeters) : '--' }}</strong>
        <p>{{ trackB ? `${trackB.visits.length} 家拜访 · 轨迹跨度 ${formatMinutes(trackB.trackedDurationMinutes)}` : errorB || '可选择另一工作日叠加对比' }}</p>
      </article>
      <article class="route-card">
        <span>拜访门店重合</span>
        <strong>{{ overlapLabel }}</strong>
        <p>仅表示两日拜访门店集合重合度，不自动判定路线或工作异常。</p>
      </article>
    </div>

    <el-card shadow="never" class="map-card">
      <template #header>
        <div class="map-heading">
          <div><strong>跨日路线对比</strong><small>蓝色为主路线，紫色虚线为对比路线；低精度定位点不参与连线和里程。</small></div>
          <el-tag type="danger" effect="plain">敏感位置 · 查看已审计</el-tag>
        </div>
      </template>
      <div v-if="loading" class="map-state"><el-icon class="is-loading"><Loading /></el-icon> 正在加载精确轨迹</div>
      <div v-else-if="amapConfigured && (trackA || trackB)" ref="mapContainer" class="track-map" />
      <el-empty v-else description="请选择销售和工作日查看轨迹" />
    </el-card>

    <el-card v-if="trackA?.visits.length || trackB?.visits.length" shadow="never">
      <template #header><strong>拜访顺序对比</strong></template>
      <div class="sequence-grid">
        <div>
          <span class="sequence-title sequence-title--a">{{ dateA }}</span>
          <ol><li v-for="visit in trackA?.visits || []" :key="visit.visitId"><strong>{{ visit.storeName }}</strong><span>{{ visit.visitType === 'REVISIT' ? '复访' : '首访' }} · {{ statusLabel(visit.reviewStatus) }}</span></li></ol>
        </div>
        <div>
          <span class="sequence-title sequence-title--b">{{ dateB || '未选择对比日期' }}</span>
          <ol><li v-for="visit in trackB?.visits || []" :key="visit.visitId"><strong>{{ visit.storeName }}</strong><span>{{ visit.visitType === 'REVISIT' ? '复访' : '首访' }} · {{ statusLabel(visit.reviewStatus) }}</span></li></ol>
        </div>
      </div>
    </el-card>

    <el-alert
      title="使用边界"
      description="路线相似、定位中断或低精度点只能作为复核线索，不能单独判定销售未工作；应结合门店签到、停留、录音、拜访结果和主管复核结论。"
      type="info"
      :closable="false"
      show-icon
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import { apiClient } from '@/api'

interface Person { salesProfileId: string; salesNo: string }
interface Dashboard { people: Person[] }
interface TrackPoint { longitude: number; latitude: number; qualityStatus: string }
interface TrackVisit {
  visitId: string; sequence: number; storeId: string | null; storeName: string
  longitude: number | null; latitude: number | null; visitType: string; reviewStatus: string
}
interface WorkDayTrack {
  workDayId: string; businessDate: string; status: string; totalDistanceMeters: number
  trackedDurationMinutes: number; points: TrackPoint[]; visits: TrackVisit[]
}
interface MapInstance {
  add(overlays: unknown | unknown[]): void
  setFitView(overlays?: unknown[]): void
  destroy(): void
}
interface AmapNamespace {
  Map: new (container: HTMLElement, options: Record<string, unknown>) => MapInstance
  Polyline: new (options: Record<string, unknown>) => unknown
  Marker: new (options: Record<string, unknown>) => unknown
}

const today = localDate(new Date())
const yesterday = localDate(new Date(Date.now() - 86_400_000))
const people = ref<Person[]>([])
const salesProfileId = ref('')
const dateA = ref(today)
const dateB = ref(yesterday)
const trackA = ref<WorkDayTrack | null>(null)
const trackB = ref<WorkDayTrack | null>(null)
const errorA = ref('')
const errorB = ref('')
const errorMessage = ref('')
const loading = ref(false)
const mapContainer = ref<HTMLElement | null>(null)
const amapConfigured = Boolean(import.meta.env.VITE_AMAP_JS_KEY?.trim())
let map: MapInstance | null = null
let amapPromise: Promise<AmapNamespace> | null = null

const overlapLabel = computed(() => {
  if (!trackA.value || !trackB.value) return '--'
  const first = new Set(trackA.value.visits.map((visit) => visit.storeId).filter(Boolean))
  const second = new Set(trackB.value.visits.map((visit) => visit.storeId).filter(Boolean))
  const union = new Set([...first, ...second])
  if (!union.size) return '0%'
  const intersection = [...first].filter((storeId) => second.has(storeId)).length
  return `${Math.round(intersection / union.size * 100)}%`
})

function localDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatDistance(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${value} m`
}

function formatMinutes(value: number): string {
  if (value < 60) return `${value} 分钟`
  return `${Math.floor(value / 60)}小时${value % 60 ? `${value % 60}分` : ''}`
}

function statusLabel(value: string): string {
  return ({ IN_PROGRESS: '进行中', PENDING_REVIEW: '待复核', EFFECTIVE: '有效', INEFFECTIVE: '无效' } as Record<string, string>)[value] || value
}

function errorOf(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return '轨迹读取失败'
}

async function loadPeople() {
  const monthStart = `${today.slice(0, 7)}-01`
  try {
    const dashboard = await apiClient.get('/sales/management/dashboard', { params: { from: monthStart, to: today } }) as Dashboard
    people.value = dashboard.people
    salesProfileId.value ||= people.value[0]?.salesProfileId || ''
  } catch (error) {
    errorMessage.value = errorOf(error)
  }
}

async function fetchTrack(date: string): Promise<{ track: WorkDayTrack | null; error: string }> {
  if (!date) return { track: null, error: '' }
  try {
    const track = await apiClient.get(`/sales/management/profiles/${salesProfileId.value}/track`, { params: { date } }) as WorkDayTrack
    return { track, error: '' }
  } catch (error) {
    return { track: null, error: errorOf(error) }
  }
}

async function loadTracks() {
  if (!salesProfileId.value || !dateA.value) return
  loading.value = true
  errorMessage.value = ''
  destroyMap()
  const [first, second] = await Promise.all([fetchTrack(dateA.value), fetchTrack(dateB.value)])
  trackA.value = first.track
  errorA.value = first.error
  trackB.value = second.track
  errorB.value = second.error
  loading.value = false
  if (!trackA.value && !trackB.value) errorMessage.value = [errorA.value, errorB.value].filter(Boolean).join('；')
  await renderMap()
}

async function loadAmap(): Promise<AmapNamespace> {
  if (window.AMap) return window.AMap as AmapNamespace
  if (amapPromise) return amapPromise
  const key = import.meta.env.VITE_AMAP_JS_KEY?.trim()
  if (!key) throw new Error('未配置高德地图 Key')
  const securityCode = import.meta.env.VITE_AMAP_SECURITY_CODE?.trim()
  if (securityCode) window._AMapSecurityConfig = { securityJsCode: securityCode }
  amapPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}`
    script.async = true
    script.onload = () => window.AMap ? resolve(window.AMap as AmapNamespace) : reject(new Error('高德地图初始化失败'))
    script.onerror = () => reject(new Error('高德地图脚本加载失败'))
    document.head.appendChild(script)
  })
  return amapPromise
}

async function renderMap() {
  if (!amapConfigured || (!trackA.value && !trackB.value)) return
  await nextTick()
  if (!mapContainer.value) return
  try {
    const amap = await loadAmap()
    const routeA = acceptedPath(trackA.value)
    const routeB = acceptedPath(trackB.value)
    const center = routeA[0] || routeB[0]
    if (!center) return
    map = new amap.Map(mapContainer.value, { zoom: 13, center })
    const overlays: unknown[] = []
    addRoute(amap, routeA, '#2468f2', 'solid', overlays)
    addRoute(amap, routeB, '#8b5cf6', 'dashed', overlays)
    addVisitMarkers(amap, trackA.value, 'A', '#2468f2', overlays)
    addVisitMarkers(amap, trackB.value, 'B', '#8b5cf6', overlays)
    map.add(overlays)
    map.setFitView(overlays)
  } catch (error) {
    errorMessage.value = errorOf(error)
  }
}

function acceptedPath(track: WorkDayTrack | null): Array<[number, number]> {
  return (track?.points || []).filter((point) => point.qualityStatus === 'ACCEPTED')
    .map((point) => [point.longitude, point.latitude])
}

function addRoute(amap: AmapNamespace, path: Array<[number, number]>, color: string,
                  strokeStyle: string, overlays: unknown[]) {
  if (path.length < 2) return
  overlays.push(new amap.Polyline({ path, strokeColor: color, strokeWeight: 6, strokeOpacity: .85, strokeStyle, showDir: true }))
}

function addVisitMarkers(amap: AmapNamespace, track: WorkDayTrack | null, prefix: string,
                         color: string, overlays: unknown[]) {
  for (const visit of track?.visits || []) {
    if (visit.longitude == null || visit.latitude == null) continue
    const label = document.createElement('span')
    label.textContent = `${prefix}${visit.sequence} · ${visit.storeName}`
    label.style.color = color
    label.style.fontWeight = '600'
    overlays.push(new amap.Marker({
      position: [visit.longitude, visit.latitude],
      title: `${prefix}${visit.sequence} ${visit.storeName}`,
      label: { content: label, direction: 'top' },
    }))
  }
}

function destroyMap() {
  map?.destroy()
  map = null
}

onMounted(async () => {
  await loadPeople()
  if (salesProfileId.value) await loadTracks()
})
onBeforeUnmount(destroyMap)
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.track-comparison { display: grid; gap: $spacing-lg; }
.track-toolbar { display: flex; flex-wrap: wrap; align-items: flex-end; gap: $spacing-md; padding: $spacing-md; background: $color-bg-white; border: 1px solid $color-border-base; border-radius: $border-radius-lg; }
.track-toolbar label { display: flex; flex-direction: column; gap: 5px; color: $color-text-secondary; font-size: $font-size-xs; }
.sales-select { width: 210px; }
.track-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: $spacing-md; }
.route-card { padding: 18px; background: $color-bg-white; border: 1px solid $color-border-base; border-radius: $border-radius-lg; }
.route-card > span { display: flex; align-items: center; gap: 7px; color: $color-text-secondary; font-size: $font-size-xs; }
.route-card i { width: 18px; height: 4px; background: $color-primary; border-radius: 4px; }
.route-card--b i { background: #8b5cf6; }
.route-card strong { display: block; margin-top: 10px; color: $color-text-primary; font-size: 26px; }
.route-card p { margin: 7px 0 0; color: $color-text-secondary; font-size: $font-size-xs; line-height: 1.5; }
.map-heading { display: flex; align-items: center; justify-content: space-between; gap: $spacing-md; }
.map-heading > div { display: flex; flex-direction: column; gap: 4px; }
.map-heading small { color: $color-text-secondary; }
.track-map { width: 100%; height: 520px; background: $color-bg-muted; border-radius: $border-radius-base; }
.map-state { display: grid; min-height: 360px; color: $color-text-secondary; place-content: center; }
.sequence-grid { display: grid; grid-template-columns: 1fr 1fr; gap: $spacing-lg; }
.sequence-title { display: block; padding-left: 8px; color: $color-primary; font-weight: 700; border-left: 4px solid $color-primary; }
.sequence-title--b { color: #8b5cf6; border-color: #8b5cf6; }
.sequence-grid ol { display: grid; gap: 8px; padding-left: 30px; }
.sequence-grid li { padding: 8px 10px; background: $color-bg-muted; border-radius: $border-radius-base; }
.sequence-grid li strong, .sequence-grid li span { display: block; }
.sequence-grid li span { margin-top: 3px; color: $color-text-secondary; font-size: $font-size-xs; }
@media (max-width: 900px) { .track-metrics, .sequence-grid { grid-template-columns: 1fr; } .track-map { height: 400px; } }
</style>
