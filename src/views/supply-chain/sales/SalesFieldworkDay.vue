<template>
  <section
    class="field-day"
    :class="{ 'workbench-day': workbench }"
    :aria-label="person.employeeName + '的工作日'"
  >
    <header class="day-toolbar">
      <div class="day-title">
        <h2>{{ workbench ? '当日行程' : person.employeeName + '的工作日' }}</h2>
        <template v-if="!workbench">
          <span v-if="daily?.city">{{ cityName(daily.city) }}</span>
          <span v-if="person.departmentName && person.departmentName !== daily?.city">{{
            person.departmentName
          }}</span>
          <time :datetime="date">{{ date.slice(5) }}</time>
        </template>
        <el-dropdown v-if="daily || (canRisk && inspectorDayId)" trigger="click" @command="inspect">
          <button type="button" class="day-link day-more" aria-label="更多行程操作">
            <el-icon><MoreFilled /></el-icon>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-if="daily" command="metrics">指标明细</el-dropdown-item>
              <el-dropdown-item v-if="daily && navLedger" command="ledger"
                >看拜访记录</el-dropdown-item
              >
              <template v-if="canRisk && inspectorDayId">
                <el-dropdown-item command="cases">核查事项 {{ cases.length }}</el-dropdown-item>
                <el-dropdown-item command="DEVICE">设备核查</el-dropdown-item>
                <el-dropdown-item v-if="canLocation" command="LOCATION" :disabled="!track"
                  >地点核查</el-dropdown-item
                >
              </template>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
      <span v-if="workbench && daily" class="day-count"
        >{{ visitCount }} 次拜访 · {{ daily.storeCount }} 家门店</span
      >
    </header>
    <el-alert
      v-if="error && (!daily || canLocation)"
      :title="error"
      type="error"
      :closable="false"
    />

    <p
      v-if="
        workbench && daily && !person.workDayId && !daily.visits.length && !daily.punches.length
      "
      class="empty-workday"
      role="status"
    >
      <svg width="24" height="24" aria-hidden="true"><use :href="teamIcons + '#steps'" /></svg>
      <strong>当天暂无打卡或拜访</strong>
    </p>
    <div v-else class="day-main">
      <section v-if="canLocation || !daily" class="map-panel">
        <div class="day-map-wrap">
          <div ref="mapContainer" class="day-map" aria-label="员工当日拜访轨迹" />
          <div v-if="mapMessage" class="day-map-message" role="status">{{ mapMessage }}</div>
          <button
            v-if="track && !mapMessage"
            type="button"
            class="map-button map-fit"
            title="查看全程"
            aria-label="查看全程"
            @click="showOverview"
          >
            <img :src="overviewIcon" alt="" width="21" height="21" />
          </button>
          <div v-if="choices.length" class="pin-choices">
            <div>
              <strong>同址事件</strong
              ><button type="button" class="day-link" @click="choices = []">关闭</button>
            </div>
            <button
              v-for="event in choices"
              :key="event.id"
              type="button"
              @click="selectEvent(event)"
            >
              {{ event.time }} · {{ event.kind === 'visit' ? '第 ' + event.mark + ' 次 · ' : ''
              }}{{ event.title }}
            </button>
          </div>
        </div>
        <footer class="map-foot">
          <div class="map-key" aria-label="地图图例">
            <span><img :src="checkInIcon" alt="" />签到</span>
            <span><i>1</i>拜访顺序</span>
            <span><img :src="checkOutIcon" alt="" />签退</span>
          </div>
          <small v-if="routeNotice" role="status">{{ routeNotice }}</small>
          <span v-if="track?.distanceAvailable"
            >已记录里程 <strong>{{ fieldDistance(track.totalDistanceMeters, true) }}</strong></span
          >
          <span
            >拜访总里程 <strong>{{ mileageSummary }}</strong></span
          >
          <button
            v-if="playbackPoints.length > 1"
            type="button"
            class="day-link"
            @click="togglePlayback"
          >
            {{ playing ? '暂停' : '回放' }}
          </button>
        </footer>
      </section>
      <section v-else class="day-summary">
        <header><strong>作业摘要</strong><small>暂无精确轨迹查看权限</small></header>
        <dl>
          <dt>工作时段</dt>
          <dd>
            <span v-for="p in daily.periods" :key="p.start"
              >{{ fieldClock(p.start) }}–{{
                p.end ? fieldClock(p.end) : workNames[daily.status]
              }}</span
            >
            <span v-if="!daily.periods.length">暂无打卡</span>
          </dd>
          <dt>拜访计划</dt>
          <dd>
            完成 {{ daily.completedPlans }} / {{ daily.planned }} 项<span
              >计划外到店 {{ daily.visits.filter((v) => v.departed && !v.planId).length }} 次</span
            >
          </dd>
          <dt>拜访核验</dt>
          <dd>
            有效 {{ daily.effectiveVisits }} 次<span
              >待核 {{ daily.visits.filter((v) => v.assessment === 'PENDING').length }} 次</span
            ><span v-if="daily.visits.some((v) => v.assessment === 'UNKNOWN')">另有待同步记录</span>
          </dd>
          <dt>录音时长</dt>
          <dd>
            {{ recordings(daily.files, daily.verifiedFiles, daily.verifiedMillis)
            }}<span v-if="daily.files > daily.verifiedFiles"
              >{{ daily.files - daily.verifiedFiles }} 个文件待核</span
            >
          </dd>
        </dl>
      </section>

      <section class="timeline" aria-label="工作日事件与采样">
        <div
          v-if="
            !workbench ||
            (canLocation && (track?.legs.length || track?.gaps.length || track?.points.length))
          "
          class="timeline-tabs"
          role="group"
          aria-label="外勤证据"
        >
          <button type="button" :aria-pressed="traceTab === 'events'" @click="selectTab('events')">
            打卡与拜访
          </button>
          <button
            v-if="canLocation && track"
            type="button"
            :aria-pressed="traceTab === 'legs'"
            @click="selectTab('legs')"
          >
            路段与采样
          </button>
          <small class="trace-count">{{
            traceTab === 'legs'
              ? (track?.legs.length ?? 0) + ' 个连续段'
              : punchCount + ' 次打卡 · ' + visitCount + ' 次到店'
          }}</small>
        </div>
        <div v-if="traceTab === 'events'" ref="timelineBody" class="timeline-body">
          <button
            v-for="event in events"
            :key="event.id"
            type="button"
            class="event"
            :class="{ 'punch-row': event.kind === 'punch' }"
            :data-event-id="event.id"
            :aria-pressed="selectedEvent === event.id"
            @click="selectEvent(event)"
          >
            <time
              >{{ event.time
              }}<template v-if="event.visitType"> · {{ event.visitType }}</template></time
            >
            <b :class="[event.kind, { finish: event.mark === '退' }]"
              ><el-icon v-if="workbench && event.kind === 'punch'"><CircleCheck /></el-icon
              ><template v-else>{{ event.mark }}</template></b
            >
            <strong :title="event.title">{{ event.title }}</strong>
            <small v-if="event.reason" class="event-reason" :title="event.reason">{{
              event.reason
            }}</small>
            <small v-if="workbench && event.kind === 'visit'" class="visit-measures">
              <span v-if="canLocation" :title="event.segmentLabel"
                >本段里程 {{ event.distance }}</span
              >
              <span>{{ event.subtitle === '进行中' ? '停留中' : '停留 ' + event.subtitle }}</span>
            </small>
            <span v-else-if="event.subtitle">{{ event.subtitle }}</span>
            <el-icon v-if="workbench && event.kind === 'visit'" class="event-arrow"
              ><ArrowRight
            /></el-icon>
          </button>
          <p v-if="!events.length" class="timeline-empty">
            {{ loading ? '正在读取' : '当天暂无已收事件' }}
          </p>
        </div>
        <div v-else class="timeline-body legs">
          <button
            v-for="(leg, i) in track?.legs"
            :key="i"
            type="button"
            class="event leg"
            :aria-pressed="legIndex === i"
            @click="pickLeg(i)"
          >
            <b>路段 {{ i + 1 }}</b>
            <time
              >{{ fieldClock(leg.points[0]?.clientOccurredAt) }}–{{
                fieldClock(leg.points.at(-1)?.clientOccurredAt)
              }}</time
            >
            <small>{{ leg.points.length }} 个样点</small>
            <span
              ><strong>{{ fieldDistance(leg.distanceMeters, true) }}</strong></span
            >
          </button>
          <p v-if="!track?.legs.length" class="timeline-empty">缺少连续可用的定位样点</p>
          <section v-if="track?.gaps.length" class="sampling-gaps">
            <h3>采样缺口 · {{ track.gaps.length }} 处</h3>
            <ul>
              <li v-for="gap in track.gaps" :key="gap.from + gap.to">
                <time>{{ fieldClock(gap.from) }}–{{ fieldClock(gap.to) }}</time>
                <span>缺口 {{ Math.round((Date.parse(gap.to) - Date.parse(gap.from)) / 60_000) }} 分</span>
              </li>
            </ul>
          </section>
          <section v-if="activeLeg" class="leg-samples">
            <h3>路段 {{ legIndex + 1 }} 的定位样点</h3>
            <table>
              <thead>
                <tr>
                  <th scope="col">样点</th>
                  <th scope="col">设备采集</th>
                  <th scope="col">服务端接收</th>
                  <th scope="col">定位精度</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(point, i) in activeLeg.points" :key="i">
                  <th scope="row">
                    <button type="button" class="day-link" @click="centerPoint(point)">
                      P{{ legIndex + 1 }}-{{ i + 1 }}
                    </button>
                  </th>
                  <td>{{ fieldClock(point.clientOccurredAt) }}</td>
                  <td>{{ fieldClock(point.serverReceivedAt) }}</td>
                  <td>{{ point.accuracyMeters == null ? '—' : point.accuracyMeters + ' m' }}</td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
        <footer v-if="currentVisit && traceTab === 'events'" class="trace-footer">
          <small v-if="track && !events.find((e) => e.id === currentVisit?.id)?.position"
            >本次拜访暂无可用定位</small
          >
          <button
            type="button"
            class="day-link"
            aria-haspopup="dialog"
            @click="detail = currentVisit"
          >
            查看第 {{ currentVisit.sequence }} 站拜访详情
            <el-icon v-if="workbench"><ArrowRight /></el-icon>
          </button>
          <span v-if="!workbench"
            >{{ fieldClock(currentVisit.arrived) }}–{{
              currentVisit.departed ? fieldClock(currentVisit.departed) : '进行中'
            }}</span
          >
        </footer>
      </section>
    </div>

    <FieldDayMetrics
      v-if="daily"
      :row="daily"
      :date="date"
      :open="metricOpen"
      @close="metricOpen = false"
    />
    <SalesVisitDetailDialog
      v-if="detail && navLedger"
      :rows="daily?.visits"
      @select="detail = $event"
      :visit-id="detail.id"
      :date="detail.date"
      :record="detail"
      :visit-type="events.find(event => event.id === detail?.id)?.visitType"
      same-day-map
      :can-map="canLocation && !!track"
      @close="detail = null"
      @map="locateDetail"
      @changed="emit('changed')"
    />
    <FieldVisitDetails
      v-else-if="detail"
      :visit="detail"
      :can-locate="canLocation && !!track"
      @close="detail = null"
      @locate="locateDetail"
      @changed="emit('changed')"
    />
    <el-drawer v-model="caseDrawer" title="外勤核查" size="min(460px, 96vw)" destroy-on-close>
      <el-alert v-if="caseError" :title="caseError" type="error" />
      <SalesFieldworkCasePanel v-else :cases="cases" @changed="updateCase" />
    </el-drawer>
    <el-drawer
      v-model="inspectorOpen"
      :title="inspectorKind === 'DEVICE' ? '设备核查' : '出发与收工地点'"
      size="min(560px, 100vw)"
      destroy-on-close
      @opened="inspectorReady = true"
      @close="inspectorReady = false"
    >
      <el-alert v-if="caseError" :title="caseError" type="error" />
      <SalesFieldworkInspector
        v-if="inspectorReady && inspectorDayId && !caseError"
        :kind="inspectorKind"
        :person="person"
        :date="date"
        :work-day-id="inspectorDayId"
        :track="track"
        :cases="cases"
        @changed="updateCase"
      />
    </el-drawer>
  </section>
