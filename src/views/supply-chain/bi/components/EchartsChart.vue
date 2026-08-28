<template>
  <div ref="chartElement" class="echarts-chart" :style="chartStyle" />
</template>

<script setup lang="ts">
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components'
import { init, use, type ECharts, type EChartsCoreOption } from 'echarts/core'
import { LegacyGridContainLabel } from 'echarts/features'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  LegacyGridContainLabel,
  CanvasRenderer,
])

const props = withDefaults(defineProps<{
  option: EChartsCoreOption
  loading?: boolean
  height?: number | string
}>(), {
  loading: false,
  height: 280,
})

const emit = defineEmits<{
  (event: 'chart-click', params: unknown): void
}>()

const chartElement = ref<HTMLDivElement | null>(null)
const chart = shallowRef<ECharts | null>(null)
let resizeObserver: ResizeObserver | null = null

const chartStyle = computed(() => ({
  height: typeof props.height === 'number' ? `${props.height}px` : props.height,
}))

onMounted(() => {
  void nextTick(() => {
    renderChart()
    window.addEventListener('resize', resizeChart)
    if (chartElement.value && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resizeChart)
      resizeObserver.observe(chartElement.value)
    }
  })
})

watch(() => props.option, () => renderChart(), { deep: true })
watch(() => props.loading, (loading) => {
  if (!chart.value) return
  if (loading) chart.value.showLoading('default', { text: '加载中' })
  else chart.value.hideLoading()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeChart)
  resizeObserver?.disconnect()
  chart.value?.dispose()
  chart.value = null
})

function renderChart() {
  if (!chartElement.value) return
  if (!chart.value) {
    chart.value = init(chartElement.value)
    chart.value.on('click', (params) => emit('chart-click', params))
  }
  chart.value.setOption(props.option, true)
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(resizeChart)
  } else {
    resizeChart()
  }
  if (props.loading) chart.value.showLoading('default', { text: '加载中' })
  else chart.value.hideLoading()
}

function resizeChart() {
  chart.value?.resize()
}
</script>

<style scoped lang="scss">
.echarts-chart {
  width: 100%;
  min-width: 0;
}
</style>
