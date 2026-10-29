<template>
  <div class="store-map-view" :aria-busy="loading || mapLoading">
    <div class="map-toolbar">
      <span
        >当前页 {{ rows.length }} 家 · 筛选共 {{ total }} 家<span v-if="missingCount">
          · {{ missingCount }} 家位置待完善</span
        ></span
      >
      <el-button text :disabled="!markerCount" @click="fitPage">显示本页全部位置</el-button>
    </div>
    <el-alert
      v-if="conversionFailed"
      title="部分门店坐标转换失败，暂未显示这些位置，请重试。"
      type="warning"
      :closable="false"
    />
    <div class="map-body" v-loading="loading || mapLoading" element-loading-text="正在加载门店位置">
      <div ref="container" class="map-canvas" aria-label="门店位置地图" />
      <div class="map-legend" aria-label="门店标记图例">
        <span class="legend-public"
          ><svg viewBox="0 0 24 24" aria-hidden="true"><path :d="storefrontPath" /></svg>公海</span
        >
        <span class="legend-private"
          ><svg viewBox="0 0 24 24" aria-hidden="true"><path :d="personPath" /></svg>私海</span
        >
        <span
          ><svg class="legend-cooperated" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path :d="checkPath" /></svg
          >已合作</span
        >
      </div>
      <div
        v-if="error || (!loading && !mapLoading && !markerCount)"
        class="map-message"
        role="status"
      >
        <p>{{ error || (rows.length ? '当前页门店的位置待完善' : '当前筛选条件下暂无门店') }}</p>
        <el-button v-if="error" @click="renderMap">重新加载地图</el-button>
      </div>
      <article v-if="focused" class="map-store-card">
        <button class="map-store-name" @click="emit('detail', focused)">{{ focused.name }}</button>
        <div class="map-tags">
          <el-tag size="small" :type="focused.poolType === 'PUBLIC' ? 'primary' : 'info'">{{
            focused.poolType === 'PUBLIC' ? '公海' : '私海'
          }}</el-tag>
          <el-tag
            size="small"
            :type="focused.cooperationStatus === 'COOPERATED' ? 'success' : 'info'"
            >{{ focused.cooperationStatus === 'COOPERATED' ? '历史合作' : '未合作' }}</el-tag
          >
          <el-tag
            size="small"
            :type="['A', 'B'].includes(focused.customerTier) ? 'primary' : 'info'"
            >{{
              focused.customerTier === 'UNRATED' ? '未评级' : `价值 ${focused.customerTier}`
            }}</el-tag
          >
        </div>
        <p>
          <el-icon><LocationFilled /></el-icon>{{ focused.address }}
        </p>
        <span
          v-if="error || (conversionFailed && !positions.has(focused.id))"
          class="position-not-shown"
          >该门店尚未在地图落点</span
        >
        <a :href="storeMapUrl(focused)!" target="_blank" rel="noopener noreferrer"
          >在高德地图打开</a
        >
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { LocationFilled } from '@element-plus/icons-vue'
import type { StoreRow } from '@/api/core/crm-store'
import { storeMapUrl } from '@/utils/crm-store'
import {
  loadStoreMapSdk,
  storeMapPositions,
  type MapPosition,
  type StoreMapInstance,
  type StoreMarker,
} from '@/utils/crm-store-map'

const props = defineProps<{
  rows: StoreRow[]
  total: number
  loading: boolean
  focusId: string | null
}>()
const emit = defineEmits<{ detail: [row: StoreRow]; select: [id: string | null] }>()
const container = ref<HTMLElement | null>(null)
const mapLoading = ref(false),
  error = ref(''),
  conversionFailed = ref(false),
  markerCount = ref(0)
const focused = computed(() =>
  props.rows.find((row) => row.id === props.focusId && storeMapUrl(row)),
)
const missingCount = computed(() => props.rows.filter((row) => !storeMapUrl(row)).length)
let map: StoreMapInstance | null = null
let generation = 0
let positions = new Map<string, MapPosition>()
const markers = new Map<string, { marker: StoreMarker; button: HTMLButtonElement }>()
const storefrontPath =
  'M4 11v9h16v-9M3 10l2-6h14l2 6M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 20v-6h6v6'
