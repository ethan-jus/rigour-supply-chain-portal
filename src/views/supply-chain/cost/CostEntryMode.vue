<template>
  <div class="cost-entry-field">
    <el-radio-group v-model="mode" size="small" :aria-label="`${label}录入方式`">
      <el-radio-button value="LINKED">选择已有</el-radio-button>
      <el-radio-button value="MANUAL">手动填写</el-radio-button>
    </el-radio-group>
    <slot v-if="mode === 'LINKED'" name="linked" />
    <slot v-else name="manual" />
    <span v-if="mode === 'MANUAL'" class="entry-hint"
      >仅用于本次费用登记，不新增{{ label }}档案。</span
    >
  </div>
</template>
<script setup lang="ts">
import type { CostEntryMode } from './use-cost-entry-mode'
defineProps<{ label: string }>()
const mode = defineModel<CostEntryMode>({ required: true })
</script>
<style scoped>
.cost-entry-field {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
}
.entry-hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 20px;
}
</style>
