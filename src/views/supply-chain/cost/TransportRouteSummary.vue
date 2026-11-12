<template>
  <span v-if="!route.origin && !route.receivers.length" class="route-empty">-</span>
  <el-popover v-else trigger="click" placement="right-start" :width="380">
    <template #reference>
      <div class="route-summary">
        <el-timeline>
          <el-timeline-item color="var(--el-color-primary)">
            <button
              type="button"
              class="route-stop"
              :aria-label="`发货地：${route.origin?.name || '-'}，${openLabel}`"
            >
              {{ route.origin?.name || '-' }}
            </button>
            <button
              v-if="middleCount"
              type="button"
              class="route-middle"
              :aria-label="`${middleCount}个中途收货地，${openLabel}`"
            >
              {{ middleCount }}个中途收货地
            </button>
          </el-timeline-item>
          <el-timeline-item color="var(--el-color-warning)">
            <button
              type="button"
              class="route-stop"
              :aria-label="`最终收货地：${destination?.name || '-'}，${openLabel}`"
            >
              {{ destination?.name || '-' }}
            </button>
          </el-timeline-item>
        </el-timeline>
      </div>
    </template>
    <div class="route-details">
      <div class="route-details-heading">
        <strong>行驶路段</strong><span>{{ route.receivers.length }}个收货点</span>
      </div>
      <div class="route-details-stops" tabindex="0" aria-label="完整行驶路段">
        <el-timeline>
          <el-timeline-item
            v-for="(stop, index) in stops"
            :key="index"
            :color="index === 0 ? 'var(--el-color-primary)' : 'var(--el-color-warning)'"
          >
            <span class="route-phase">{{ phase(index) }}</span>
            <strong class="route-details-name">{{ stop?.name || '-' }}</strong>
            <p v-if="stop?.address && stop.address !== stop.name" class="route-address">
              {{ stop.address }}
            </p>
          </el-timeline-item>
        </el-timeline>
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TransportRoute } from './transport-records'

const props = defineProps<{ route: TransportRoute }>()
const destination = computed(() => props.route.receivers.at(-1))
const middleCount = computed(() => Math.max(0, props.route.receivers.length - 1))
const stops = computed(() => [props.route.origin, ...props.route.receivers])
const openLabel = computed(() => `查看完整行驶路段，共${props.route.receivers.length}个收货点`)
const phase = (index: number) =>
  index === 0 ? '发货地' : index === stops.value.length - 1 ? '最终收货地' : `中途收货地 ${index}`
</script>

<style scoped>
.route-summary {
  padding-block: 2px;
  min-width: 0;
}
.route-summary :deep(.el-timeline),
.route-details :deep(.el-timeline) {
  padding-left: 0;
  margin: 0;
}
.route-summary :deep(.el-timeline-item) {
  padding-bottom: 10px;
}
.route-summary :deep(.el-timeline-item:last-child),
.route-details :deep(.el-timeline-item:last-child) {
  padding-bottom: 0;
}
.route-summary :deep(.el-timeline-item__wrapper),
.route-details :deep(.el-timeline-item__wrapper) {
  padding-left: 21px;
  top: -2px;
}
.route-summary :deep(.el-timeline-item__tail) {
  border-left-width: 1px;
}
.route-stop,
.route-middle {
  display: block;
  padding: 0;
  border: 0;
  border-radius: 2px;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.route-stop {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  width: 100%;
  overflow-wrap: anywhere;
  line-height: 20px;
  color: var(--el-text-color-primary);
}
.route-middle {
  margin-top: 5px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 18px;
}
.route-stop:hover,
.route-middle:hover {
  color: var(--el-color-primary);
}
.route-stop:focus-visible,
.route-middle:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}
.route-details-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.route-details-heading span,
.route-phase {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.route-details-stops {
  max-height: 360px;
  overflow-y: auto;
  padding: 4px 8px 4px 4px;
}
.route-phase,
.route-details-name {
  display: block;
  line-height: 20px;
}
.route-details-name {
  margin-top: 2px;
  font-weight: 500;
  overflow-wrap: anywhere;
  color: var(--el-text-color-primary);
}
.route-address {
  margin: 4px 0 0;
  color: var(--el-text-color-regular);
  line-height: 20px;
  overflow-wrap: anywhere;
}
</style>
