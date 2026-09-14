<template>
  <div class="report-analysis" :class="{ 'report-analysis--single': singleCell }">
    <section v-if="!singleCell" aria-label="城市商品交叉分析">
      <header>
        <h3>城市 × 商品SKU</h3>
        <el-radio-group v-model="metric" size="small" aria-label="商品矩阵指标">
          <el-radio-button value="salesAmount">销售额</el-radio-button>
          <el-radio-button value="paidAmount">已归属回款</el-radio-button>
          <el-radio-button value="quantity">订货数量</el-radio-button>
        </el-radio-group>
      </header>
      <el-select
        v-if="metric === 'quantity'"
        v-model="unitCode"
        aria-label="销量原始单位"
        class="unit-select"
      >
        <el-option v-for="unit in units" :key="unit" :value="unit" :label="unitName(unit)" />
      </el-select>
      <EchartsChart
        v-if="matrix.points.some((point) => point[metric] != null)"
        :option="matrixOption"
        :height="chartHeight"
        @chart-click="selectPoint"
      />
      <el-empty
        v-else
        :description="
          metric === 'quantity'
            ? '所选原始单位没有可统计的订货数量'
            : metric === 'paidAmount'
              ? '当前商品回款尚未归属，请核对明细或手动选择分摊口径'
              : '所选范围没有商品销售明细'
        "
      />
      <el-pagination
        v-if="matrix.limited"
        v-model:current-page="page"
        :page-size="20"
        :total="matrix.total"
        layout="total, prev, next"
        small
        aria-label="商品矩阵分页"
      />
      <div class="investigate-control">
        <el-select
          v-model="selectedPoint"
          filterable
          clearable
          aria-label="选择城市商品进行核查"
          placeholder="选择城市与商品SKU"
        >
          <el-option
            v-for="(point, index) in matrix.points"
            :key="index"
            :value="index"
            :disabled="!point.row.productId"
            :label="`${point.row.regionName || '城市待核对'} · ${matrix.products[point.x]!.label}`"
          />
        </el-select>
        <el-button
          :icon="Search"
          :disabled="selectedPoint === ''"
          @click="selectPoint({ data: { pointIndex: selectedPoint } })"
          >核查商品</el-button
        >
      </div>
    </section>
    <section aria-label="商品月度销售与回款趋势">
      <header>
        <h3>
          {{
            metric === 'quantity'
              ? `订货数量（未扣退货） · ${unitName(unitCode)}`
              : '商品销售与累计回款 · 订单月份'
          }}
        </h3>
        <el-radio-group v-if="singleCell" v-model="metric" size="small" aria-label="商品矩阵指标">
          <el-radio-button value="salesAmount">销售与回款</el-radio-button>
          <el-radio-button value="quantity">订货数量</el-radio-button>
        </el-radio-group>
      </header>
      <el-select
        v-if="singleCell && metric === 'quantity'"
        v-model="unitCode"
        aria-label="销量原始单位"
        class="unit-select"
      >
        <el-option v-for="unit in units" :key="unit" :value="unit" :label="unitName(unit)" />
      </el-select>
      <p v-if="trend.some((row) => row.incomplete) && metric !== 'quantity'" class="trend-note">
        SKU回款尚未完整归属，曲线仅含已归属部分。
      </p>
      <EchartsChart
        v-if="
          report.monthlyRows?.length &&
          trend.some((row) =>
            metric === 'quantity'
              ? row.quantity != null
              : row.salesAmount != null || row.paidAmount != null,
          )
        "
        :option="trendOption"
        :height="300"
      />
      <el-empty
        v-else
        :description="
          report.monthlyRows == null ? '接口尚未提供月度商品明细' : '所选期间及单位没有月度商品事实'
        "
      />
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Search } from '@element-plus/icons-vue'
import type { EChartsCoreOption } from 'echarts/core'
import type {
  CityProductReportQuery,
  CityProductReportView,
} from '@/api/core/bi-city-product-report'
import {
  productMatrix,
  productMonthlyTrend,
  investigationMoney,
  type ProductMetric,
} from '../city-product-investigation'
import { reportQuantityText, reportUnitName as unitName } from '../report-format'
import EchartsChart from './EchartsChart.vue'

const props = defineProps<{ report: CityProductReportView; query: CityProductReportQuery }>()
const emit = defineEmits<{
  (
    event: 'select-product',
    value: { regionCode?: string; brandId?: string; productId: string; skuId?: string },
  ): void
}>()
const metric = ref<ProductMetric>('salesAmount')
const unitCode = ref('')
const page = ref(1)
const selectedPoint = ref<number | ''>('')
const units = computed(() => [
  ...new Set(
    props.report.rows.flatMap((row) =>
      row.unitCode && !['UNKNOWN', 'MULTI'].includes(row.unitCode) ? [row.unitCode] : [],
    ),
  ),
])
watch(
  units,
  (values) => {
    if (!values.includes(unitCode.value)) unitCode.value = values[0] || ''
  },
  { immediate: true },
)
const matrix = computed(() =>
  productMatrix(props.report, {
    offset: (page.value - 1) * 20,
    unitCode: metric.value === 'quantity' ? unitCode.value || '__NO_UNIT__' : undefined,
  }),
)
const trend = computed(() =>
  productMonthlyTrend(
    props.report,
    metric.value === 'quantity' ? unitCode.value || '__NO_UNIT__' : undefined,
  ),
)
const chartHeight = computed(() =>
  Math.max(190, Math.min(520, matrix.value.cities.length * 24 + 150)),
)
const singleCell = computed(() => matrix.value.total === 1 && matrix.value.cities.length === 1)
watch([() => props.report, metric, unitCode], () => {
  page.value = 1
  selectedPoint.value = ''
})
watch(page, () => {
  selectedPoint.value = ''
})
const money = (value: string | number | null) =>
  value == null ? '未归属' : investigationMoney(value)
