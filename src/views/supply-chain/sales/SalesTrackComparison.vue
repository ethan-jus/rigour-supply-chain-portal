<template>
  <el-result
    v-if="!canViewTracks"
    icon="warning"
    title="无精确轨迹查看权限"
    sub-title="需具备销售看板和精确位置查看权限。"
  />
  <div v-else class="track-comparison">
    <el-alert v-if="peopleError" :title="peopleError" type="error" :closable="false" />
    <div v-if="mode" class="compare-settings" role="group" aria-label="轨迹对比条件">
      <el-button
        :type="mode === 'day' ? 'primary' : 'default'"
        :aria-pressed="mode === 'day'"
        @click="changeMode('day')"
        >同人跨日</el-button
      >
      <el-button
        :type="mode === 'person' ? 'primary' : 'default'"
        :aria-pressed="mode === 'person'"
        @click="changeMode('person')"
        >同日跨人</el-button
      >
      <el-date-picker
        v-if="mode === 'day'"
        :model-value="lanes[1]?.date"
        type="date"
        value-format="YYYY-MM-DD"
        :clearable="false"
        :disabled-date="isFuture"
        placeholder="对照工作日"
        aria-label="对照工作日"
        @update:model-value="changeDate"
      />
      <div v-else class="list-filter-field list-filter-field--person">
        <el-select
          :model-value="lanes[1]?.person"
          filterable
          :disabled="!otherPeople.length"
          placeholder="选择对照业务员"
          aria-label="对照业务员"
          @update:model-value="changePerson"
        >
          <el-option
            v-for="person in otherPeople"
            :key="person.id"
            :label="person.name"
            :value="person.id"
          />
        </el-select>
      </div>
    </div>
    <div class="compare-grid" v-loading="loading">
      <section v-for="lane in lanes" :key="lane.title" class="compare-panel">
        <h2>{{ lane.title }}</h2>
        <p v-if="mode" class="compare-identity">
          <strong>{{
            people.find((person) => person.id === lane.person)?.name ?? '暂无可对照人员'
          }}</strong>
          <time :datetime="lane.date">{{ lane.date }}</time>
        </p>
        <div v-else class="compare-filters">
          <label>
            <span>员工</span>
            <div class="list-filter-field list-filter-field--person">
              <el-select
                v-model="lane.person"
                size="small"
                filterable
                placeholder="选择销售"
                :aria-label="lane.title + '员工'"
                @change="loadTracks"
              >
                <el-option
                  v-for="person in people"
                  :key="person.id"
                  :label="person.name"
                  :value="person.id"
                />
              </el-select>
            </div>
          </label>
          <label>
            <span>日期</span>
            <el-date-picker
              v-model="lane.date"
              class="compare-date"
              type="date"
              size="small"
              format="YYYY/MM/DD"
              value-format="YYYY-MM-DD"
              :aria-label="lane.title + '日期'"
              :disabled-date="isFuture"
              :clearable="false"
              @change="loadTracks"
            />
          </label>
        </div>
        <div class="compare-map-frame">
          <div
            :ref="(element) => bindMap(lane.title, element)"
            class="compare-map"
            :aria-label="lane.title + '拜访轨迹'"
          />
          <p v-if="lane.message" class="compare-map-state" role="status">{{ lane.message }}</p>
        </div>
        <div class="compare-strip">
          <span>已记录路段</span>
          <strong>{{
            fieldDistance(
              lane.track?.distanceAvailable ? lane.track.totalDistanceMeters : null,
              true,
            )
          }}</strong>
          <span v-if="lane.track?.gaps?.length">{{ lane.track.gaps.length }} 处采样缺口</span>
        </div>
        <div v-if="lane.summary" class="compare-metrics">
          <span
            ><b>{{ mode && lane.track ? lane.track.visits.length : lane.summary.visits }}</b>
            {{ mode && lane.track ? '次到店' : '次完成拜访' }}</span
          >
          <span
            ><b>{{ lane.summary.punches }}</b> 次打卡</span
          >
          <span
            >工作时长 <b>{{ duration(lane.summary.workMinutes) }}</b
            ><sup v-if="lane.summary.active">暂</sup
            ><sup v-else-if="lane.summary.missingCheckout">待核</sup></span
          >
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  fieldDistance,
  fieldMapPaths,
  fieldworkTrack,
  type FieldTrack,
} from '@/api/core/sales-fieldwork'
import {
  duration,
  readFieldReport,
  type ReportOption,
  type ReportSummary,
} from '@/api/core/sales-fieldwork-report'
import { useAuthStore } from '@/stores/auth'
import { isAmapJsConfigured, loadAmapJsApi } from '@/utils/amap-js-api'
import { businessDate } from '@/utils/business-date'

