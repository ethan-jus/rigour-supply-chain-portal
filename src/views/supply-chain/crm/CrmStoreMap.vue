<template>
  <div class="store-map-view" :aria-busy="dataLoading || mapLoading">
    <div class="map-toolbar">
      <span class="map-counts" aria-live="polite">
        <span class="map-level">{{ levelLabels[mapLevel] }}</span>
        筛选共 <strong>{{ number(result?.total ?? 0) }}</strong> 家
        <span v-if="result && mapLevel === 'STORE'">
          · 视野及周边 {{ number(result.visible) }} 家</span
        >
        <span v-else-if="result"> · {{ number(result.points.length) }} 个区域</span>
        <span v-if="result && result.total > result.located">
          · {{ number(result.total - result.located) }} 家位置待完善</span
        >
        <span v-if="dataLoading" class="map-updating">正在更新…</span>
        <span v-if="boundaryError" class="map-updating">{{ boundaryError }}</span>
      </span>
      <el-button text :disabled="dataLoading" @click="overview">显示全部匹配门店</el-button>
    </div>
    <el-alert
      v-if="conversionFailed"
      title="部分门店坐标转换失败，暂未显示这些位置，请重试。"
      type="warning"
      :closable="false"
    />
    <div class="map-body" v-loading="mapLoading" element-loading-text="正在加载门店位置">
      <div ref="container" class="map-canvas" aria-label="门店位置地图" />
      <div v-if="result && mapLevel !== 'STORE'" class="map-area-hint">
        区域内完整统计 · 仅含当前权限及筛选结果 · 点击地区逐级放大
      </div>
      <div v-if="mapLevel === 'STORE'" class="map-legend" aria-label="门店标记图例">
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
        v-if="error || (!dataLoading && !mapLoading && result?.located === 0)"
        class="map-message"
        role="status"
      >
        <p>{{ error || (result?.total ? '匹配门店的位置待完善' : '当前筛选条件下暂无门店') }}</p>
        <el-button v-if="error" @click="overview">重新加载地图</el-button>
      </div>
      <div
        v-if="!error && !dataLoading && result?.located && !result.visible"
        class="map-empty-viewport"
        role="status"
      >
        当前视野暂无匹配门店，可拖动地图或显示全部
      </div>
      <article
        v-if="cluster && !focused"
        class="map-store-card cluster-stores"
        aria-label="聚合位置的门店"
      >
        <header>
          <strong>此处 {{ number(cluster.count) }} 家门店</strong
          ><el-button text aria-label="关闭门店列表" @click="cluster = null">关闭</el-button>
        </header>
        <p v-if="memberLoading">正在加载…</p>
        <p v-if="selectionError" role="alert">{{ selectionError }}</p>
        <button
          v-for="row in members?.items ?? []"
          :key="row.id"
          class="cluster-store-row"
          @click="selectRow(row)"
        >
          <strong>{{ row.name }}</strong
          ><span>{{ row.address }}</span>
        </button>
        <footer v-if="members">
          <span>共 {{ number(members.total) }} 家</span>
          <el-button text :disabled="memberLoading || !memberCursor" @click="loadMembers()"
            >首页</el-button
          >
          <el-button
            text
            :disabled="memberLoading || !members.nextCursor"
            @click="loadMembers(members.nextCursor ?? undefined)"
            >下一页</el-button
          >
        </footer>
      </article>
      <article v-if="focused" class="map-store-card">
        <el-button class="map-card-close" text aria-label="关闭门店信息" @click="clearSelection"
          >关闭</el-button
        >
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
        <span v-if="conversionFailed" class="position-not-shown">该门店尚未在地图落点</span>
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
import {
  crmStoreApi,
  type StoreQuery,
  type StoreRow,
  type StoreMapResult,
  type StoreMapPoint,
  type StorePage,
} from '@/api/core/crm-store'
import { storeMapUrl } from '@/utils/crm-store'
import {
  loadStoreMapSdk,
  loadStoreDistrictLayers,
  storeMapPositions,
  storeMapViewport,
  fitStoreMapBounds,
  layoutStoreMapLabels,
  type MapPosition,
  type StoreMapInstance,
  type StoreMapSdk,
  type StoreMarker,
} from '@/utils/crm-store-map'