const personPath = 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M5 21v-2a7 7 0 0 1 14 0v2'
const checkPath = 'm7 12 3 3 7-7'

function markerContent(privatePool: boolean, cooperated: boolean) {
  // SVG 只包含本地固定图形；门店名称通过 title/aria-label 写入，不插入 HTML。
  return `<svg class="marker-pin" viewBox="0 0 40 46" aria-hidden="true">
    <circle class="marker-halo" cx="20" cy="18" r="18" />
    <path class="marker-shell" d="M20 46C16 41 5 28 5 18a15 15 0 0 1 30 0c0 10-11 23-15 28Z" />
    <path class="marker-symbol" transform="translate(10 8) scale(.83)" d="${privatePool ? personPath : storefrontPath}" />
  </svg>${cooperated ? `<svg class="marker-cooperated" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="${checkPath}" /></svg>` : ''}`
}

function focusStore() {
  for (const [id, { marker, button }] of markers) {
    button.classList.toggle('is-selected', id === props.focusId)
    button.setAttribute('aria-pressed', String(id === props.focusId))
    marker.setzIndex(id === props.focusId ? 200 : 100)
  }
  const position = props.focusId ? positions.get(props.focusId) : null
  if (position) map?.setZoomAndCenter(16, position)
}
function fitPage() {
  emit('select', null)
  map?.setFitView(
    [...markers.values()].map(({ marker }) => marker),
    true,
    [60, 60, 60, 60],
    15,
  )
}
async function renderMap() {
  const current = ++generation
  map?.clearMap()
  markers.clear()
  positions.clear()
  markerCount.value = 0
  error.value = ''
  conversionFailed.value = false
  mapLoading.value = false
  if (!props.rows.some((row) => storeMapUrl(row)) || !container.value) return
  const rows = props.rows
  mapLoading.value = true
  try {
    const sdk = await loadStoreMapSdk()
    if (current !== generation || !container.value) return
    const result = await storeMapPositions(sdk, rows)
    if (current !== generation || !container.value) return
    positions = result.positions
    conversionFailed.value = result.conversionFailed
    map ??= new sdk.Map(container.value, {
      zoom: 4,
      center: [104.1954, 35.8617],
      viewMode: '2D',
      resizeEnable: true,
    })
    for (const row of rows) {
      const position = positions.get(row.id)
      if (!position) continue
      const button = document.createElement('button')
      button.type = 'button'
      const privatePool = row.poolType === 'PRIVATE'
      const cooperated = row.cooperationStatus === 'COOPERATED'
      const status = `${privatePool ? '私海' : '公海'} · ${cooperated ? '已合作' : '未合作'}`
      button.className = `crm-store-marker${privatePool ? ' is-private' : ''}`
      button.innerHTML = markerContent(privatePool, cooperated)
      button.title = `${row.name}\n${status}`
      button.setAttribute('aria-label', `定位${row.name}，${status}`)
      button.setAttribute('aria-pressed', 'false')
      button.onclick = () => emit('select', row.id)
      const marker = new sdk.Marker({ position, content: button, anchor: 'bottom-center' })
      markers.set(row.id, { marker, button })
    }
    const overlays = [...markers.values()].map(({ marker }) => marker)
    markerCount.value = overlays.length
    map.add(overlays)
    if (props.focusId && positions.has(props.focusId)) focusStore()
    else if (overlays.length) map.setFitView(overlays, true, [60, 60, 60, 60], 15)
  } catch (e) {
    if (current === generation)
      error.value = e instanceof Error ? e.message : '地图加载失败，请重试。'
  } finally {
    if (current === generation) mapLoading.value = false
  }
}
watch(() => props.rows, renderMap)
watch(() => props.focusId, focusStore)
onMounted(renderMap)
onBeforeUnmount(() => {
  generation++
  map?.destroy()
  markers.clear()
})
</script>