</template>
<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  watch,
} from 'vue'
import { ArrowRight, CircleCheck, MoreFilled } from '@element-plus/icons-vue'
import checkInIcon from '@/assets/icons/fieldwork/check-in.svg'
import checkOutIcon from '@/assets/icons/fieldwork/check-out.svg'
import overviewIcon from '@/assets/icons/fieldwork/overview.svg'
import teamIcons from '@/assets/icons/team-fieldwork.svg?no-inline'
import { useAuthStore } from '@/stores/auth'
import { useNavigationStore } from '@/stores/navigation'
import { isAmapJsConfigured, loadAmapJsApi } from '@/utils/amap-js-api'
import {
  fieldClock,
  fieldDistance,
  fieldMapPaths,
  fieldworkTrack,
  type FieldPersonDay,
  type FieldTrack,
  type TrackPoint,
} from '@/api/core/sales-fieldwork'
import {
  cityName,
  recordings,
  reportEvents,
  visitAssessmentReason,
  workNames,
  type ReportEmployee,
  type ReportVisit,
} from '@/api/core/sales-fieldwork-report'
import { dayCases, type FieldworkCase } from '@/api/core/sales-fieldwork-review'
import FieldDayMetrics from './FieldDayMetrics.vue'
import FieldVisitDetails from './FieldVisitDetails.vue'
import SalesVisitDetailDialog from './SalesVisitDetailDialog.vue'
import SalesFieldworkCasePanel from './SalesFieldworkCasePanel.vue'
const SalesFieldworkInspector = defineAsyncComponent(() => import('./SalesFieldworkInspector.vue'))
const props = defineProps<{
  person: FieldPersonDay
  date: string
  daily?: ReportEmployee
  initialVisit?: string
  workbench?: boolean
}>()
const emit = defineEmits<{ changed: []; ledger: [visit?: string, openDetail?: boolean] }>()
const auth = useAuthStore(),
  nav = props.daily ? useNavigationStore() : null