const props = defineProps<{ query: StoreQuery; focusRow: StoreRow | null }>()
const emit = defineEmits<{ detail: [row: StoreRow] }>()
const container = ref<HTMLElement | null>(null)
const result = ref<StoreMapResult | null>(null)
const mapLevel = computed(() => result.value?.level ?? 'STORE')
const mapLoading = ref(false),
  dataLoading = ref(false),
  error = ref(''),
  conversionFailed = ref(false)
const boundaryError = ref('')
const focused = ref<StoreRow | null>(null),
  cluster = ref<StoreMapPoint | null>(null)
const members = ref<StorePage | null>(null),
  memberLoading = ref(false),
  memberCursor = ref<string>(),
  selectionError = ref('')
let map: StoreMapInstance | null = null,
  sdk: StoreMapSdk | null = null
let generation = 0,
  selectionGeneration = 0,
  renderGeneration = 0
let request: AbortController | null = null,
  timer: ReturnType<typeof setTimeout> | undefined
let disposed = false
let labelFrame = 0
let districtLayer: StoreMarker | null = null
let districtKey = '',
  districtGeneration = 0
let districtSdk: ReturnType<typeof loadStoreDistrictLayers> | null = null
const number = (value: number) => value.toLocaleString('zh-CN')
const levelLabels = {
  PROVINCE: '按省汇总',
  PREFECTURE: '按市汇总',
  COUNTY: '按区县汇总',
  STORE: '门店位置',
}
const storefrontPath =
  'M4 11v9h16v-9M3 10l2-6h14l2 6M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M9 20v-6h6v6'
