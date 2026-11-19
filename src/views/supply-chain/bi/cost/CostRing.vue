<template>
  <div v-if="visibleGroups.length" class="cost-ring-layout" :class="{ 'amount-list': !showRing }">
    <div v-if="showRing" class="cost-ring">
      <EchartsChart
        :option="ringOption(chartGroups, category)"
        :height="225"
        @chart-click="chartClick"
      />
      <div class="ring-center">
        <strong>{{ money(total) }}</strong
        ><small>元</small>
      </div>
    </div>
    <div class="ring-legend">
      <p class="muted">{{ showRing ? '类别 / 金额（元）/ 占比' : '类别 / 净发生金额（元）' }}</p>
      <button v-for="(group, index) in chartGroups" :key="group.key" @click="select(group.key)">
        <i
          :style="{
            background: category
              ? categoryColor(group.key, index)
              : palette[index % palette.length],
          }"
        /><span>{{ group.label }}</span
        ><strong>{{ money(group.current) }}</strong
        ><span>{{ showRing ? percent(group.share) : '—' }}</span>
      </button>
      <template v-if="expanded"
        ><button
          v-for="group in visibleGroups.slice(5)"
          :key="group.key"
          class="other-city"
          @click="emit('select', group.key)"
        >
          <span /><span>{{ group.label }}</span
          ><strong>{{ money(group.current) }}</strong
          ><span>{{ showRing ? percent(group.share) : '—' }}</span>
        </button></template
      >
    </div>
  </div>
  <div v-else class="empty">当前范围暂无计入成本的记录。</div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import EchartsChart from '../components/EchartsChart.vue'
import type { CostGroup } from '@/api/core/bi-cost-dashboard'
import { categoryColor, eventKey, money, palette, percent, ringOption } from './cost-presentation'
const props = defineProps<{ groups: CostGroup[]; total: string; category?: boolean }>()
const emit = defineEmits<{ select: [key: string] }>()
const expanded = ref(false)
const visibleGroups = computed(() =>
  props.groups.filter((group) => group.count > 0 || Number(group.current) !== 0),
)
const showRing = computed(
  () => Number(props.total) > 0 && visibleGroups.value.every((group) => Number(group.current) >= 0),
)
watch(
  () => props.groups,
  () => {
    expanded.value = false
  },
)
const chartGroups = computed(() => {
  const groups = visibleGroups.value
  if (!showRing.value || props.category || groups.length <= 6) return groups
  const otherGroups = groups.slice(5)
  const cents = otherGroups.reduce((v, g) => v + BigInt(g.current.replace('.', '')), 0n)
  const amount = `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
  return [
    ...groups.slice(0, 5),
    {
      key: '__others',
      label: '其他城市',
      current: amount,
      previous: null,
      delta: null,
      growth: null,
      share: ((Number(amount) / Number(props.total)) * 100).toFixed(1),
      count: otherGroups.reduce((v, g) => v + g.count, 0),
      missing: false,
    },
  ]
})
function select(key: string) {
  if (key === '__others') expanded.value = !expanded.value
  else emit('select', key)
}
function chartClick(event: unknown) {
  const key = eventKey(event)
  if (key) select(key)
}
</script>