const navLedger = computed(() => nav?.hasPath('SUPPLY_CHAIN', '/supply-chain/sales/visits/records'))
const canRisk = computed(() => auth.hasPermission('sales:risk:read')),
  canLocation = computed(() => auth.hasPermission('sales:location:sensitive:read'))
const track = ref<FieldTrack | null>(null),
  error = ref(''),
  loading = ref(false),
  mapMessage = ref(''),
  mapContainer = ref<HTMLElement | null>(null)
const timelineBody = ref<HTMLElement | null>(null)
const selectedEvent = ref(''),
  traceTab = ref('events'),
  metricOpen = ref(false),
  detail = ref<ReportVisit | null>(null),
  legIndex = ref(0)
const activeLeg = computed(() => track.value?.legs[legIndex.value])
const routeNotice = computed(() => {
  const data = track.value
  if (!data || !data.points.length) return ''
  if (!data.distanceAvailable) return '有效定位不足，尚未形成轨迹'
  return data.gaps.length || data.rejectedPointCount ? '部分定位缺失，里程仅含已记录路段' : ''
})
const inspectorOpen = ref(false),
  inspectorReady = ref(false),
  inspectorKind = ref<'DEVICE' | 'LOCATION'>('DEVICE'),
  caseDrawer = ref(false),
  cases = ref<FieldworkCase[]>([]),
  caseError = ref('')
