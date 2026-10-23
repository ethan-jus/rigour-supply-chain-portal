<template>
  <div v-if="Number(total) > 0" class="cost-ring-layout">
    <div class="cost-ring">
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
      <p class="muted">类别 / 金额（元）/ 占比</p>
      <button v-for="(group, index) in chartGroups" :key="group.key" @click="select(group.key)">
        <i
          :style="{
            background: category
              ? categoryColor(group.key, index)
              : palette[index % palette.length],
          }"
        /><span>{{ group.label }}</span
        ><strong>{{ money(group.current) }}</strong
        ><span>{{ percent(group.share) }}</span>
      </button>
      <template v-if="expanded"
        ><button
          v-for="group in groups.slice(5)"
          :key="group.key"
          class="other-city"
          @click="emit('select', group.key)"
        >
          <span /><span>{{ group.label }}</span
          ><strong>{{ money(group.current) }}</strong
          ><span>{{ percent(group.share) }}</span>
        </button></template
      >
    </div>
  </div>
  <div v-else class="empty">当前金额为零，无可计算占比。</div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import EchartsChart from '../components/EchartsChart.vue'
import type { CostGroup } from '@/api/core/bi-cost-dashboard'
import { categoryColor, eventKey, money, palette, percent, ringOption } from './cost-presentation'
const props = defineProps<{ groups: CostGroup[]; total: string; category?: boolean }>()
const emit = defineEmits<{ select: [key: string] }>()
const expanded = ref(false)
watch(
  () => props.groups,
  () => {
    expanded.value = false
  },
)
const chartGroups = computed(() => {
  if (props.category || props.groups.length <= 6) return props.groups
  const cents = props.groups.slice(5).reduce((v, g) => v + BigInt(g.current.replace('.', '')), 0n)
  const amount = `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
  return [
    ...props.groups.slice(0, 5),
    {
      key: '__others',
      label: '其他城市',
      current: amount,
      previous: null,
      delta: null,
      growth: null,
      share: ((Number(amount) / Number(props.total)) * 100).toFixed(1),
      count: props.groups.slice(5).reduce((v, g) => v + g.count, 0),
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