const personPath = 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M5 21v-2a7 7 0 0 1 14 0v2'
const checkPath = 'm7 12 3 3 7-7'
async function updateDistrictLayer(data: StoreMapResult) {
  const current = ++districtGeneration
  if (!sdk || !map) return
  const provinces = [
    ...new Set(data.points.flatMap((p) => (p.areaCode ? [p.areaCode.slice(0, 2) + '0000'] : []))),
  ].sort()
  const key = data.level === 'COUNTY' ? `${data.level}:${provinces.join(',')}` : data.level
  if (key === districtKey) return
  if (districtLayer) map.remove([districtLayer])
  districtLayer = null
  districtKey = ''
  boundaryError.value = ''
  if (data.level === 'STORE' || !provinces.length) return
  try {
    const layers = await (districtSdk ??= loadStoreDistrictLayers(sdk))
    if (current !== districtGeneration || disposed || !map) return
    // 直接使用高德行政区矢量图层；透明填充保留道路与底图，不下载边界后自行描线。
    const styles = {
      fill: 'rgba(255,255,255,0)',
      'nation-stroke': '',
      'coastline-stroke': '',
      'province-stroke': '#64748b',
      'city-stroke': data.level === 'PROVINCE' ? '' : '#33867d',
      'county-stroke': '#77869a',
      'stroke-width': 1.2,
    }
    districtLayer =
      data.level === 'COUNTY'
        ? new layers.Province({ zIndex: 10, adcode: provinces, depth: 2, styles })
        : new layers.Country({
            zIndex: 10,
            SOC: 'CHN',
            depth: data.level === 'PROVINCE' ? 1 : 2,
            styles,
          })
    map.add([districtLayer])
    districtKey = key
  } catch {
    if (current !== districtGeneration || disposed) return
    districtSdk = null
    boundaryError.value = '行政区边界暂未加载'
  }
}
function markerContent(privatePool: boolean, cooperated: boolean) {
  // SVG 只使用固定图形；门店名称和数量通过 DOM 文本属性设置。
  return `<svg class="marker-pin" viewBox="0 0 40 46" aria-hidden="true">
    <circle class="marker-halo" cx="20" cy="18" r="18" />
    <path class="marker-shell" d="M20 46C16 41 5 28 5 18a15 15 0 0 1 30 0c0 10-11 23-15 28Z" />
    <path class="marker-symbol" transform="translate(10 8) scale(.83)" d="${privatePool ? personPath : storefrontPath}" />
  </svg>${cooperated ? `<svg class="marker-cooperated" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="${checkPath}" /></svg>` : ''}`
}
function clearSelection() {
  selectionGeneration++
  focused.value = null
  cluster.value = null
  selectionError.value = ''
  void renderPoints()
}
async function selectRow(row: StoreRow) {
  focused.value = row
  cluster.value = null
  await renderPoints()
}
async function selectStore(id: string) {
  const current = ++selectionGeneration
  selectionError.value = ''
  try {
    const row = await crmStoreApi.detail(id, props.query.view)
    if (current === selectionGeneration && !disposed) await selectRow(row)
  } catch (e) {
    if (current === selectionGeneration && !disposed)
      error.value = e instanceof Error ? e.message : '门店信息加载失败'
  }
}
async function loadMembers(cursor?: string) {
  if (!cluster.value) return
  const current = ++selectionGeneration,
    point = cluster.value
  memberLoading.value = true
  selectionError.value = ''
  try {
    const page = await crmStoreApi.mapStores({
      ...props.query,
      ...point.bounds,
      coordinateSystem: point.coordinateSystem,
      cursor,
      size: 20,
    })
    if (current !== selectionGeneration || disposed) return
    members.value = page
    memberCursor.value = cursor
  } catch (e) {
    if (current === selectionGeneration && !disposed)
      selectionError.value = e instanceof Error ? e.message : '门店加载失败，请重试'
  } finally {
    if (current === selectionGeneration) memberLoading.value = false
  }
}
function openCluster(point: StoreMapPoint, position: MapPosition) {
  clearSelection()
  if (!map) return
  const samePosition =
    point.bounds.east - point.bounds.west < 0.0002 &&
    point.bounds.north - point.bounds.south < 0.0002
  if (map.getZoom() >= 18 || samePosition) {
    cluster.value = point
    members.value = null
    void loadMembers()
  } else map.setZoomAndCenter(Math.min(18, map.getZoom() + 2), position)
}
function openArea(point: StoreMapPoint) {
  clearSelection()
  if (!map || !container.value) return
  const level = result.value?.level
  // 市级视图中的省直管县直接进入门店；无县级建制城市在区县视图同样可继续下钻。
  const nextZoom =
    level === 'PROVINCE' ? 7 : level === 'PREFECTURE' && point.areaLevel !== 'COUNTY' ? 10 : 13
  const fit = fitStoreMapBounds(
    point.bounds,
    container.value.clientWidth,
    container.value.clientHeight,
  )
  map.setZoomAndCenter(Math.max(nextZoom, Math.min(nextZoom + 2, fit.zoom)), fit.center)
}
async function renderPoints() {
  if (!sdk || !map) return
  const current = ++renderGeneration
  const points = result.value?.points ?? []
  const selected = focused.value
  const converted = await storeMapPositions(sdk, [
    ...points.map((point) => ({ ...point, name: point.name ?? '' })),
    ...(selected ? [{ ...selected, id: `focus:${selected.id}` }] : []),
  ])
  if (current !== renderGeneration || disposed || !map) return
  conversionFailed.value = converted.conversionFailed
  map.clearMap()
  const overlays: StoreMarker[] = []
  const areaLabels: { anchor: HTMLElement; button: HTMLButtonElement; line: SVGLineElement }[] = []
  for (const point of points) {
    const position = converted.positions.get(point.id)
    if (!position || (selected && point.storeId === selected.id)) continue
    const button = document.createElement('button')
    let content: HTMLElement = button
    button.type = 'button'
    const privatePool = point.privateCount === point.count
    if (point.areaCode && point.areaLevel) {
      button.className = `crm-area-marker is-${mapLevel.value.toLowerCase()}`
      const heading = document.createElement('span')
      heading.className = 'area-name'
      heading.textContent =
        mapLevel.value === 'PROVINCE'
          ? (point.name ?? point.areaCode).replace(
              /(维吾尔自治区|壮族自治区|回族自治区|自治区|特别行政区|省|市)$/,
              '',
            )
          : mapLevel.value === 'PREFECTURE'
            ? (point.name ?? point.areaCode).replace(/市$/, '')
            : (point.name ?? point.areaCode)
      const count = document.createElement('strong')
      count.textContent = number(point.count)
      button.append(heading, count)
      button.title = `${point.name} · 当前权限及筛选内 ${number(point.count)} 家 · 私海 ${number(point.privateCount)} 家 · 已合作 ${number(point.cooperatedCount)} 家`
      button.setAttribute('aria-label', `放大查看${point.name}，${point.count} 家门店`)
      button.onclick = () => openArea(point)
      const anchor = document.createElement('div')
      anchor.className = 'crm-area-anchor'
      const connector = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      connector.setAttribute('aria-hidden', 'true')
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      connector.append(line)
      anchor.append(connector, button)
      areaLabels.push({ anchor, button, line })
      content = anchor
    } else if (point.count > 1) {
      button.className = `crm-store-cluster${privatePool ? ' is-private' : ''}${point.cooperatedCount === point.count ? ' is-cooperated' : ''}`
      button.textContent = number(point.count)
      button.title = `${number(point.count)} 家门店 · 私海 ${number(point.privateCount)} 家 · 已合作 ${number(point.cooperatedCount)} 家`
      button.setAttribute('aria-label', `查看此处 ${point.count} 家门店`)
      button.onclick = () => openCluster(point, position)
    } else {
      button.className = `crm-store-marker${privatePool ? ' is-private' : ''}`
      button.innerHTML = markerContent(privatePool, point.cooperatedCount > 0)
      button.title = `${point.name} · ${privatePool ? '私海' : '公海'}${point.cooperatedCount ? ' · 已合作' : ''}`
      button.setAttribute(
        'aria-label',
        `查看门店${point.name}，${privatePool ? '私海' : '公海'} · ${point.cooperatedCount ? '已合作' : '未合作'}`,
      )
      button.onclick = () => void selectStore(point.storeId!)
    }
    overlays.push(
      new sdk.Marker({
        position,
        content,
        anchor: point.areaCode || point.count > 1 ? 'center' : 'bottom-center',
      }),
    )
  }
  const selectedPosition = selected ? converted.positions.get(`focus:${selected.id}`) : null
  if (selected && selectedPosition) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `crm-store-marker is-selected${selected.poolType === 'PRIVATE' ? ' is-private' : ''}`
    button.innerHTML = markerContent(
      selected.poolType === 'PRIVATE',
      selected.cooperationStatus === 'COOPERATED',
    )
    button.title = selected.name
    button.setAttribute('aria-label', `打开${selected.name}详情`)
    button.setAttribute('aria-pressed', 'true')
    button.onclick = () => emit('detail', selected)
    overlays.push(
      new sdk.Marker({
        position: selectedPosition,
        content: button,
        anchor: 'bottom-center',
        zIndex: 200,
      }),
    )
  }
  map.add(overlays)
  cancelAnimationFrame(labelFrame)
  labelFrame = requestAnimationFrame(() => {
    if (current !== renderGeneration || disposed || !container.value) return
    const canvas = container.value.getBoundingClientRect()
    const offsets = layoutStoreMapLabels(
      areaLabels.map(({ anchor }) => {
        const box = anchor.getBoundingClientRect()
        return {
          x: box.left - canvas.left,
          y: box.top - canvas.top,
          width: box.width,
          height: box.height,
        }
      }),
      canvas.width,
      canvas.height,
    )
    areaLabels.forEach(({ button, line }, index) => {
      const offset = offsets[index]
      button.style.transform = `translate(${offset.x}px, ${offset.y}px)`
      line.setAttribute('x2', String(offset.x))
      line.setAttribute('y2', String(offset.y))
    })
  })
}
async function centerOnStore(row: StoreRow) {
  if (!sdk || !map) return
  await selectRow(row)
  const converted = await storeMapPositions(sdk, [row])
  const position = converted.positions.get(row.id)
  if (!disposed && focused.value?.id === row.id && position) map.setZoomAndCenter(16, position)
}
function scheduleRefresh() {
  clearTimeout(timer)
  cancelAnimationFrame(labelFrame)
  request?.abort()
  generation++
  timer = setTimeout(() => void refresh(false), 300)
}
async function refresh(fit: boolean, focusRequested = false) {
  clearTimeout(timer)
  request?.abort()
  const current = ++generation
  request = new AbortController()
  dataLoading.value = true
  error.value = ''
  mapLoading.value = !map
  const viewport = !fit && map ? storeMapViewport(map) : {}
  try {
    const [loadedSdk, data] = await Promise.all([
      loadStoreMapSdk(),
      crmStoreApi.map({ ...props.query, cursor: undefined, size: 20, ...viewport }, request.signal),
    ])
    if (current !== generation || disposed || !container.value) return
    sdk = loadedSdk
    if (!map) {
      map = new sdk.Map(container.value, {
        zoom: 4,
        zooms: [2, 20],
        center: [104.1954, 35.8617],
        viewMode: '2D',
        resizeEnable: true,
      })
      map.on('moveend', scheduleRefresh)
      map.on('zoomend', scheduleRefresh)
      map.on('resize', scheduleRefresh)
    }
    result.value = data
    void updateDistrictLayer(data)
    await renderPoints()
    if (current !== generation || disposed) return
    if (fit && focusRequested && props.focusRow) await centerOnStore(props.focusRow)
    else if (fit && data.bounds) {
      const b = data.bounds
      const fit = fitStoreMapBounds(
        { west: b.west - 0.02, south: b.south - 0.02, east: b.east + 0.02, north: b.north + 0.02 },
        container.value.clientWidth,
        container.value.clientHeight,
      )
      map.setZoomAndCenter(fit.zoom, fit.center)
    }
  } catch (e) {
    if (current === generation && !disposed) {
      map?.clearMap()
      result.value = null
      error.value = e instanceof Error ? e.message : '地图数据加载失败，请重试'
    }
  } finally {
    if (current === generation) {
      dataLoading.value = false
      mapLoading.value = false
    }
  }
}
function overview() {
  clearSelection()
  void refresh(true)
}
watch(
  () => props.query,
  () => {
    result.value = null
    clearSelection()
    map?.clearMap()
    void refresh(true)
  },
)
watch(
  () => props.focusRow,
  (row) => {
    if (row) void centerOnStore(row)
    else clearSelection()
  },
)
onMounted(() => void refresh(true, true))
onBeforeUnmount(() => {
  disposed = true
  districtGeneration++
  if (districtLayer) map?.remove([districtLayer])
  cancelAnimationFrame(labelFrame)
  generation++
  renderGeneration++
  selectionGeneration++
  request?.abort()
  clearTimeout(timer)
  map?.off('moveend', scheduleRefresh)
  map?.off('zoomend', scheduleRefresh)
  map?.off('resize', scheduleRefresh)
  map?.destroy()
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
.map-level {
  display: inline-flex;
  align-items: center;
  margin-right: 10px;
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}
.map-area-hint {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 6px 10px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  background: var(--el-bg-color);
  color: var(--el-text-color-secondary);
  font-size: 12px;
  pointer-events: none;
}
.map-canvas :deep(.crm-area-marker) {
  position: relative;
  z-index: 1;
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  width: max-content;
  padding: 4px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: var(--el-bg-color);
  color: var(--el-text-color-primary);
  font-family: inherit;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: 0 1px 4px #0f172a14;
  transition:
    box-shadow 140ms ease,
    border-color 140ms ease;
}
.map-canvas :deep(.crm-area-anchor) {
  position: relative;
  width: max-content;
  pointer-events: none;
}
.map-canvas :deep(.amap-marker:has(.crm-area-anchor)) {
  // SDK 在外壳写入内联 pointer-events；错位标签只由可见按钮接收点击。
  pointer-events: none !important;
}
.map-canvas :deep(.crm-area-anchor > svg) {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 1px;
  height: 1px;
  overflow: visible;
  pointer-events: none;
  stroke: #64748b;
  stroke-width: 1;
}
.map-canvas :deep(.crm-area-marker .area-name) {
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}
.map-canvas :deep(.crm-area-marker strong) {
  font-size: 13px;
  line-height: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.map-canvas :deep(.crm-area-marker.is-province) {
  gap: 6px;
  padding: 3px 3px 3px 10px;
  border-color: #a5b4d0;
  border-radius: 999px;
  color: #243b64;
  box-shadow: 0 2px 6px #243b641a;
}
.map-canvas :deep(.crm-area-marker.is-province .area-name) {
  font-size: 13px;
  font-weight: 600;
}
.map-canvas :deep(.crm-area-marker.is-province strong) {
  padding: 2px 7px;
  border-radius: 999px;
  background: #284b7a;
  color: #fff;
  font-size: 14px;
  line-height: 20px;
}
.map-canvas :deep(.crm-area-marker.is-prefecture) {
  gap: 6px;
  padding: 3px 3px 3px 10px;
  border-color: color-mix(in srgb, var(--el-color-primary) 38%, white);
  border-radius: 999px;
  color: var(--el-color-primary);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--el-color-primary) 10%, transparent);
}
.map-canvas :deep(.crm-area-marker.is-prefecture .area-name) {
  font-size: 13px;
  font-weight: 600;
}
.map-canvas :deep(.crm-area-marker.is-prefecture strong) {
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--el-color-primary);
  color: #fff;
  font-size: 14px;
  line-height: 20px;
}
.map-canvas :deep(.crm-area-marker.is-county) {
  gap: 8px;
  padding: 4px 5px 4px 10px;
  border-color: #a898c3;
  border-left: 3px solid #7c3aed;
  border-radius: 6px;
  background: #fff;
  color: #35234f;
  box-shadow: 0 2px 6px #35234f24;
}
.map-canvas :deep(.crm-area-marker.is-county .area-name) {
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}
.map-canvas :deep(.crm-area-marker.is-county strong) {
  min-width: 26px;
  padding: 1px 7px;
  border-radius: 4px;
  background: #ede9fe;
  color: #5b21b6;
  font-size: 15px;
  line-height: 22px;
  text-align: center;
}
.map-canvas :deep(.crm-area-marker:hover) {
  border-color: var(--el-color-primary);
  box-shadow: 0 3px 12px #1e40af40;
}
.map-canvas :deep(.crm-area-marker:focus-visible) {
  outline: 3px solid var(--el-color-primary-light-5);
  outline-offset: 3px;
}
@media (prefers-reduced-motion: reduce) {
  .map-canvas :deep(.crm-area-marker) {
    transition: none;
  }
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

.map-counts strong {
  color: #334155;
  font-variant-numeric: tabular-nums;
}
.map-updating {
  margin-left: 10px;
  color: #2563eb;
}
.map-card-close {
  float: right;
  margin: -6px -8px 0 6px;
}
.map-empty-viewport {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 14px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  color: #64748b;
  font-size: 13px;
}
.cluster-stores header,
.cluster-stores footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.cluster-stores header {
  margin-bottom: 4px;
}
.cluster-store-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 100%;
  padding: 12px 0;
  border: 0;
  border-bottom: 1px solid #f1f5f9;
  text-align: left;
  background: none;
  cursor: pointer;
  color: #334155;
}
.cluster-store-row:hover {
  color: #2563eb;
}
.cluster-store-row span {
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}
.map-canvas :deep(.crm-store-cluster) {
  min-width: 44px;
  height: 44px;
  padding: 0 9px;
  border-radius: 24px;
  border: 3px solid #fff;
  background: #2563eb;
  color: #fff;
  box-shadow:
    0 0 0 5px #2563eb24,
    0 2px 8px #0f172a26;
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}
.map-canvas :deep(.crm-store-cluster.is-private) {
  background: #0f766e;
  box-shadow:
    0 0 0 5px #0f766e24,
    0 2px 8px #0f172a26;
}
.map-canvas :deep(.crm-store-cluster.is-cooperated) {
  border-color: #bbf7d0;
}
.map-canvas :deep(.crm-store-cluster:is(:hover, :focus-visible)) {
  outline: 2px solid #1e40af;
  outline-offset: 4px;
}
</style>
