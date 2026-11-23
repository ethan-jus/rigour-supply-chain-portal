<template>
  <Teleport to="body" :disabled="!expanded">
    <div v-if="expanded" class="field-map-backdrop" aria-hidden="true" @click="toggleFull" />
    <section
      ref="dayPanel"
      class="field-day"
      :class="{ expanded, 'workbench-day': workbench }"
      :role="expanded ? 'dialog' : undefined"
      :aria-modal="expanded || undefined"
      :aria-label="person.employeeName + (expanded ? '的拜访轨迹' : '的工作日')"
      @keydown.tab="keepMapFocus"
    >
      <header class="day-toolbar">
        <div class="day-title">
          <h2>{{ person.employeeName }}的{{ expanded ? '拜访轨迹' : '工作日' }}</h2>
          <span v-if="daily?.city">{{ cityName(daily.city) }}</span>
          <span v-if="person.departmentName && person.departmentName !== daily?.city">{{
            person.departmentName
          }}</span>
          <time :datetime="date" :title="date">{{ expanded ? date : date.slice(5) }}</time>
        </div>
        <div class="day-actions">
          <template v-if="!expanded">
            <button v-if="daily" type="button" class="day-link" @click="metricOpen = true">
              指标明细
            </button>
            <button
              v-if="daily && navLedger"
              type="button"
              class="day-link"
              @click="emit('ledger', currentVisit?.id)"
            >
              看拜访记录
            </button>
            <el-dropdown v-if="canRisk && inspectorDayId" trigger="click" @command="inspect">
              <button
                type="button"
                class="day-link day-more"
                aria-label="外勤核查操作"
                title="外勤核查操作"
              >
                <el-icon><MoreFilled /></el-icon>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="cases">核查事项 {{ cases.length }}</el-dropdown-item>
                  <el-dropdown-item command="DEVICE">设备核查</el-dropdown-item>
                  <el-dropdown-item v-if="canLocation" command="LOCATION" :disabled="!track"
                    >地点核查</el-dropdown-item
                  >
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
          <button
            v-if="canLocation && person.workDayId"
            ref="expandButton"
            type="button"
            class="map-button"
            :aria-expanded="expanded"
            @click="toggleFull"
          >
            {{ expanded ? '收起地图' : '展开地图' }}
          </button>
        </div>
      </header>
      <el-alert
        v-if="error && (!daily || canLocation)"
        :title="error"
        type="error"
        :closable="false"
      />

      <div class="day-main">
        <section v-if="canLocation || !daily" class="map-panel">
          <div class="day-map-wrap">
            <div ref="mapContainer" class="day-map" aria-label="员工当日拜访轨迹" />
            <div v-if="mapMessage" class="day-map-message" role="status">{{ mapMessage }}</div>
            <div v-if="track && !mapMessage" class="map-annotations">
              <span class="map-north"
                ><el-icon><Top /></el-icon> 北</span
              >
              <span v-if="firstGap" class="map-gap"
                >采样缺口 {{ fieldClock(firstGap.from) }}–{{ fieldClock(firstGap.to)
                }}<template v-if="track.gaps.length > 1">
                  +{{ track.gaps.length - 1 }}</template
                ></span
              >
            </div>
            <div v-if="track && !mapMessage" class="map-tools" role="group" aria-label="地图工具">
              <button
                v-if="track.points.length"
                type="button"
                class="map-button"
                :aria-pressed="showSamples"
                @click="toggleSamples"
              >
                样点
              </button>
              <button
                type="button"
                class="map-button map-icon"
                aria-label="放大地图"
                title="放大地图"
                @click="zoom('in')"
              >
                <el-icon><Plus /></el-icon>
              </button>
              <button
                type="button"
                class="map-button map-icon"
                aria-label="缩小地图"
                title="缩小地图"
                @click="zoom('out')"
              >
                <el-icon><Minus /></el-icon>
              </button>
              <button type="button" class="map-button" @click="fitRoute">全程</button>
            </div>
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
            <span class="map-legend">已记录路段</span>
            <strong>{{
              fieldDistance(
                daily?.distanceMeters ??
                  (track?.distanceAvailable ? track.totalDistanceMeters : null),
                true,
              )
            }}</strong>
            <span v-if="track?.gaps.length">缺口 {{ gapMinutes }} 分</span>
            <button
              v-if="playbackPoints.length > 1"
              type="button"
              class="day-link"
              @click="togglePlayback"
            >
              {{ playing ? '暂停' : '回放' }}
            </button>
            <span v-if="lastSync !== '—'" class="map-sync">末收 {{ lastSync }}</span>
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
                >计划外到店
                {{ daily.visits.filter((v) => v.departed && !v.planId).length }} 次</span
              >
            </dd>
            <dt>拜访核验</dt>
            <dd>
              有效 {{ daily.effectiveVisits }} 次<span
                >待核 {{ daily.visits.filter((v) => v.assessment === 'PENDING').length }} 次</span
              ><span v-if="daily.visits.some((v) => v.assessment === 'UNKNOWN')"
                >另有待同步记录</span
              >
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
          <div class="timeline-tabs" role="group" aria-label="外勤证据">
            <button
              type="button"
              :aria-pressed="traceTab === 'events'"
              @click="selectTab('events')"
            >
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
              :aria-pressed="selectedEvent === event.id"
              @click="selectEvent(event)"
            >
              <time>{{ event.time }}</time>
              <b :class="[event.kind, { finish: event.mark === '退' }]">{{ event.mark }}</b>
              <strong :title="event.title">{{ event.title }}</strong>
              <small v-if="event.reason" class="event-reason" :title="event.reason">{{
                event.reason
              }}</small>
              <span>{{ event.subtitle }}</span>
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
            <button type="button" class="day-link" @click="workbench && navLedger ? emit('ledger', currentVisit.id, true) : (detail = currentVisit)">
              查看第 {{ currentVisit.sequence }} 次拜访
            </button>
            <span
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
      <FieldVisitDetails
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
  </Teleport>
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
import { Minus, MoreFilled, Plus, Top } from '@element-plus/icons-vue'
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
const dayPanel = ref<HTMLElement | null>(null)
const expandButton = ref<HTMLButtonElement | null>(null)
const timelineBody = ref<HTMLElement | null>(null)
const selectedEvent = ref(''),
  traceTab = ref('events'),
  expanded = ref(false),
  metricOpen = ref(false),
  detail = ref<ReportVisit | null>(null),
  legIndex = ref(0),
  showSamples = ref(false)
