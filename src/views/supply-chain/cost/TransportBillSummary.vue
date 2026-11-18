<template>
  <div class="transport-bill-summary" aria-label="账单汇总">
    <div v-for="(item, index) in items" :key="item.label" class="bill-metric">
      <span>{{ item.label }}</span>
      <slot v-if="index === 0" name="total"
        ><strong>{{ money(item.value) }}</strong></slot
      >
      <strong v-else>{{ money(item.value) }}</strong>
    </div>
  </div>
</template>
<script setup lang="ts">
import { money } from './transport-records'
defineProps<{ items: { label: string; value: unknown }[] }>()
</script>
<style scoped>
.transport-bill-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr));
  gap: 12px;
  margin: 16px 0 20px;
}
.bill-metric {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 14px;
  min-width: 0;
  padding: 18px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-light);
}
.bill-metric > span {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.bill-metric strong {
  font-size: 25px;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.bill-metric :deep(.el-input-number) {
  width: 100%;
}
.bill-metric :deep(.el-input__inner) {
  font-size: var(--el-font-size-base);
  font-weight: 400;
  text-align: left;
}
</style>