const inspectorDayId = computed(() => props.person.workDayId || track.value?.workDayId)
function openInspector(kind: 'DEVICE' | 'LOCATION') {
  inspectorKind.value = kind
  inspectorOpen.value = true
}
function inspect(action: string) {
  if (action === 'metrics') metricOpen.value = true
  if (action === 'ledger') emit('ledger', currentVisit.value?.id)
  if (action === 'cases') caseDrawer.value = true
  if (action === 'DEVICE' || action === 'LOCATION') openInspector(action)
}
function updateCase(item: FieldworkCase) {
  cases.value = cases.value.map((c) => (c.id === item.id ? item : c))
  emit('changed')
}
type Coord = [number, number]
interface DisplayEvent {
  id: string
  kind: string
  mark: string
  time: string
  title: string
  subtitle: string
  reason: string
  position: Coord | null
  visitType?: string
  distance?: string
  segmentLabel?: string
}
function coord(lon: number | null | undefined, lat: number | null | undefined): Coord | null {
  return lon != null &&
    lat != null &&
    Number.isFinite(lon) &&
    Number.isFinite(lat) &&
    Math.abs(lon) <= 180 &&
    Math.abs(lat) <= 90
    ? [lon, lat]
    : null
}
const measuredDistances = computed(
  () =>
    new Map(
      track.value?.segments
        .filter((s) => s.distanceSource === 'OBSERVED_ESTIMATE')
        .map((s) => [s.toVisitId, s.distanceMeters]),
    ),
)
const mileageSummary = computed(() => {
  const data = track.value
  if (!data) return loading.value ? '读取中' : '暂无数据'
  if (!data.points.length) return '未收到轨迹采样'
  const visits = props.daily?.visits.map((v) => v.id) ?? data.visits.map((v) => v.visitId)
  if (!visits.length) return '暂无拜访'
  const measured = visits.flatMap((id) =>
    measuredDistances.value.has(id) ? [measuredDistances.value.get(id)!] : [],
  )
  if (!measured.length) return '采样不足'
  const distance = fieldDistance(
    measured.reduce((sum, meters) => sum + meters, 0),
    true,
  )
  return measured.length === visits.length
    ? distance
    : distance + '（已记录 ' + measured.length + '/' + visits.length + ' 段）'
})
const events = computed<DisplayEvent[]>(() => {
  const data = track.value,
    positions = new Map<string, Coord | null>()
  data?.punches.forEach((p) =>
    positions.set(
      p.eventType + '@' + String(Date.parse(p.serverReceivedAt)),
      coord(p.longitude, p.latitude),
    ),
  )
  data?.visits.forEach((v) => positions.set(v.visitId, coord(v.longitude, v.latitude)))
  const origins = new Map(
    data?.segments.map((s) => [
      s.toVisitId,
      (s.fromSequence === 0 ? '签到' : '第 ' + s.fromSequence + ' 站离店') +
        ' → 第 ' +
        s.toSequence +
        ' 站到店',
    ]),
  )
  const visitTypes = new Map(data?.visits.map((v) => [v.visitId, v.visitType]))
  return props.daily
    ? reportEvents(props.daily).map((e) => ({
        id: e.id,
        kind: e.kind,
        mark: e.ordinal ? String(e.ordinal) : e.title.includes('退') ? '退' : '签',
        time:
          e.visit && props.workbench
            ? fieldClock(e.at) +
              ' – ' +
              (e.visit.departed ? fieldClock(e.visit.departed) : '拜访中')
            : fieldClock(e.at),
        title: e.title,
        visitType: ({ FIRST_VISIT: '初访', REVISIT: '回访' } as Record<string, string>)[
          visitTypes.get(e.id) ?? ''
        ],
        segmentLabel: origins.get(e.id),
        distance: measuredDistances.value.has(e.id)
          ? fieldDistance(measuredDistances.value.get(e.id), true)
          : !data
            ? loading.value
              ? '读取中'
              : '暂无数据'
            : data.points.length
              ? '采样不足'
              : '无采样',
        subtitle: e.tail,
        reason: e.visit && e.visit.assessment !== 'VALID' ? visitAssessmentReason(e.visit) : '',
        position: positions.get(e.id) ?? null,
      }))
    : []
})
const punchCount = computed(() => props.daily?.punchCount ?? track.value?.punches.length ?? 0)
const visitCount = computed(() => props.daily?.visits.length ?? track.value?.visits.length ?? 0)
const choices = ref<DisplayEvent[]>([]),
  currentVisit = computed(
    () => props.daily?.visits.find((v) => v.id === selectedEvent.value) || null,
  )
const playbackPoints = computed(() => track.value?.legs.flatMap((l) => l.points) || [])
const playing = ref(false)
let timer: ReturnType<typeof setInterval> | null = null,
  playIndex = 0,
  request = 0,
  paint = 0,
  controller: AbortController | undefined
function stop() {
  if (timer) clearInterval(timer)
  timer = null
  playing.value = false
  cursor?.hide?.()
}
function togglePlayback() {
  if (playing.value) {
    stop()
    return
  }
  if (playIndex >= playbackPoints.value.length - 1) playIndex = 0
  cursor?.show?.()
  playing.value = true
  timer = setInterval(() => {
    const p = playbackPoints.value[playIndex++]
    if (!p) {
      stop()
      return
    }
    cursor?.setPosition?.([p.longitude, p.latitude])
  }, 450)
}
interface Overlay {
  on?(key: string, callback: () => void): void
  setPosition?(position: Coord): void
  hide?(): void
  show?(): void
}
interface MapInstance {
  add(items: Overlay | Overlay[]): void
  clearMap(): void
  setFitView(items?: Overlay[], immediately?: boolean, padding?: number[], maxZoom?: number): void
  setZoomAndCenter(zoom: number, center: Coord): void
  addControl?(control: unknown): void
  resize?(): void
  destroy(): void
}
interface Amap {
  Map: new (el: HTMLElement, options: Record<string, unknown>) => MapInstance
  Polyline: new (o: Record<string, unknown>) => Overlay
  Marker: new (o: Record<string, unknown>) => Overlay
  plugin?(name: string, callback: () => void): void
  Pixel: new (x: number, y: number) => unknown
  Scale?: new () => unknown
}
let map: MapInstance | null = null,
  cursor: Overlay | null = null