const activeLeg = computed(() => track.value?.legs[legIndex.value])
const firstGap = computed(() => track.value?.gaps[0])
const gapMinutes = computed(() => {
  const total = track.value?.gaps.reduce((minutes, gap) => {
    const duration = Date.parse(gap.to) - Date.parse(gap.from)
    return minutes + (Number.isFinite(duration) ? Math.max(0, duration) / 60_000 : 0)
  }, 0)
  return Math.round(total ?? 0)
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
  timestamp: string
  title: string
  subtitle: string
  reason: string
  position: Coord | null
}
function coord(lon: number | null | undefined, lat: number | null | undefined): Coord | null {
  return lon != null && lat != null && Number.isFinite(lon) && Number.isFinite(lat)
    ? [lon, lat]
    : null
}
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
  const base = props.daily
    ? reportEvents(props.daily).map((e) => ({
        id: e.id,
        kind: e.kind,
        mark: e.ordinal ? String(e.ordinal) : e.title.includes('退') ? '退' : '签',
        time: fieldClock(e.at),
        timestamp: e.at,
        title: e.title,
        subtitle: e.tail,
        reason: e.visit && e.visit.assessment !== 'VALID' ? visitAssessmentReason(e.visit) : '',
        position: positions.get(e.id) ?? null,
      }))
    : []
  const gaps = (data?.gaps || []).map((g, i) => ({
    id: 'gap-' + i,
    kind: 'gap',
    mark: '断',
    time: fieldClock(g.from),
    timestamp: g.from,
    title: '轨迹采样缺口',
    subtitle: '至 ' + fieldClock(g.to),
    reason: '',
    position: null,
  }))
  return [...base, ...gaps].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
})
const punchCount = computed(() => props.daily?.punchCount ?? track.value?.punches.length ?? 0)
const visitCount = computed(() => props.daily?.visits.length ?? track.value?.visits.length ?? 0)
const choices = ref<DisplayEvent[]>([]),
  currentVisit = computed(
    () => props.daily?.visits.find((v) => v.id === selectedEvent.value) || null,
  )