const props = defineProps<{
  staffOptions?: ReportOption[]
  initialPerson?: string
  initialDate?: string
  mode?: 'day' | 'person'
  compareDate?: string
  comparePerson?: string
}>()
const emit = defineEmits<{
  change: [state: { mode: 'day' | 'person'; date: string; person: string }]
}>()
const auth = useAuthStore()
const canViewTracks = computed(
  () =>
    auth.hasPermission('sales:dashboard:read') &&
    auth.hasPermission('sales:location:sensitive:read'),
)

type Coordinate = [number, number]
interface MapInstance {
  add(overlays: unknown[]): void
  setFitView(overlays: unknown[], immediately: boolean, padding: number[], maxZoom: number): void
  destroy(): void
}
interface Amap {
  Map: new (el: HTMLElement, options: Record<string, unknown>) => MapInstance
  Polyline: new (options: Record<string, unknown>) => unknown
  Marker: new (options: Record<string, unknown>) => unknown
}
interface Lane {
  title: string
  person: string
  date: string
  track: FieldTrack | null
  summary: ReportSummary | null
  message: string
}
const today = businessDate(new Date())
const isFuture = (value: Date) => businessDate(value) > today
const firstDay = props.initialDate || today
const dayBefore = (day: string) =>
  businessDate(new Date(Date.parse(day + 'T12:00:00+08:00') - 86_400_000)) || today
const lanes = ref<Lane[]>([
  {
    title: '主工作日',
    date: firstDay,
    person: props.initialPerson || '',
    track: null,
    summary: null,
    message: '请选择员工和工作日',
  },
  {
    title: '对比日',
    date: dayBefore(firstDay),
    person: props.initialPerson || '',
    track: null,
    summary: null,
    message: '请选择员工和工作日',
  },
])
const people = ref<ReportOption[]>([])
const otherPeople = computed(() =>
  people.value.filter((person) => person.id !== lanes.value[0]?.person),
)
const peopleError = ref('')
const loading = ref(false)
const mapElements = new Map<string, HTMLElement>()
const maps = new Map<string, MapInstance>()
let active: AbortController | undefined
let rosterRequest: AbortController | undefined

function changeMode(mode: 'day' | 'person') {
  emit('change', { mode, date: props.compareDate || '', person: props.comparePerson || '' })
}
function changeDate(date: string) {
  if (date) emit('change', { mode: 'day', date, person: props.comparePerson || '' })
}
function changePerson(person: string) {
  emit('change', { mode: 'person', date: props.compareDate || '', person })
}
function scopeComparison() {
  const main = lanes.value[0]!
  const other = lanes.value[1]!
  if (!props.mode) return
  main.date = props.initialDate || today
  main.person =
    people.value.find((person) => person.id === props.initialPerson)?.id ||
    people.value[0]?.id ||
    ''
  other.date = props.mode === 'day' ? props.compareDate || dayBefore(main.date) : main.date
  other.person =
    props.mode === 'day'
      ? main.person
      : otherPeople.value.find((person) => person.id === props.comparePerson)?.id ||
        otherPeople.value[0]?.id ||
        ''
}
function bindMap(title: string, element: unknown) {
  if (element instanceof HTMLElement) mapElements.set(title, element)
  else mapElements.delete(title)
}
function resetTracks() {
  active?.abort()
  maps.forEach((map) => map.destroy())
  maps.clear()
  loading.value = false
  for (const lane of lanes.value) {
    lane.track = null
    lane.summary = null
    lane.message = props.mode ? '暂无可对照人员' : '请选择员工和工作日'
  }
}

