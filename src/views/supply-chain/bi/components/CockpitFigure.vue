<template>
  <figure
    ref="figureElement"
    class="cockpit-figure"
    :class="[`cockpit-figure--${figure.span}`, { 'cockpit-figure--compact': figure.compact }]"
    :aria-label="figure.title"
  >
    <figcaption>
      <h2>{{ figure.title }} <span v-if="figure.sample" class="sample-label">样例</span></h2>
      <div class="figure-tools">
        <el-input
          v-if="figure.performance && figure.performance.length > 8"
          v-model="search"
          clearable
          size="small"
          class="ranking-search"
          placeholder="姓名 / 城市"
          :aria-label="`${figure.title}搜索`"
        />
        <template v-if="(figure.comparison || figure.performance) && pageCount > 1">
          <button
            class="figure-icon"
            type="button"
            :disabled="page === 0"
            :aria-label="`${figure.title}上一页`"
            title="上一页"
            @click="page--"
          >
            <el-icon><ArrowLeft /></el-icon>
          </button>
          <span class="figure-page" aria-live="polite"
            >{{ page * pageSize + 1 }}–{{ Math.min((page + 1) * pageSize, rowCount) }} /
            {{ rowCount }}</span
          >
          <button
            class="figure-icon"
            type="button"
            :disabled="page >= pageCount - 1"
            :aria-label="`${figure.title}下一页`"
            title="下一页"
            @click="page++"
          >
            <el-icon><ArrowRight /></el-icon>
          </button>
        </template>
        <button
          type="button"
          class="figure-icon"
          title="查看数据明细"
          :aria-label="`${figure.title}明细`"
          @click="$emit('inspect', figure)"
        >
          <el-icon><Grid /></el-icon>
        </button>
      </div>
    </figcaption>
    <div
      v-if="!figure.compact && figure.rows.length && (!figure.performance || rowCount)"
      class="cockpit-figure__plot"
      role="img"
      :aria-label="plotLabel"
    >
      <EchartsChart
        :option="chartOption"
        :height="figure.collection ? plotHeight - 72 : plotHeight"
        @chart-click="onChartClick"
      />
    </div>
    <div v-if="figure.collection" class="collection-amounts">
      <button
        type="button"
        :title="`已回款 ${exactAmount(figure.collection.paidAmount)}`"
        @click="$emit('inspect', figure, 'paid')"
      >
        <span><i class="collection-dot collection-dot--paid" />已回款</span>
        <strong>{{ amount(figure.collection.paidAmount) }}</strong>
      </button>
      <button
        type="button"
        :title="`待回款 ${exactAmount(figure.collection.unpaidAmount)}`"
        @click="$emit('inspect', figure, 'unpaid')"
      >
        <span><i class="collection-dot collection-dot--unpaid" />待回款</span>
        <strong>{{ amount(figure.collection.unpaidAmount) }}</strong>
      </button>
    </div>
    <div
      v-if="figure.compact || !figure.rows.length || (figure.performance && !rowCount)"
      class="cockpit-figure__empty"
      :style="{ height: `${figure.compact ? 72 : plotHeight}px` }"
    >
      <el-icon :size="28"><DataLine /></el-icon>
      <span>{{ search ? '没有匹配的销售人员' : figure.empty || '当前筛选暂无记录' }}</span>
      <el-button
        v-if="figure.emptyAction"
        link
        type="primary"
        @click="$emit('resolve-empty', figure.emptyAction)"
      >
        {{ emptyActionLabels[figure.emptyAction] }}
      </el-button>
    </div>
    <footer v-if="figure.note">{{ figure.note }}</footer>
  </figure>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, DataLine, Grid } from '@element-plus/icons-vue'
import {
  amount,
  collectionColumns,
  performanceColumns,
  exactAmount,
  percent,
} from '../cockpit-charts'
import type { Figure } from '../cockpit-model'
import EchartsChart from './EchartsChart.vue'

