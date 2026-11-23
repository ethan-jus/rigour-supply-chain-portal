<template>
  <div class="work-date" role="group" aria-label="切换工作日">
    <button type="button" aria-label="前一日" title="前一日" @click="step(-1)">
      <el-icon><ArrowLeft /></el-icon>
    </button>
    <input :id="id" type="date" aria-label="工作日" :value="date" :max="max" @change="change" />
    <button type="button" aria-label="后一日" title="后一日" :disabled="date >= max" @click="step(1)">
      <el-icon><ArrowRight /></el-icon>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'

const props = defineProps<{ id: string; date: string; max: string }>()
const emit = defineEmits<{ change: [date: string] }>()

function step(days: number) {
  const value = new Date(props.date + 'T12:00:00Z')
  if (!Number.isFinite(value.getTime())) return
  value.setUTCDate(value.getUTCDate() + days)
  emit('change', value.toISOString().slice(0, 10))
}
function change(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.value && input.validity.valid) emit('change', input.value)
  else input.value = props.date
}
</script>

<style scoped>
.work-date {
  display: inline-flex;
  align-items: center;
  box-sizing: border-box;
  height: var(--date-height, 34px);
  border: 1px solid #d3dce5;
  border-radius: 5px;
  background: white;
}
button {
  display: grid;
  place-items: center;
  width: var(--date-step-width, 26px);
  height: 100%;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: #526679;
  cursor: pointer;
}
button:enabled:hover {
  background: #eef3ff;
  color: var(--field-accent);
}
button:disabled {
  color: #b4bec6;
  cursor: default;
}
input {
  min-width: 0;
  border: 0;
  padding: 0 4px;
  background: transparent;
  color: var(--field-ink);
  font: inherit;
  font-size: var(--date-font-size, inherit);
  font-weight: var(--date-weight, 500);
  font-variant-numeric: tabular-nums;
}
</style>