const matrixOption = computed<EChartsCoreOption>(() => ({
  animation: false,
  grid: { left: 68, right: 16, top: 12, bottom: 108 },
  xAxis: {
    type: 'category',
    data: matrix.value.products.map((row) => row.label),
    axisLabel: { interval: 0, width: 66, overflow: 'truncate', rotate: 25 },
  },
  yAxis: {
    type: 'category',
    data: matrix.value.cities.map(([, name]) => name),
    axisLabel: { width: 54, overflow: 'truncate' },
  },
  visualMap: {
    type: 'continuous',
    min: 0,
    max: Math.max(1, ...matrix.value.points.map((point) => Number(point[metric.value] ?? 0))),
    dimension: 2,
    orient: 'horizontal',
    bottom: 0,
    left: 'center',
    itemHeight: 90,
    text: ['高', '低'],
    inRange: { color: ['#edf5fc', '#86b6df', '#2467a4'] },
  },
  dataZoom: [
    {
      type: 'slider',
      xAxisIndex: 0,
      startValue: 0,
      endValue: Math.min(5, matrix.value.products.length - 1),
      bottom: 42,
      height: 12,
    },
    { type: 'inside', yAxisIndex: 0 },
  ],
  tooltip: {
    renderMode: 'richText',
    confine: true,
    formatter: (params: unknown) => {
      const value = (params as { data?: { pointIndex?: number } }).data?.pointIndex
      const point = value == null ? undefined : matrix.value.points[value]
      return point
        ? `${point.row.regionName || '城市待核对'} · ${point.row.productName || '商品待核对'}\n${point.row.specification || ''}\n销售额 ${point.salesAmount == null ? '未提供' : money(point.salesAmount)}\n已归属回款 ${money(point.paidAmount)}\n订货数量 ${point.quantity == null ? '未提供' : reportQuantityText(point.quantity)} ${unitName(point.row.unitCode)}${point.incomplete ? '\n回款归属未完整' : ''}`
        : ''
    },
  },
  series: [
    {
      type: 'heatmap',
      data: matrix.value.points.flatMap((point, pointIndex) =>
        point[metric.value] == null
          ? []
          : [{ value: [point.x, point.y, Number(point[metric.value])], pointIndex }],
      ),
      itemStyle: { borderWidth: 2, borderColor: '#fff' },
    },
  ],
}))
const trendOption = computed<EChartsCoreOption>(() => {
  const quantity = metric.value === 'quantity'
  return {
    animation: false,
    color: ['#2878bd', '#238c75'],
    grid: { left: 62, right: 18, top: 38, bottom: 48 },
    legend: {
      top: 0,
      type: 'scroll',
      data: quantity ? ['订货数量（未扣退货）'] : ['商品销售额', '已归属回款额'],
    },
    tooltip: {
      trigger: 'axis',
      renderMode: 'richText',
      confine: true,
      valueFormatter: (value: unknown) =>
        value == null
          ? '未提供'
          : quantity
            ? `${reportQuantityText(value)} ${unitName(unitCode.value)}`
            : money(value as number),
    },
    xAxis: {
      type: 'category',
      data: trend.value.map((row) => row.month),
      axisLabel: { hideOverlap: true },
    },
    yAxis: {
      type: 'value',
      name: quantity ? unitName(unitCode.value) : '万元',
      axisLabel: {
        formatter: (value: number) => (quantity ? String(value) : String(value / 10000)),
      },
    },
    series: (quantity ? (['quantity'] as const) : (['salesAmount', 'paidAmount'] as const)).map(
      (key) => ({
        name:
          key === 'quantity'
            ? '订货数量（未扣退货）'
            : key === 'salesAmount'
              ? '商品销售额'
              : '已归属回款额',
        type: 'line',
        showSymbol: true,
        connectNulls: false,
        data: trend.value.map((row) => (row[key] == null ? null : Number(row[key]))),
      }),
    ),
  }
})
function selectPoint(params: unknown) {
  const index = (params as { data?: { pointIndex?: number } }).data?.pointIndex
  const row = index == null ? undefined : matrix.value.points[index]?.row
  if (row?.productId)
    emit('select-product', {
      regionCode: row.regionCode || undefined,
      brandId: row.brandId || undefined,
      productId: row.productId,
      skuId: row.skuId || undefined,
    })
}
</script>
<style scoped>
.report-analysis {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 24px;
  border-top: 1px solid #dce4ec;
  padding: 20px 0;
}
.report-analysis--single {
  grid-template-columns: minmax(0, 1fr);
}
.investigate-control {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.investigate-control :deep(.el-select) {
  flex: 1;
  min-width: 160px;
}
.unit-select {
  max-width: 160px;
}
.trend-note {
  color: #9a5a0b;
  font-size: 12px;
  line-height: 1.5;
}
section {
  min-width: 0;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 42px;
}
h3 {
  font-size: 15px;
  margin: 0;
}
@media (max-width: 850px) {
  .report-analysis {
    grid-template-columns: 1fr;
  }
}
</style>