let routeOverlays: Overlay[] = []
const eventPins = new Map<string, HTMLButtonElement>()
function selectPin() {
  for (const pin of eventPins.values()) pin.setAttribute('aria-pressed', 'false')
  eventPins.get(selectedEvent.value)?.setAttribute('aria-pressed', 'true')
}
function fitRoute() {
  if (routeOverlays.length) {
    const maxZoom = track.value?.legs.some((leg) => leg.points.length > 1) ? 19 : 17
    map?.setFitView(routeOverlays, true, [48, 56, 48, 56], maxZoom)
  }
}
function showOverview() {
  selectedEvent.value = ''
  choices.value = []
  if (traceTab.value !== 'events') selectTab('events')
  else {
    selectPin()
    fitRoute()
  }
}
function selectEvent(e: DisplayEvent) {
  selectedEvent.value = e.id
  choices.value = []
  selectPin()
  if (e.position) map?.setZoomAndCenter(16, e.position)
}
function locateDetail(visit: ReportVisit) {
  const event = events.value.find((item) => item.id === visit.id)
  detail.value = null
  if (event) selectEvent(event)
}
function centerPoint(p: TrackPoint) {
  const c = coord(p.longitude, p.latitude)
  if (c) map?.setZoomAndCenter(17, c)
}
function pickLeg(i: number) {
  legIndex.value = i
  void refreshMap()
}
function selectTab(tab: 'events' | 'legs') {
  traceTab.value = tab
  void refreshMap()
}
async function refreshMap() {
  const id = ++paint,
    data = track.value
  stop()
  cursor = null
  routeOverlays = []
  eventPins.clear()
  if (!data || !canLocation.value || !mapContainer.value) return
  const paths = fieldMapPaths(data.legs)
  if (
    !paths.length &&
    !activeLeg.value?.points.length &&
    !events.value.some((event) => event.position)
  ) {
    mapMessage.value = '当天暂无可用位置'
    return
  }
  if (!isAmapJsConfigured()) {
    mapMessage.value = '地图暂不可用'
    return
  }
  try {
    const sdk = (await loadAmapJsApi()) as unknown as Amap
    if (paint !== id || !canLocation.value || !mapContainer.value) return
    if (!map) {
      const nextMap = new sdk.Map(mapContainer.value, {
        zoom: 12,
        viewMode: '2D',
        resizeEnable: true,
        mapStyle: 'amap://styles/normal',
      })
      map = nextMap
      sdk.plugin?.('AMap.Scale', () => {
        if (map === nextMap && sdk.Scale) nextMap.addControl?.(new sdk.Scale())
      })
    }
    map.clearMap()
    const overlays: Overlay[] = []
    const routeStyle = {
      showDir: true,
      dirColor: '#ffffff',
      strokeOpacity: 1,
      strokeWeight: 8,
      isOutline: true,
      outlineColor: '#ffffff',
      borderWeight: 2,
      lineJoin: 'round',
      lineCap: 'round',
    }
    for (const { path } of paths)
      overlays.push(new sdk.Polyline({ path, ...routeStyle, strokeColor: '#d32638', zIndex: 65 }))
    if (traceTab.value === 'legs' && activeLeg.value)
      for (const { path } of fieldMapPaths([activeLeg.value]))
        overlays.push(new sdk.Polyline({ path, ...routeStyle, strokeColor: '#2356a2', zIndex: 66 }))
    if (traceTab.value === 'legs')
      for (const p of activeLeg.value?.points ?? []) {
        const pos = coord(p.longitude, p.latitude)
        if (!pos) continue
        const node = document.createElement('div')
        node.className = 'scdp-field-sample'
        const m = new sdk.Marker({
          position: pos,
          content: node,
          title: fieldClock(p.clientOccurredAt) + ' · 精度 ' + (p.accuracyMeters ?? '—') + ' m',
        })
        m.on?.('click', () => {
          centerPoint(p)
          traceTab.value = 'legs'
          const idx = data.legs.findIndex((l) =>
            l.points.some(
              (x) =>
                x.clientOccurredAt === p.clientOccurredAt &&
                x.longitude === p.longitude &&
                x.latitude === p.latitude,
            ),
          )
          if (idx >= 0) legIndex.value = idx
        })
        overlays.push(m)
      }
    const punches = events.value.filter((e) => e.kind === 'punch')
    const start = punches.find((e) => e.mark === '签')
    const end = punches.at(-1)?.mark === '退' ? punches.at(-1) : undefined
    const groups = new Map<string, DisplayEvent[]>()
    for (const e of events.value) {
      if (!e.position || (e.kind !== 'visit' && e !== start && e !== end)) continue
      const kind = e.kind === 'visit' ? 'visit' : e === start ? 'start' : 'end'
      const key = kind + ':' + e.position.join(',')
      const group = groups.get(key) ?? []
      group.push(e)
      groups.set(key, group)
    }
    for (const group of groups.values()) {
      const first = group[0]!
      const position = first.position!
      const node = document.createElement('div')
      node.className = 'scdp-route-marker'
      const isVisit = first.kind === 'visit'
      const mirror =
        first === start &&
        end?.position &&
        Math.abs(position[0] - end.position[0]) < 0.0003 &&
        Math.abs(position[1] - end.position[1]) < 0.0003
      const visible = isVisit ? group.slice(0, 3) : group
      const makeButton = (label: string, onClick: () => void) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.title = label
        button.setAttribute('aria-label', label)
        button.addEventListener('click', onClick)
        node.append(button)
        return button
      }
      for (const e of visible) {
        const button = makeButton(
          (isVisit ? '第 ' + e.mark + ' 站 · ' : '') + e.time + ' ' + e.title,
          () => {
            if (traceTab.value !== 'events') selectTab('events')
            selectEvent(e)
          },
        )
        eventPins.set(e.id, button)
        if (isVisit) button.textContent = e.mark
        else {
          const flag = document.createElement('img')
          flag.src = e === start ? checkInIcon : checkOutIcon
          flag.alt = ''
          button.className = 'route-flag'
          if (mirror) flag.style.transform = 'scaleX(-1)'
          button.append(flag)
        }
      }
      if (group.length > visible.length) {
        const more = makeButton('选择同址拜访', () => {
          choices.value = group
        })
        more.textContent = '+' + (group.length - visible.length)
        for (const e of group.slice(visible.length)) eventPins.set(e.id, more)
      }
      overlays.push(
        new sdk.Marker({
          position,
          content: node,
          anchor: isVisit ? 'center' : 'top-left',
          offset: new sdk.Pixel(isVisit ? 0 : mirror ? -29 : -7, isVisit ? 0 : -33),
          zIndex: isVisit ? 151 : 150,
        }),
      )
    }
    if (overlays.length) {
      map.add(overlays)
      routeOverlays = overlays
      fitRoute()
      selectPin()
      mapMessage.value = ''
    } else mapMessage.value = '当天暂无可用位置'
    const first = playbackPoints.value[0]
    if (first) {
      cursor = new sdk.Marker({ position: [first.longitude, first.latitude], title: '回放位置' })
      map.add(cursor)
      cursor.hide?.()
    }
    if (selectedEvent.value && traceTab.value === 'events') {
      const pos = events.value.find((e) => e.id === selectedEvent.value)?.position
      if (pos) map.setZoomAndCenter(16, pos)
    }
  } catch (e) {
    if (id === paint) mapMessage.value = e instanceof Error ? e.message : '地图加载失败'
  }
}
async function load() {
  const id = ++request
  controller?.abort()
  controller = new AbortController()
  const signal = controller.signal
  paint++
  stop()
  track.value = null
  loading.value = false
  cases.value = []
  caseError.value = ''
  error.value = ''
  detail.value = null
  choices.value = []
  legIndex.value = 0
  traceTab.value = 'events'
  map?.clearMap()
  mapMessage.value = '正在读取轨迹'
  selectedEvent.value = props.initialVisit || ''
  if (
    props.initialVisit &&
    props.daily &&
    !props.daily.visits.some((v) => v.id === props.initialVisit)
  ) {
    error.value = '当前工作日中找不到所选拜访'
  }
  const day = inspectorDayId.value
  if (!day) {
    mapMessage.value = '当天尚无作业事件'
    return
  }
  if (canRisk.value)
    void dayCases(props.person.salesProfileId, day, signal)
      .then((r) => {
        if (id === request) cases.value = r
      })
      .catch((e) => {
        if (id === request) caseError.value = e instanceof Error ? e.message : '核查读取失败'
      })
  if (!canLocation.value) {
    error.value = '暂无精确轨迹查看权限'
    mapMessage.value = error.value
    return
  }
  loading.value = true
  try {
    const r = await fieldworkTrack(props.person.salesProfileId, props.date, signal)
    if (request !== id) return
    track.value = r
    await nextTick()
    await refreshMap()
  } catch (e) {
    if (request === id) {
      error.value = e instanceof Error ? e.message : '当日轨迹读取失败'
      mapMessage.value = error.value
    }
  } finally {
    if (request === id) loading.value = false
  }
}
watch(
  () => [
    props.date,
    props.person.salesProfileId,
    props.initialVisit,
    auth.user?.id,
    auth.user?.tenantId,
    auth.user?.permissions,
  ],
  () => {
    inspectorOpen.value = false
    caseDrawer.value = false
    metricOpen.value = false
    map?.destroy()
    map = null
    void load()
  },
  { deep: true },
)
watch(
  [selectedEvent, timelineBody],
  () => {
    const body = timelineBody.value
    const selected = body?.querySelector('.event[aria-pressed="true"]')
    if (!body || !selected) return
    const bounds = body.getBoundingClientRect()
    const row = selected.getBoundingClientRect()
    if (row.bottom > bounds.bottom) body.scrollTop += row.bottom - bounds.bottom
    else if (row.top < bounds.top) body.scrollTop -= bounds.top - row.top
  },
  { flush: 'post' },
)
watch(mapContainer, (container, _, onCleanup) => {
  if (!container || typeof ResizeObserver === 'undefined') return
  const observer = new ResizeObserver(() => {
    if (container.clientWidth && container.clientHeight) map?.resize?.()
  })
  observer.observe(container)
  onCleanup(() => observer.disconnect())
})
onActivated(() => map?.resize?.())
onDeactivated(() => {
  detail.value = null
  stop()
})
onMounted(() => {
  void load()
})
onBeforeUnmount(() => {
  request++
  paint++
  controller?.abort()
  stop()
  map?.destroy()
})
</script>