const props = withDefaults(defineProps<{ figure: Figure; height?: number }>(), { height: 270 })
const plotHeight = computed(() => props.figure.height || props.height)
const emit = defineEmits<{
  inspect: [figure: Figure, rowKey?: string, collectionPart?: 'paid' | 'unpaid']
  'resolve-empty': [action: NonNullable<Figure['emptyAction']>]
}>()
const figureElement = ref<HTMLElement | null>(null)
const page = ref(0)
const search = ref('')
const pageSize = ref(8)
const chartWidth = ref(800)
const performanceRows = computed(
  () =>
    props.figure.performance?.filter((row) =>
      `${row.name} ${row.region} ${row.key}`
        .toLocaleLowerCase()
        .includes(search.value.trim().toLocaleLowerCase()),
    ) || [],
)
const rowCount = computed(() =>
  props.figure.performance ? performanceRows.value.length : props.figure.comparison?.length || 0,
)
const pageCount = computed(() => Math.ceil(rowCount.value / pageSize.value))
const rawChartOption = computed(() =>
  props.figure.performance
    ? performanceColumns(
        performanceRows.value.slice(page.value * pageSize.value, (page.value + 1) * pageSize.value),
        props.figure.performance,
        props.figure.performanceMetric || '销售额',
      )
    : props.figure.comparison
      ? collectionColumns(
          props.figure.comparison.slice(
            page.value * pageSize.value,
            (page.value + 1) * pageSize.value,
          ),
          props.figure.comparison,
        )
      : props.figure.option,
)
const chartOption = computed(() => {
  const option = rawChartOption.value
  const series = Array.isArray(option.series) ? option.series : []
  if (!series.some((item) => item.type === 'heatmap')) return option
  const axis = Array.isArray(option.xAxis) ? option.xAxis[0] : option.xAxis
  const columns = Array.isArray(axis?.data) ? axis.data.length : 1
  const compactTargets = props.figure.id === 'targets' && chartWidth.value < 500
  const showLabels = chartWidth.value >= 110 + columns * (compactTargets ? 52 : 80)
  return {
    ...option,
    ...(compactTargets && axis
      ? {
          xAxis: {
            ...axis,
            axisLabel: {
              ...axis.axisLabel,
              interval: 0,
              fontSize: 10,
              formatter: (label: string) =>
                label.length > 3 ? `${label.slice(0, 2)}\n${label.slice(2)}` : label,
            },
          },
        }
      : {}),
    series: series.map((item) =>
      item.type === 'heatmap'
        ? {
            ...item,
            label: { ...item.label, show: showLabels, ...(compactTargets ? { fontSize: 10 } : {}) },
          }
        : item,
    ),
  }
})
const plotLabel = computed(() => {
  const data = props.figure.collection
  return data
    ? `${props.figure.title}，回款率${percent(data.rate)}，已回款${exactAmount(data.paidAmount)}，待回款${exactAmount(data.unpaidAmount)}`
    : `${props.figure.title}，共${props.figure.rows.length}条数据，可通过明细按钮查看`
})
let resizeObserver: ResizeObserver | undefined
watch([() => props.figure.comparison, () => props.figure.performance, search], () => {
  page.value = 0
})
onMounted(() => {
  if (!figureElement.value || typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(([entry]) => {
    chartWidth.value = entry.contentRect.width
    const size = Math.max(
      2,
      Math.min(
        8,
        Math.floor((entry.contentRect.width - 66) / (props.figure.performance ? 96 : 74)),
      ),
    )
    if (size !== pageSize.value) {
      pageSize.value = size
      page.value = 0
    }
  })
  resizeObserver.observe(figureElement.value)
})
onBeforeUnmount(() => resizeObserver?.disconnect())
const emptyActionLabels = {
  inventory: '查看采购库存',
  product: '查看商品',
  target: '经营目标',
  reset: '清除筛选',
  cost: '按城市查看成本',
}
function onChartClick(raw: unknown) {
  const params = raw as {
    data?: {
      rowKey?: string
      name?: string
      children?: unknown[]
      collectionPart?: 'paid' | 'unpaid'
    }
  }
  if (params.data?.children?.length) {
    emit('inspect', props.figure, params.data.name)
    return
  }
  emit('inspect', props.figure, params.data?.rowKey, params.data?.collectionPart)
}
</script>

<style scoped lang="scss">
.cockpit-figure {
  margin: 0;
  min-width: 0;
  padding: 18px 20px 12px;
  border-top: 1px solid #e4eaf2;
  border-right: 1px solid #e4eaf2;
  background: #fff;
  display: flex;
  flex-direction: column;
}
.cockpit-figure--4 {
  grid-column: span 4;
}
.cockpit-figure--6 {
  grid-column: span 6;
}
.cockpit-figure--8 {
  grid-column: span 8;
}
.cockpit-figure--12 {
  grid-column: span 12;
}
figcaption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 30px;
  margin-bottom: 12px;
}
.figure-tools {
  display: flex;
  flex-wrap: wrap;
  max-width: 100%;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
.ranking-search {
  width: 140px;
}
.cockpit-figure--compact {
  grid-column: span 12;
}
.cockpit-figure--compact .cockpit-figure__empty {
  flex-direction: row;
}
.figure-icon {
  width: 28px;
  height: 28px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: transparent;
  color: #637085;
  cursor: pointer;
}
.figure-icon:hover:not(:disabled) {
  background: #edf3fb;
  color: #2864e8;
}
.figure-icon:disabled {
  opacity: 0.4;
  cursor: default;
}
.figure-page {
  font-size: 11px;
  color: #637085;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.collection-amounts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  min-height: 72px;
}
.collection-amounts button {
  min-width: 0;
  border: 0;
  background: transparent;
  padding: 8px 4px;
  cursor: pointer;
  color: #23344b;
}
.collection-amounts button + button {
  border-left: 1px solid #e4eaf2;
}
.collection-amounts span {
  display: block;
  font-size: 12px;
  color: #637085;
}
.collection-amounts strong {
  display: block;
  margin-top: 6px;
  font-size: 20px;
  font-weight: 650;
  overflow-wrap: anywhere;
}
.collection-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  margin-right: 5px;
}
.collection-dot--paid {
  background: #18a999;
}
.collection-dot--unpaid {
  background: #efa534;
}
h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
  line-height: 1.5;
  color: #23344b;
}
.sample-label {
  display: inline-block;
  padding: 1px 5px;
  margin-left: 5px;
  font-size: 10px;
  font-weight: 500;
  color: #a86c15;
  background: #fff5df;
  vertical-align: middle;
}
footer {
  color: #68758a;
  font-size: 11px;
  min-height: 18px;
  margin-top: auto;
  padding-top: 7px;
  line-height: 1.6;
}
.cockpit-figure__empty {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 12px;
  color: #68758a;
  font-size: 13px;
}
:deep(button:focus-visible) {
  outline: 2px solid #2864e8;
  outline-offset: 2px;
}
@media (max-width: 1100px) {
  .cockpit-figure {
    grid-column: span 6;
  }
  .cockpit-figure--12 {
    grid-column: span 12;
  }
}
@media (max-width: 720px) {
  .cockpit-figure {
    grid-column: span 12;
    padding: 14px 12px;
  }
  figcaption {
    flex-wrap: wrap;
  }
}
</style>
