<template>
  <div class="cost-comparison" aria-label="费用金额对比">
    <p class="comparison-caption">
      {{ comparable ? '本期与可比期共用金额刻度' : '本期金额，暂无可比数据' }} · 单位：元
    </p>
    <ul v-if="groups.length" class="comparison-list">
      <li v-for="group in visibleGroups" :key="group.key" class="comparison-item">
        <div class="comparison-heading">
          <button
            class="text-button"
            :aria-label="`${group.label}，查看费用明细`"
            @click="emit('select', group.key)"
          >
            {{ group.label }}<span aria-hidden="true"> →</span>
          </button>
          <span class="comparison-delta" :class="changeClass(group.delta)">
            {{ changeText(group.delta) }}
          </span>
        </div>
        <div class="comparison-series">
          <span>本期</span>
          <div class="comparison-track" :style="zeroStyle" aria-hidden="true">
            <i class="comparison-bar current" :style="barStyle(group.current)" />
          </div>
          <strong>{{ money(group.current) }}</strong>
        </div>
        <div v-if="comparable" class="comparison-series previous">
          <span>可比期</span>
          <div class="comparison-track" :style="zeroStyle" aria-hidden="true">
            <i
              v-if="group.previous !== null"
              class="comparison-bar"
              :style="barStyle(group.previous)"
            />
          </div>
          <strong>{{ money(group.previous) }}</strong>
        </div>
      </li>
    </ul>
    <p v-else class="comparison-empty">当前范围没有已确认费用</p>
    <button
      v-if="groups.length > previewCount"
      class="comparison-expand text-button"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      {{ expanded ? '收起' : `展开全部 ${groups.length} 项` }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CostGroup } from '@/api/core/bi-cost-dashboard'
import { money } from './cost-presentation'

const props = defineProps<{ groups: CostGroup[]; comparable: boolean }>()
const emit = defineEmits<{ select: [key: string] }>()
const previewCount = 6
const expanded = ref(false)
watch(
  () => props.groups,
  () => (expanded.value = false),
)
const magnitude = (group: CostGroup) =>
  Math.max(Math.abs(Number(group.current)), props.comparable ? Math.abs(Number(group.previous)) : 0)
const sortedGroups = computed(() => [...props.groups].sort((a, b) => magnitude(b) - magnitude(a)))
const visibleGroups = computed(() =>
  expanded.value ? sortedGroups.value : sortedGroups.value.slice(0, previewCount),
)
// Number 只用于图形长度，金额展示和增减仍使用接口返回的精确值。
const domain = computed(() => {
  const values = props.groups.flatMap((group) => [
    Number(group.current),
    ...(props.comparable && group.previous !== null ? [Number(group.previous)] : []),
  ])
  const min = Math.min(0, ...values)
  return { min, span: Math.max(0, ...values) - min || 1 }
})
const zeroStyle = computed(() => ({
  '--comparison-zero': `${(-domain.value.min / domain.value.span) * 100}%`,
}))
function barStyle(value: string) {
  const amount = Number(value)
  return {
    left: `${((Math.min(0, amount) - domain.value.min) / domain.value.span) * 100}%`,
    width: `${(Math.abs(amount) / domain.value.span) * 100}%`,
  }
}
function changeClass(value: string | null) {
  return props.comparable && value !== null
    ? Number(value) > 0
      ? 'increase'
      : Number(value) < 0
        ? 'decrease'
        : ''
    : ''
}
function changeText(value: string | null) {
  if (!props.comparable || value === null) return '暂无可比数据'
  const label = Number(value) > 0 ? '增加' : Number(value) < 0 ? '减少' : '无变化'
  return `${label} ${money(value.replace(/^-/, ''))} 元`
}
</script>

<style scoped lang="scss">
.comparison-caption,
.comparison-series > span,
.comparison-empty {
  color: var(--cost-muted);
  font-size: 12px;
}
.comparison-list {
  list-style: none;
  padding: 0;
  margin: 4px 0 0;
}
.comparison-item {
  padding: 8px 0;
  border-bottom: 1px solid var(--cost-line);
}
.comparison-item:last-child {
  border-bottom: 0;
}
.comparison-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 2px 12px;
  margin-bottom: 4px;
}
.comparison-heading .text-button {
  font-size: 13px;
  color: inherit;
  font-weight: 500;
  min-height: 20px;
  line-height: 20px;
}
.comparison-heading .text-button > span {
  color: var(--cost-muted);
}
.comparison-delta {
  color: var(--cost-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.comparison-series {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) minmax(86px, max-content);
  align-items: center;
  gap: 10px;
  margin-top: 4px;
  line-height: 16px;
}
.comparison-series strong {
  font-size: 12px;
  font-weight: 500;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.comparison-series.previous strong {
  color: #afbdcc;
}
.comparison-track {
  height: 10px;
  position: relative;
  background: var(--cost-bg);
}
.comparison-track::after {
  content: '';
  position: absolute;
  left: var(--comparison-zero);
  top: -2px;
  bottom: -2px;
  border-left: 1px solid #52677d;
}
.comparison-bar {
  position: absolute;
  height: 100%;
  background: #4d667e;
  border-block: 1px dashed #9aafc3;
}
.comparison-bar.current {
  background: #78a9f0;
  border: 0;
}
.comparison-expand {
  margin-top: 8px;
}
.comparison-empty {
  padding: 32px 0;
  text-align: center;
}
@media (max-width: 620px) {
  .comparison-series {
    gap: 8px;
  }
}
</style>
