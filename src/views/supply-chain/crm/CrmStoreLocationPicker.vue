<template>
  <div class="location-picker">
    <div class="location-actions">
      <el-button :disabled="disabled" :loading="locating" @click="locate">使用当前位置</el-button>
      <el-button :disabled="disabled" :loading="loading" @click="openMap">地图选点</el-button>
      <span v-if="longitude != null && latitude != null" role="status">
        {{ Number(longitude).toFixed(6) }}, {{ Number(latitude).toFixed(6) }} ·
        {{ coordinateSystem }}
      </span>
      <span v-else>请在门店现场定位，或在地图选择门店位置</span>
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <template v-if="showMap">
      <div ref="container" class="picker-map" aria-label="点击地图选择门店位置" />
      <p class="hint">点击门店实际位置选点；省市县和详细地址仍需核对。地图选点保存为 GCJ-02。</p>
    </template>
  </div>
</template>
<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import {
  loadStoreMapSdk,
  storeMapPositions,
  type StoreMapInstance,
  type StoreMapSdk,
} from '@/utils/crm-store-map'
const props = defineProps<{
  longitude?: number
  latitude?: number
  coordinateSystem: string
  areaCode: string
  disabled?: boolean
}>()
const emit = defineEmits<{
  picked: [longitude: number, latitude: number, coordinateSystem: string]
}>()
interface PickerMap extends Omit<StoreMapInstance, 'on'> {
  on(
    event: 'click',
    listener: (event: { lnglat: { getLng(): number; getLat(): number } }) => void,
  ): void
  setCity(code: string): void
}
const container = ref<HTMLElement>(),
  showMap = ref(false),
  loading = ref(false),
  locating = ref(false),
  error = ref('')
let map: PickerMap | null = null,
  sdk: StoreMapSdk | null = null,
  disposed = false,
  markerGeneration = 0
async function refreshMarker() {
  const current = ++markerGeneration
  if (!map || !sdk || props.longitude == null || props.latitude == null) return
  const { positions } = await storeMapPositions(sdk, [
    {
      id: 'selected',
      name: '门店位置',
      longitude: props.longitude,
      latitude: props.latitude,
      coordinateSystem: props.coordinateSystem,
    },
  ])
  const position = positions.get('selected')
  if (!map || !position || current !== markerGeneration) return
  map.clearMap()
  map.add([new sdk.Marker({ position, title: '选定的门店位置' })])
  map.setZoomAndCenter(16, position)
}
async function openMap() {
  if (props.disabled || loading.value) return
  showMap.value = true
  loading.value = true
  error.value = ''
  try {
    await nextTick()
    sdk = await loadStoreMapSdk()
    if (disposed || !container.value) return
    if (!map) {
      map = new sdk.Map(container.value, { zoom: 10 }) as unknown as PickerMap
      if (props.areaCode) map.setCity(props.areaCode)
      map.on('click', ({ lnglat }) => {
        if (!props.disabled) emit('picked', lnglat.getLng(), lnglat.getLat(), 'GCJ02')
      })
    }
    await refreshMarker()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '地图加载失败，可使用当前位置定位'
  } finally {
    loading.value = false
  }
}
function locate() {
  if (!navigator.geolocation) {
    error.value = '当前浏览器不支持定位，请使用地图选点'
    return
  }
  locating.value = true
  error.value = ''
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      if (disposed) return
      locating.value = false
      if (props.disabled) return
      if (coords.accuracy > 200) {
        error.value = `当前位置误差约 ${Math.round(coords.accuracy)} 米，请在地图核对后选点`
        return
      }
      emit('picked', coords.longitude, coords.latitude, 'WGS84')
    },
    () => {
      if (!disposed) {
        locating.value = false
        error.value = '未能获取当前位置，请允许浏览器定位或使用地图选点'
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
  )
}
watch(
  () => [props.longitude, props.latitude, props.coordinateSystem],
  () => {
    void refreshMarker()
  },
)
watch(
  () => props.areaCode,
  (code) => {
    if (map && code) map.setCity(code)
  },
)
onBeforeUnmount(() => {
  disposed = true
  markerGeneration++
  map?.destroy()
  map = null
})
</script>
<style scoped>
.location-picker {
  width: 100%;
}
.location-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.location-actions span,
.hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}
.picker-map {
  height: clamp(230px, 35vh, 340px);
  margin-top: 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
.error {
  color: var(--el-color-danger);
  margin: 8px 0;
}
</style>