const playbackPoints = computed(() => track.value?.legs.flatMap((l) => l.points) || []),
  lastSync = computed(() =>
    fieldClock(
      [
        ...(track.value?.points.map((p) => p.serverReceivedAt) ?? []),
        ...(props.daily?.punches.map((p) => p.received) ?? []),
        ...(props.daily?.visits.map((v) => v.receivedAt) ?? []),
      ]
        .filter((value): value is string => !!value)
        .sort()
        .at(-1),
    ),
  )
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
  zoomIn(): void
  zoomOut(): void
  addControl?(control: unknown): void
  resize?(): void
  destroy(): void
}
interface Amap {
  Map: new (el: HTMLElement, options: Record<string, unknown>) => MapInstance
  Polyline: new (o: Record<string, unknown>) => Overlay
  Marker: new (o: Record<string, unknown>) => Overlay
  plugin?(name: string, callback: () => void): void
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
  if (routeOverlays.length) map?.setFitView(routeOverlays, true, [24, 25, 25, 25], 17)
}
function zoom(direction: 'in' | 'out') {
  if (direction === 'in') map?.zoomIn()
  else map?.zoomOut()
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
  showSamples.value = true
  void refreshMap()
}
function toggleSamples() {
  showSamples.value = !showSamples.value
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
  if (!paths.length && !data.points.length && !events.value.some((event) => event.position)) {
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
        mapStyle: 'amap://styles/whitesmoke',
      })
      map = nextMap
      sdk.plugin?.('AMap.Scale', () => {
        if (map === nextMap && sdk.Scale) nextMap.addControl?.(new sdk.Scale())
      })
    }
    map.clearMap()
    const overlays: Overlay[] = []
    for (const line of paths)
      overlays.push(new sdk.Polyline({ ...line, strokeColor: props.workbench ? '#3572bd' : '#137d70', strokeWeight: 5 }))
    if (traceTab.value === 'legs' && activeLeg.value)
      for (const line of fieldMapPaths([activeLeg.value]))
        overlays.push(new sdk.Polyline({ ...line, strokeColor: '#2356a2', strokeWeight: 6 }))
    if (showSamples.value || traceTab.value === 'legs' || !paths.length)
      for (const p of (traceTab.value === 'legs' ? activeLeg.value?.points : data.points) || []) {
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
    const groups = new Map<string, DisplayEvent[]>()
    for (const e of events.value) {
      if (!e.position) continue
      const key = e.position.map((v) => v.toFixed(5)).join(',')
      const group = groups.get(key) || []
      group.push(e)
      groups.set(key, group)
    }
    for (const group of groups.values()) {
      const first = group[0]!,
        visits = group.filter((e) => e.kind === 'visit')
      const node = document.createElement('button')
      node.type = 'button'
      node.className =
        'scdp-field-event-pin ' +
        (visits.length ? 'visit' : first.title.includes('退') ? 'punch finish' : 'punch')
      node.textContent = visits.length
        ? visits.map((e) => e.mark).join('·')
        : group.length === 1
          ? first.title.includes('退')
            ? '签退'
            : '签到'
          : '签到 / 签退'
      const title = group.map((e) => e.time + ' ' + e.title).join('、')
      node.setAttribute('aria-label', title)
      for (const event of group) eventPins.set(event.id, node)
      const handle = () => {
        if (traceTab.value !== 'events') selectTab('events')
        if (group.length > 1) choices.value = group
        else selectEvent(first)
      }
      node.addEventListener('click', handle)
      overlays.push(new sdk.Marker({ position: first.position, content: node, title, zIndex: 150 }))
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
    if (props.initialVisit && selectedEvent.value === props.initialVisit) {
      const pos = events.value.find((e) => e.id === selectedEvent.value)?.position
      if (pos) map.setZoomAndCenter(16, pos)
    }
  } catch (e) {
    if (id === paint) mapMessage.value = e instanceof Error ? e.message : '地图加载失败'
  }
}
async function toggleFull() {
  expanded.value = !expanded.value
  await nextTick()
  map?.resize?.()
  fitRoute()
  expandButton.value?.focus()
}
function keepMapFocus(event: KeyboardEvent) {
  if (!expanded.value || !dayPanel.value) return
  const controls = Array.from(
    dayPanel.value.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled)',
    ),
  ).filter((element) => element.getClientRects().length)
  const first = controls[0]
  const last = controls.at(-1)
  if (event.shiftKey && event.target === first && last) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && event.target === last && first) {
    event.preventDefault()
    first.focus()
  }
}
function escapeFull(e: KeyboardEvent) {
  if (
    e.key === 'Escape' &&
    expanded.value &&
    !detail.value &&
    !inspectorOpen.value &&
    !caseDrawer.value
  )
    void toggleFull()
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
  showSamples.value = false
  map?.clearMap()
  mapMessage.value = '正在读取轨迹'
  selectedEvent.value =
    props.initialVisit ||
    props.daily?.issues.find((i) => i.visitId)?.visitId ||
    props.daily?.visits[0]?.id ||
    ''
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
    expanded.value = false
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
onActivated(() => map?.resize?.())
onDeactivated(() => {
  expanded.value = false
  detail.value = null
  stop()
})
onMounted(() => {
  window.addEventListener('keydown', escapeFull)
  void load()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', escapeFull)
  request++
  paint++
  controller?.abort()
  stop()
  map?.destroy()
})
</script>

<style scoped lang="scss">
.field-map-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1899;
  background: rgb(23 49 65 / 43%);
}
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
  --map-accent: #265aa3;
  --map-selected: #e9f0fc;
}
.field-day.expanded {
  position: fixed;
  inset: 3vh 2vw auto;
  z-index: 1900;
  box-shadow: 0 7px 36px #193b4b40;
}
.day-toolbar,
.day-title,
.day-actions,
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
.day-actions {
  margin-left: auto;
  flex-wrap: wrap;
}
.day-main {
  --route-map-height: clamp(198px, 28.8vh, 345px);
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(252px, 1fr);
}
.workbench-day:not(.expanded) .day-main {
  --route-map-height: clamp(310px, 52vh, 535px);
  grid-template-columns: minmax(0, 2fr) minmax(242px, 1fr);
}
.expanded .day-main {
  --route-map-height: 68vh;
  grid-template-columns: minmax(0, 2.55fr) minmax(310px, 1fr);
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
.map-tools,
.map-annotations {
  position: absolute;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 4px;
}
.map-tools {
  right: 7px;
  bottom: 21px;
}
.map-annotations {
  top: 6px;
  left: 7px;
}
.map-north,
.map-gap {
  display: inline-flex;
  align-items: center;
  padding: 2px 5px;
  border-radius: 3px;
  background: #fffcf5;
  font-size: 11px;
}
.map-gap {
  color: #855013;
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
.map-icon,
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
.map-legend {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}
.map-legend::before {
  width: 13px;
  height: 2px;
  background: #2456a6;
  content: '';
}
.map-sync,
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
.event > b.gap,
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
.leg-samples {
  padding: 7px 8px;
  border-top: 1px solid var(--map-line);
}
.leg-samples h3 {
  margin: 0 0 5px;
  font-size: 13px;
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
:global(.scdp-field-event-pin) {
  color: white;
  background: #a4501b;
  border: 2px solid white;
  border-radius: 12px;
  padding: 2px 5px;
  white-space: nowrap;
  font: 600 12px sans-serif;
  box-shadow: 0 1px 3px #19383e66;
}
:global(.scdp-field-event-pin.punch) {
  background: #166e61;
  border-radius: 4px;
}
:global(.scdp-field-event-pin.finish) {
  background: #9d4148;
}
:global(.scdp-field-sample) {
  background: white;
  border: 2px solid #1b57a2;
  border-radius: 50%;
  width: 6px;
  height: 6px;
}

:global(.scdp-field-event-pin[aria-pressed='true']) {
  outline: 2px solid #154757;
  outline-offset: 1px;
}
@media (max-width: 900px) {
  .workbench-day:not(.expanded) .day-main {
    --route-map-height: clamp(230px, 46vh, 350px);
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 800px) {
  .day-main,
  .expanded .day-main {
    grid-template-columns: minmax(0, 1fr);
  }
  .day-toolbar {
    flex-wrap: wrap;
  }
  .timeline {
    border-top: 1px solid var(--map-line);
    border-left: 0;
  }
  .expanded .day-main {
    --route-map-height: 36vh;
  }
  .expanded {
    max-height: 94vh;
    overflow: auto;
  }
}
</style>