<style scoped lang="scss">
.field-day {
  --map-ink: #1a3340;
  --map-muted: #495f6e;
  --map-accent: #165c69;
  --map-line: #d5dfe2;
  --map-tint: #edf3f4;
  --map-selected: #e7f2ef;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--map-line);
  border-radius: 6px;
  background: #fff;
  color: var(--map-ink);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.workbench-day {
  --map-accent: #235bd5;
  --map-selected: #edf3ff;
  --map-line: #dfe5ea;
  --map-muted: #667888;
  --map-ink: #18324a;
  border-radius: 8px;
}

.day-toolbar,
.day-title,
.map-foot,
.timeline-tabs,
.trace-footer {
  display: flex;
  align-items: center;
  gap: 6px 9px;
}
.day-toolbar {
  min-height: 34px;
  padding: 4px 9px;
  border-bottom: 1px solid var(--map-line);
}
.day-title {
  min-width: 0;
  flex-wrap: wrap;
}
.day-title h2 {
  margin: 0;
  font-size: 15px;
  line-height: 1.3;
}
.day-title > span,
.day-title time,
.map-foot,
.trace-count,
.trace-footer {
  color: var(--map-muted);
  font-size: 12px;
}

.day-main {
  --route-map-height: clamp(198px, 28.8vh, 345px);
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(252px, 1fr);
}

.map-panel,
.timeline {
  min-width: 0;
}
.day-summary {
  padding: 7px 12px;
}
.day-summary header,
.day-summary dd {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-wrap: wrap;
}
.day-summary small,
.day-summary dt {
  color: var(--map-muted);
}
.day-summary dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0 12px;
  margin: 6px 0 0;
}
.day-summary dd,
.day-summary dt {
  margin: 0;
  padding: 5px 0;
  border-top: 1px solid #e5ecee;
}
.day-map-wrap {
  position: relative;
  height: var(--route-map-height);
  background: #eaf0ed;
}
.day-map {
  height: 100%;
}
.day-map-message {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 8px;
  color: var(--map-muted);
  text-align: center;
}
.map-button,
.day-link,
.timeline-tabs button,
.event,
.pin-choices button {
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.map-button {
  padding: 3px 7px;
  min-height: 25px;
  border: 1px solid #c4d2da;
  border-radius: 4px;
  background: #fff;
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
}
.map-button:hover,
.map-button[aria-pressed='true'] {
  background: var(--map-selected);
  border-color: #a5c6c0;
}
.day-more {
  display: inline-grid;
  place-items: center;
  min-width: 24px;
}
.day-link {
  padding: 2px 0;
  color: var(--map-accent);
  font-weight: 650;
  white-space: nowrap;
}
.day-link:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}
.map-foot,
.trace-footer {
  min-height: 23px;
  padding: 3px 8px;
  border-top: 1px solid #e0e7e9;
  background: #f7faf9;
}
.map-foot strong {
  font-size: 12px;
  font-weight: 600;
}
.trace-footer span {
  margin-left: auto;
}
.timeline {
  display: grid;
  max-height: calc(var(--route-map-height) + 23px);
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
  border-left: 1px solid var(--map-line);
}
.timeline-tabs {
  flex-wrap: wrap;
  padding: 0 7px;
  background: #f4f7f7;
}
.timeline-tabs button {
  padding: 5px 1px 4px;
  border-bottom: 2px solid transparent;
  color: var(--map-muted);
  font-size: 12px;
  white-space: nowrap;
}
.timeline-tabs button[aria-pressed='true'] {
  border-color: var(--map-accent);
  color: var(--map-accent);
  font-weight: 700;
}
.trace-count {
  margin-left: auto;
  font-size: 11px;
}
.timeline-body {
  overflow: auto;
  scrollbar-width: thin;
}
.timeline-empty {
  margin: 0;
  padding: 11px 8px;
  color: var(--map-muted);
}
.event {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 25px;
  padding: 3px 7px;
  border-top: 1px solid #e5ecee;
  font-size: 12px;
  text-align: left;
}
.event:hover,
.event[aria-pressed='true'] {
  background: var(--map-selected);
}
.event[aria-pressed='true'] {
  box-shadow: inset 2px 0 #168474;
}
.event > b {
  flex: 0 0 auto;
  min-width: 15px;
  padding: 1px 3px;
  border-radius: 3px;
  background: var(--map-tint);
  font-size: 11px;
  text-align: center;
}
.event > b.visit {
  border-radius: 50%;
  background: #f7e9da;
  color: #874c1d;
}
.event > b.punch {
  background: #dcefe7;
  color: #185c49;
}
.event > b.finish {
  background: #f6e5e7;
  color: #91434b;
}
.event-reason {
  color: #855013;
}
.event-reason {
  max-width: min(35%, 120px);
}
.event strong,
.event-reason {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.event > span {
  margin-left: auto;
  color: var(--map-muted);
  white-space: nowrap;
}
.event > time {
  flex: 0 0 auto;
  color: var(--map-muted);
}
.trace-footer {
  background: #fff;
}
.pin-choices {
  position: absolute;
  z-index: 5;
  top: 7px;
  right: 7px;
  display: grid;
  max-width: calc(100% - 14px);
  padding: 5px;
  border: 1px solid var(--map-line);
  border-radius: 5px;
  background: #fff;
  box-shadow: 0 3px 12px #193b4b25;
}
.pin-choices > div {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 4px;
}
.pin-choices > button {
  text-align: left;
  padding: 4px;
}
.pin-choices > button:hover {
  background: var(--map-selected);
}
.leg {
  gap: 5px 8px;
}
.sampling-gaps,
.leg-samples {
  padding: 7px 8px;
  border-top: 1px solid var(--map-line);
}
.sampling-gaps h3,
.leg-samples h3 {
  margin: 0 0 5px;
  font-size: 13px;
}
.sampling-gaps ul {
  margin: 0;
  padding: 0;
  list-style: none;
}
.sampling-gaps li {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
  color: var(--map-muted);
  font-variant-numeric: tabular-nums;
}
.leg-samples table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  text-align: left;
}
.leg-samples th,
.leg-samples td {
  padding: 4px;
  border-bottom: 1px solid #e5ecee;
}
.leg-samples thead {
  color: var(--map-muted);
  background: var(--map-tint);
}
.day-link:focus-visible,
.map-button:focus-visible,
.event:focus-visible,
.timeline-tabs button:focus-visible {
  outline: 2px solid #286899;
  outline-offset: -2px;
}
:global(.scdp-route-marker) {
  display: flex;
  gap: 1px;
}
:global(.scdp-route-marker button) {
  box-sizing: border-box;
  padding: 0;
  width: 27px;
  height: 27px;
  border: 2px solid white;
  border-radius: 50%;
  background: #e96326;
  color: white;
  font: 600 12px/1 sans-serif;
  cursor: pointer;
}
:global(.scdp-route-marker button[aria-pressed='true']) {
  outline: 2px solid #90340d;
}
:global(.scdp-route-marker .route-flag) {
  border: 0;
  border-radius: 0;
  width: 36px;
  height: 38px;
  background: none;
}
.map-key,
.map-key span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.map-key {
  gap: 12px;
  margin-right: auto;
}
.map-key img {
  width: 18px;
  height: 19px;
}
.map-key i {
  border-radius: 50%;
  background: #e96326;
  color: white;
  padding: 2px 5px;
  font: 600 10px sans-serif;
}
.workbench-day .map-foot {
  flex-wrap: wrap;
}
:global(.scdp-field-sample) {
  background: white;
  border: 2px solid #1b57a2;
  border-radius: 50%;
  width: 6px;
  height: 6px;
}