<style scoped lang="scss">
.store-map-view {
  --marker-public: #2563eb;
  --marker-private: #0f766e;
  --marker-cooperated: #15803d;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
}
.map-toolbar {
  flex: none;
  flex-wrap: wrap;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 14px;
  color: #64748b;
  font-size: 13px;
}
.map-body {
  position: relative;
  flex: 1;
  min-height: 0;
  background: #f1f5f9;
}
.map-canvas {
  position: absolute;
  inset: 0;
}
.map-legend {
  position: absolute;
  left: 12px;
  bottom: 32px;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  color: #334155;
  font-size: 12px;
  pointer-events: none;
}
.map-legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}
.map-legend svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.legend-public svg {
  stroke: var(--marker-public);
}
.legend-private svg {
  stroke: var(--marker-private);
}
.legend-cooperated circle {
  fill: var(--marker-cooperated);
}
.legend-cooperated path {
  stroke: #fff;
}
.map-message {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #64748b;
  background: #f8fafc;
  padding: 24px;
  text-align: center;
}
.map-store-card {
  position: absolute;
  right: 12px;
  top: 12px;
  width: min(280px, calc(100% - 24px));
  max-height: calc(100% - 24px);
  overflow: auto;
  padding: 14px;
  box-sizing: border-box;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 16px #0f172a14;
}
.map-store-name {
  font: inherit;
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
  border: 0;
  padding: 0;
  text-align: left;
  background: none;
  cursor: pointer;
}
.map-store-name:hover {
  color: #2563eb;
}
.map-tags {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.map-tags .el-tag--success {
  --el-tag-bg-color: #ddf7e9;
  --el-tag-text-color: #168052;
}
.map-tags .el-tag {
  border: 0;
}
.map-store-card p {
  display: flex;
  gap: 6px;
  align-items: baseline;
  font-size: 13px;
  color: #78869b;
  line-height: 22px;
}
.map-store-card a {
  font-size: 13px;
  color: #2563eb;
  text-decoration: none;
}
.position-not-shown {
  display: block;
  color: #b45309;
  font-size: 13px;
  margin-bottom: 10px;
}
.map-canvas :deep(.crm-store-marker) {
  --marker-color: var(--marker-public);
  position: relative;
  display: block;
  width: 36px;
  height: 42px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--marker-color);
  cursor: pointer;
}
.map-canvas :deep(.crm-store-marker.is-private) {
  --marker-color: var(--marker-private);
}
.map-canvas :deep(.marker-pin) {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
  filter: drop-shadow(0 2px 2px #0f172a26);
}
.map-canvas :deep(.marker-shell) {
  fill: #fff;
  stroke: currentColor;
  stroke-width: 1.8;
}
.map-canvas :deep(.marker-symbol) {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.map-canvas :deep(.marker-halo) {
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  opacity: 0;
}
.map-canvas :deep(.crm-store-marker:is(.is-selected, :hover, :focus-visible) .marker-halo) {
  opacity: 0.4;
}
.map-canvas :deep(.crm-store-marker.is-selected .marker-shell) {
  fill: currentColor;
}
.map-canvas :deep(.crm-store-marker.is-selected .marker-symbol) {
  stroke: #fff;
}
.map-canvas :deep(.marker-cooperated) {
  position: absolute;
  top: -2px;
  right: -3px;
  width: 17px;
  height: 17px;
  fill: var(--marker-cooperated);
}
.map-canvas :deep(.marker-cooperated circle) {
  stroke: #fff;
  stroke-width: 2;
}
.map-canvas :deep(.marker-cooperated path) {
  fill: none;
  stroke: #fff;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.map-canvas :deep(.crm-store-marker:focus-visible) {
  outline: 2px solid currentColor;
  outline-offset: 3px;
  border-radius: 6px;
}
</style>