async function loadPeople() {
  if (!canViewTracks.value) return
  rosterRequest?.abort()
  const request = new AbortController()
  rosterRequest = request
  peopleError.value = ''
  try {
    const rows =
      props.staffOptions ??
      (await readFieldReport({ date: firstDay, size: 1 }, request.signal)).people
    if (request.signal.aborted) return
    people.value = rows
    for (const lane of lanes.value) {
      if (!rows.some((person) => person.id === lane.person)) lane.person = rows[0]?.id || ''
    }
  } catch (error) {
    if (!request.signal.aborted)
      peopleError.value = error instanceof Error ? error.message : '读取员工失败'
  }
}

async function drawMap(lane: Lane, track: FieldTrack, signal: AbortSignal) {
  if (!isAmapJsConfigured()) {
    lane.message = '地图暂不可用'
    return
  }
  const paths = fieldMapPaths(track.legs ?? [])
  const markers = [
    ...track.visits.map((visit) => ({
      longitude: visit.longitude,
      latitude: visit.latitude,
      text: String(visit.sequence),
      title: visit.storeName,
    })),
    ...(track.punches ?? []).map((punch) => ({
      longitude: punch.longitude,
      latitude: punch.latitude,
      text: punch.eventType === 'CHECK_IN' ? '签到' : '签退',
      title: '',
    })),
  ].filter((mark) => mark.longitude != null && mark.latitude != null)
  const firstMarker = markers[0]
  const center =
    paths[0]?.path[0] ??
    (firstMarker ? ([firstMarker.longitude!, firstMarker.latitude!] as Coordinate) : null)
  if (!center) {
    lane.message = '当日暂无可用位置'
    return
  }

  const sdk = (await loadAmapJsApi()) as unknown as Amap
  const container = mapElements.get(lane.title)
  if (signal.aborted || !container || !canViewTracks.value) return
  const map = new sdk.Map(container, {
    center,
    viewMode: '2D',
    resizeEnable: true,
    mapStyle: 'amap://styles/whitesmoke',
  })
  maps.set(lane.title, map)
  const overlays = paths.map(
    (route) =>
      new sdk.Polyline({
        ...route,
        strokeColor: props.mode ? '#3572bd' : '#137d70',
        strokeWeight: 4,
      }),
  )
  const markerGroups = new Map<string, typeof markers>()
  markers.forEach((mark, index) => {
    const key = props.mode
      ? mark.longitude!.toFixed(5) + ',' + mark.latitude!.toFixed(5)
      : String(index)
    const group = markerGroups.get(key) ?? []
    group.push(mark)
    markerGroups.set(key, group)
  })
  for (const group of markerGroups.values()) {
    const mark = group[0]!
    const label = document.createElement('span')
    label.className = 'scdp-compare-marker'
    label.textContent = group.map((item) => item.text).join('·')
    overlays.push(
      new sdk.Marker({
        content: label,
        position: [mark.longitude, mark.latitude],
        title: group.map((item) => item.title || item.text).join('、'),
      }),
    )
  }
  map.add(overlays)
  map.setFitView(overlays, true, [22, 22, 22, 22], 17)
  lane.message = ''
}