@media (max-width: 800px) {
  .day-main {
    grid-template-columns: minmax(0, 1fr);
  }
  .day-toolbar {
    flex-wrap: wrap;
  }
  .timeline {
    border-top: 1px solid var(--map-line);
    border-left: 0;
  }
}

.empty-workday {
  margin: 0;
  min-height: 160px;
  box-sizing: border-box;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 9px;
  font-size: 16px;
  padding: 32px 20px;
  text-align: center;
  color: var(--map-muted);
}
.workbench-day .day-toolbar {
  min-height: 58px;
  box-sizing: border-box;
  padding: 12px 19px;
}
.day-count {
  margin-left: auto;
  color: var(--map-muted);
  font-size: 13px;
}
.workbench-day .visit-measures {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  grid-column: 2 / -1;
  grid-row: 3;
  color: var(--map-muted);
  font-size: 12px;
}
.workbench-day .day-title h2 {
  font-size: 18px;
}
.workbench-day .event:not(.leg) {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto 14px;
  gap: 4px 10px;
  padding: 13px 9px;
  margin: 3px 0;
  border: 1px solid transparent;
  border-radius: 6px;
  min-height: 52px;
}
.workbench-day .event:not(.leg) > b {
  grid-column: 1;
  grid-row: 1 / span 2;
  display: grid;
  place-content: center;
  width: 26px;
  height: 26px;
}
.workbench-day .event:not(.leg) > time {
  grid-column: 2;
  grid-row: 1;
  font-size: 12px;
  color: var(--map-muted);
}
.workbench-day .event:not(.leg) > strong {
  grid-column: 2 / 4;
  grid-row: 2;
  font-size: 14px;
}
.workbench-day .event:not(.leg) > .event-reason {
  grid-column: 2 / -1;
  max-width: 100%;
}
.workbench-day .timeline-body {
  padding: 10px 12px;
}
.workbench-day .event-arrow {
  grid-column: 4;
  grid-row: 1 / span 2;
  color: #7d8fa0;
}
.workbench-day .event > b.visit {
  background: #eef2f6;
  color: #586c83;
  font-size: 13px;
}
.workbench-day .event > b.punch {
  color: #45947c;
  background: transparent;
  font-size: 17px;
}
.workbench-day .event[aria-pressed='true'] {
  border-color: #b5caf0;
  box-shadow: none;
}
.workbench-day .event[aria-pressed='true'] > b.visit {
  background: var(--el-color-primary);
  color: white;
}
.workbench-day .event:not(.leg) > span {
  grid-column: 3;
  grid-row: 1 / span 2;
  text-align: right;
}
.map-fit {
  position: absolute;
  z-index: 2;
  top: 12px;
  right: 12px;
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 7px 12px;
  color: var(--map-accent);
}
.workbench-day {
  display: flex;
  flex-direction: column;
  flex: 1 0 320px;
  min-height: 0;
}

