<template>
  <div class="logistics-route" :class="{ compact }" aria-label="运输路线">
    <div class="route-end">
      <span>{{ route.sender }}</span
      ><strong>{{ route.senderName }}</strong>
    </div>
    <span class="route-arrow" aria-hidden="true">→</span>
    <div class="route-end">
      <span>{{ route.receiver }}</span
      ><strong>{{ route.receiverName }}</strong>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { CostCommand, CostSource } from '@/api/core/cost'
import { logisticsRoute } from './cost-logistics'
const props = defineProps<{
  logistics: CostCommand['logistics']
  sources?: CostSource[]
  compact?: boolean
}>()
const route = computed(() => logisticsRoute(props.logistics, props.sources))
</script>
<style scoped>
.logistics-route {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 24px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 16px;
  margin: 12px 0 20px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
  background: var(--el-fill-color-light);
}
.route-end {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.route-end > span {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.route-end > strong {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  white-space: normal;
}
.route-arrow {
  color: var(--el-color-primary);
  text-align: center;
}
.compact {
  padding: 4px 0;
  margin: 0;
  border: 0;
  background: transparent;
  gap: 8px;
}
</style>