async function loadLane(lane: Lane, signal: AbortSignal) {
  if (!lane.person || !lane.date) return
  lane.message = '正在读取轨迹'
  const [track, report] = await Promise.allSettled([
    fieldworkTrack(lane.person, lane.date, signal),
    readFieldReport({ date: lane.date, person: lane.person, size: 1 }, signal),
  ])
  if (signal.aborted || !canViewTracks.value) return
  if (report.status === 'fulfilled') lane.summary = report.value.summary ?? null
  if (track.status === 'rejected') {
    lane.message = track.reason instanceof Error ? track.reason.message : '当日暂无轨迹'
    return
  }
  lane.track = track.value
  try {
    await drawMap(lane, track.value, signal)
  } catch (error) {
    if (!signal.aborted) lane.message = error instanceof Error ? error.message : '地图加载失败'
  }
}

async function loadTracks() {
  if (!canViewTracks.value) return
  resetTracks()
  const request = new AbortController()
  active = request
  loading.value = true
  await Promise.all(lanes.value.map((lane) => loadLane(lane, request.signal)))
  if (!request.signal.aborted) loading.value = false
}

watch(
  () => [auth.user?.tenantId, auth.user?.id, auth.user?.permissions, props.staffOptions],
  async (_value, _oldValue, onCleanup) => {
    let interrupted = false
    onCleanup(() => {
      interrupted = true
    })
    resetTracks()
    people.value = []
    await loadPeople()
    if (!interrupted && people.value.length) {
      scopeComparison()
      await loadTracks()
    }
  },
  { immediate: true, deep: true },
)
watch(
  () => [
    props.mode,
    props.compareDate,
    props.comparePerson,
    props.initialPerson,
    props.initialDate,
  ],
  () => {
    if (!props.mode || !people.value.length) return
    scopeComparison()
    void loadTracks()
  },
)
onBeforeUnmount(() => {
  rosterRequest?.abort()
  resetTracks()
})
</script>

<style scoped lang="scss">
@use '@/assets/styles/list-filters';

.track-comparison,
.compare-grid {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.compare-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.compare-panel {
  min-width: 0;
  overflow: hidden;
  border: 1px solid #d5dfe2;
  border-radius: 6px;
  background: #fff;
  color: #1a3340;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.compare-panel h2 {
  margin: 0;
  padding: 7px 9px;
  border-bottom: 1px solid #e0e7e9;
  font-size: 15px;
}
.compare-settings,
.compare-identity {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.compare-settings .el-button + .el-button {
  margin-left: 0;
}
.compare-settings :deep(.el-date-editor.el-input) {
  width: 146px;
}
.compare-identity {
  padding: 7px 9px;
  margin: 0;
  gap: 10px;
  color: #495f6e;
}
.compare-map-frame {
  --comparison-redesign-map: clamp(240px, 42vh, 440px);
}
.compare-identity + .compare-map-frame {
  height: var(--comparison-redesign-map);
}
.compare-filters,
.compare-filters label,
.compare-strip,
.compare-metrics {
  display: flex;
  align-items: center;
  gap: 5px 10px;
  flex-wrap: wrap;
}
.compare-filters,
.compare-strip,
.compare-metrics {
  padding: 5px 9px;
}
.compare-filters label {
  color: #495f6e;
  font-size: 12px;
}
.compare-filters :deep(.compare-date) {
  width: 128px;
}
.compare-map-frame {
  position: relative;
  height: clamp(200px, 34vh, 360px);
  border-block: 1px solid #e0e7e9;
  background: #eaf0ed;
}
.compare-map {
  height: 100%;
}
.compare-map-state {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  padding: 8px;
  color: #495f6e;
}
.compare-strip {
  background: #f7faf9;
  color: #495f6e;
  font-size: 12px;
}
.compare-metrics {
  border-top: 1px solid #e0e7e9;
}
.compare-metrics sup {
  margin-left: 3px;
  color: #855013;
}
:global(.scdp-compare-marker) {
  padding: 2px 5px;
  border: 2px solid #fff;
  border-radius: 10px;
  background: #2456a6;
  color: #fff;
  font: 600 11px sans-serif;
  white-space: nowrap;
}
@media (max-width: 800px) {
  .compare-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