.workbench-day .day-main {
  flex: 1;
  min-height: 0;
  grid-template-columns: clamp(290px, 29%, 420px) minmax(0, 1fr);
}
.workbench-day .map-panel {
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  min-height: 0;
}
.workbench-day .day-map-wrap {
  height: auto;
  min-height: 0;
}
.workbench-day .day-map {
  position: absolute;
  inset: 0;
}
.workbench-day .timeline {
  display: flex;
  flex-direction: column;
  order: -1;
  min-height: 0;
  max-height: none;
  border: 0;
  border-right: 1px solid var(--map-line);
}
.workbench-day .timeline-tabs,
.workbench-day .trace-footer,
.workbench-day .map-foot {
  padding: 8px 12px;
  background: white;
}
.workbench-day .timeline-body {
  min-height: 0;
}
.workbench-day .trace-footer {
  border-top: 0;
  padding-top: 0;
}
.workbench-day .empty-workday {
  flex: 1;
}
.workbench-day .trace-footer .day-link {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 7px 11px;
  border: 1px solid var(--map-line);
  border-radius: 5px;
  font-weight: 500;
}
.workbench-day .punch-row:not(.leg) {
  grid-template-columns: 26px auto 1fr;
  min-height: 40px;
  padding-block: 6px;
}
.workbench-day .punch-row:not(.leg) > b,
.workbench-day .punch-row:not(.leg) > strong {
  grid-row: 1;
}
.workbench-day .punch-row:not(.leg) > strong {
  grid-column: 3;
  font-size: 13px;
}
.workbench-day .punch-row:not(.leg) > span {
  grid-column: 2 / -1;
  grid-row: auto;
  text-align: left;
}
@media (max-width: 900px) {
  .workbench-day {
    flex: 1 0 auto;
  }
  .workbench-day .day-main {
    grid-template-columns: minmax(0, 1fr);
    align-content: start;
  }
  .workbench-day .timeline {
    max-height: 42dvh;
    border-right: 0;
    border-bottom: 1px solid var(--map-line);
  }
  .workbench-day .day-map-wrap {
    min-height: max(320px, 52dvh);
  }
}
</style>
