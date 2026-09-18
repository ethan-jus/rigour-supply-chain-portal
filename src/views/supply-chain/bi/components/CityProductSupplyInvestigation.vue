<template>
  <section class="supply-investigation" aria-label="商品库存与采购调查" :aria-busy="loading">
    <header>
      <h3>库存与采购</h3>
      <div class="supply-controls">
        <el-select
          v-model="warehouseId"
          aria-label="供货仓库"
          filterable
          remote
          clearable
          :remote-method="searchWarehouses"
          placeholder="选择供货仓库"
          @change="load"
        >
          <el-option
            v-for="warehouse in warehouses"
            :key="warehouse.id"
            :value="String(warehouse.id)"
            :label="warehouse.warehouseName"
          />
        </el-select>
        <el-select v-if="units.length" v-model="selectedKey" aria-label="库存SKU和原始单位">
          <el-option v-for="item in units" :key="item.key" :value="item.key" :label="item.label" />
        </el-select>
        <el-button :icon="Refresh" :loading="loading" :disabled="!warehouseId" @click="load"
          >核查</el-button
        >
      </div>
    </header>
    <p class="scope">仓库独立选择，不按销售城市自动匹配。采购与发货为全仓口径。</p>
    <el-alert
      v-if="warehouseError"
      :title="warehouseError"
      type="error"
      show-icon
      :closable="false"
    />
    <el-button v-if="warehouseError" link :icon="Refresh" @click="searchWarehouses()"
      >重试仓库选项</el-button
    >
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
    <el-empty v-if="!warehouseId" description="请选择本次订货的供货仓库" :image-size="64" />
    <el-skeleton v-else-if="loading" :rows="3" animated />
    <template v-else-if="data && !error">
      <el-alert
        v-if="data.truncated"
        title="供货数据超出完整查询范围，请选择具体SKU或缩小期间"
        type="warning"
        :closable="false"
      />
      <template v-else>
        <p v-if="mappingWarning" class="mapping-warning" role="status">{{ mappingWarning }}</p>
        <p v-if="salesQuantity != null" class="scope">
          当前销售范围订货数量（未扣退货）：<strong
            >{{ quantity(salesQuantity) }} {{ unitName(currentUnit?.unitCode) }}</strong
          >
        </p>
        <div class="supply-charts">
          <section>
            <h4>
              {{ warehouseName }} · 当前库存{{
                currentUnit ? `（${unitName(currentUnit.unitCode)}）` : ''
              }}
            </h4>
            <p :class="['source-state', { warning: data.inventoryStatus.status !== 'FRESH' }]">
              {{ sourceStatus(data.inventoryStatus) }}
            </p>
            <EchartsChart v-if="stock" :option="stockOption" :height="235" />
            <el-empty
              v-else
              description="该仓库没有匹配商品/SKU的库存快照，不能视为零库存"
              :image-size="48"
            />
          </section>
          <section>
            <h4>
              全仓采购与发货 · {{ currentUnit ? unitName(currentUnit.unitCode) : '原始单位' }}
            </h4>
            <p :class="['source-state', { warning: data.operationStatus.status !== 'FRESH' }]">
              {{ sourceStatus(data.operationStatus) }}
            </p>
            <EchartsChart v-if="operations.length" :option="operationOption" :height="235" />
            <el-empty
              v-else
              description="当前期间没有同SKU同单位的采购/发货事实"
              :image-size="48"
            />
          </section>
        </div>
        <el-collapse>
          <el-collapse-item title="供货核查明细" name="facts">
            <el-table :data="data.stocks" max-height="280">
              <el-table-column prop="warehouseName" label="仓库" min-width="140" />
              <el-table-column prop="specification" label="规格" min-width="160" />
              <el-table-column label="单位"
                ><template #default="scope">{{
                  unitName(scope.row.unitCode)
                }}</template></el-table-column
              >
              <el-table-column
                v-for="(label, key) in stockMetrics"
                :key="key"
                :label="label"
                align="right"
                ><template #default="scope">{{
                  quantity(scope.row[key])
                }}</template></el-table-column
              >
            </el-table>
          </el-collapse-item>
        </el-collapse>
      </template>
    </template>
  </section>
</template>
<script setup lang="ts">
import { displayDateTime } from '@/utils/business-date'
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import type { EChartsCoreOption } from 'echarts/core'
import {
  getCityProductSupply,
  type CityProductSupplyView,
  type CityProductReportQuery,
  type CityProductReportRow,
} from '@/api/core/bi-city-product-report'
import { getErpInventoryWarehouses, type ErpInternalWarehouseView } from '@/api/core/erp-internal'
import {
  supplyComparability,
  supplyOperationsForUnit,
  supplyEvidenceBlockedReason,
  type SupplyEvidence,
} from '../city-product-investigation'
import { decimalSum } from '../city-product-export'
import { reportQuantityText, reportUnitName as unitName } from '../report-format'
import EchartsChart from './EchartsChart.vue'

const props = defineProps<{ query: CityProductReportQuery; salesRows: CityProductReportRow[] }>()
const emit = defineEmits<{ (event: 'evidence-change', evidence: SupplyEvidence): void }>()
const warehouses = ref<ErpInternalWarehouseView[]>([])
const warehouseId = ref('')
const selectedKey = ref('')
const loading = ref(false)
const error = ref('')
const warehouseError = ref('')
const data = shallowRef<CityProductSupplyView | null>(null)
let request = 0
let warehouseRequest = 0
let disposed = false
const stockMetrics = {
  availableQuantity: '可用',
  lockedQuantity: '锁定',
  inTransitQuantity: '在途',
} as const
const quantity = (value: string | number | null) =>
  value == null ? '未提供' : reportQuantityText(value)
const warehouseName = computed(
  () =>
    warehouses.value.find((row) => String(row.id) === warehouseId.value)?.warehouseName ||
    '所选仓库',
)
const units = computed(() => {
  const result = new Map<string, { key: string; skuId: string; unitCode: string; label: string }>()
  for (const row of [...(data.value?.stocks ?? []), ...(data.value?.operations ?? [])]) {
    if (!row.skuId || !row.unitCode || ['UNKNOWN', 'MULTI'].includes(row.unitCode)) continue
    const key = JSON.stringify([row.skuId, row.unitCode])
    if (result.has(key)) continue
    const specification =
      'specification' in row
        ? row.specification
        : props.salesRows.find((item) => item.skuId === row.skuId)?.specification
    result.set(key, {
      key,
      skuId: row.skuId,
      unitCode: row.unitCode,
      label: `${specification || '未填写规格'} · ${unitName(row.unitCode)}`,
    })
  }
  return [...result.values()]
})
const currentUnit = computed(() => units.value.find((row) => row.key === selectedKey.value))
const stock = computed(() =>
  data.value?.stocks.find(
    (row) =>
      row.warehouseId === warehouseId.value &&
      row.productId === String(props.query.productId) &&
      row.skuId === currentUnit.value?.skuId &&
      row.unitCode === currentUnit.value?.unitCode,
  ),
)
const salesQuantity = computed(() => {
  if (!stock.value || supplyComparability(stock.value, props.salesRows) !== 'SAME_UNIT') return null
  const rows = props.salesRows.filter(
    (row) => row.productId === stock.value!.productId && row.skuId === stock.value!.skuId,
  )
  return rows.some((row) => row.quantity == null)
    ? null
    : decimalSum(rows.map((row) => row.quantity))
})
const operations = computed(() =>
  data.value && currentUnit.value
    ? supplyOperationsForUnit(data.value, currentUnit.value.skuId, currentUnit.value.unitCode)
    : [],
)
const mappingWarning = computed(() => {
  if (
    data.value?.stocks.some(
      (row) => !row.skuId || !row.unitCode || ['UNKNOWN', 'MULTI'].includes(row.unitCode),
    )
  )
    return '部分库存记录缺少SKU或原始单位，未纳入图表；请在供货核查明细中核对。'
  if (!stock.value) return ''
  const status = supplyComparability(stock.value, props.salesRows)
  return status === 'UNIT_MISMATCH'
    ? '销售与库存的原始单位不同，未自动折箱或折桶；请先核对ERP单位和包装关系。'
    : status === 'MISSING_MAPPING'
      ? 'SKU或原始单位缺失，暂不能将库存与销售数量对照。'
      : status === 'NO_SALES'
        ? '该SKU在当前销售范围没有匹配记录，库存单独展示。'
        : ''
})
function sourceStatus(source: CityProductSupplyView['inventoryStatus']) {
  const labels = {
    FRESH: '最近24小时已同步',
    STALE: '快照已过期，订货前需重新同步核查',
    FAILED: '最近同步失败，旧快照仅供核对',
    RUNNING: '正在同步，快照可能未完整',
    UNAVAILABLE: '尚无成功同步记录',
  }
  return `${labels[source.status]}${source.lastSuccessAt && Number.isFinite(new Date(source.lastSuccessAt).getTime()) ? ` · ${displayDateTime(source.lastSuccessAt)}` : ''}`
}
const stockOption = computed<EChartsCoreOption>(() => ({
  animation: false,
  color: ['#2878bd', '#c68c25', '#238c75'],
  grid: { left: 62, right: 18, top: 32, bottom: 32 },
  xAxis: { type: 'category', data: Object.values(stockMetrics) },
  yAxis: { type: 'value' },
  tooltip: {
    trigger: 'axis',
    renderMode: 'richText',
    confine: true,
    valueFormatter: (value: unknown) =>
      `${quantity(value as string)} ${unitName(currentUnit.value?.unitCode)}`,
  },
  series: [
    {
      type: 'bar',
      barMaxWidth: 42,
      label: {
        show: true,
        position: 'top',
        formatter: (params: { value: unknown }) => quantity(params.value as string),
      },
      data: Object.keys(stockMetrics).map((key, index) => ({
        value:
          stock.value?.[key as keyof typeof stockMetrics] == null
            ? null
            : Number(stock.value[key as keyof typeof stockMetrics]),
        itemStyle: { color: ['#2878bd', '#c68c25', '#238c75'][index] },
      })),
    },
  ],
}))
const operationOption = computed<EChartsCoreOption>(() => ({
  animation: false,
  color: ['#2878bd', '#238c75'],
  legend: { top: 0, data: ['采购订购量', '已发货量'] },
  grid: { left: 62, right: 18, top: 40, bottom: 32 },
  tooltip: {
    trigger: 'axis',
    renderMode: 'richText',
    confine: true,
    valueFormatter: (value: unknown) =>
      `${quantity(value as string)} ${unitName(currentUnit.value?.unitCode)}`,
  },
  xAxis: {
    type: 'category',
    data: operations.value.map((row) => row.month),
    axisLabel: { hideOverlap: true },
  },
  yAxis: { type: 'value' },
  series: (['procurementQuantity', 'shippedQuantity'] as const).map((key) => ({
    type: 'line',
    showSymbol: true,
    connectNulls: false,
    name: key === 'procurementQuantity' ? '采购订购量' : '已发货量',
    data: operations.value.map((row) => (row[key] == null ? null : Number(row[key]))),
  })),
}))
async function searchWarehouses(keyword = '') {
  const sequence = ++warehouseRequest
  warehouseError.value = ''
  try {
    const items: ErpInternalWarehouseView[] = []
    for (let begin = 0; ; begin += 100) {
      const result = await getErpInventoryWarehouses({
        begin,
        step: 100,
        warehouseName: keyword || undefined,
      })
      if (disposed || sequence !== warehouseRequest) return
      items.push(...result.items)
      if (items.length >= result.total) break
      if (!result.items.length || begin >= 9900)
        throw new Error('仓库选项未完整加载，请按仓库名称搜索')
    }
    const selected = warehouses.value.find((row) => String(row.id) === warehouseId.value)
    warehouses.value =
      selected && !items.some((row) => row.id === selected.id) ? [selected, ...items] : items
  } catch (cause) {
    if (!disposed && sequence === warehouseRequest)
      warehouseError.value = message(cause, '供货仓库选项暂不可用，请检查ERP权限或服务')
  }
}
function message(cause: unknown, fallback: string) {
  return cause &&
    typeof cause === 'object' &&
    'message' in cause &&
    typeof cause.message === 'string'
    ? cause.message
    : fallback
}
async function load() {
  const sequence = ++request
  data.value = null
  error.value = ''
  const query = props.query
  if (!warehouseId.value || !query.productId || !query.from || !query.to) {
    loading.value = false
    return
  }
  loading.value = true
  try {
    const result = await getCityProductSupply({
      from: query.from,
      to: query.to,
      productId: String(query.productId),
      warehouseId: warehouseId.value,
      skuId: query.skuId ? String(query.skuId) : undefined,
    })
    if (disposed || sequence !== request) return
    if (!result.truncated) {
      const invalid = supplyEvidenceBlockedReason(
        {
          query,
          warehouseId: warehouseId.value,
          warehouseName: warehouseName.value,
          snapshot: result,
          loading: false,
          error: '',
        },
        query,
      )
      if (invalid) throw new Error(invalid)
      for (const row of result.stocks)
        for (const key of Object.keys(stockMetrics) as (keyof typeof stockMetrics)[])
          quantity(row[key])
      for (const row of result.operations) {
        quantity(row.procurementQuantity)
        quantity(row.shippedQuantity)
      }
    }
    data.value = result
    if (!units.value.some((row) => row.key === selectedKey.value))
      selectedKey.value = units.value[0]?.key || ''
  } catch (cause) {
    if (!disposed && sequence === request)
      error.value = message(cause, '供货核查失败，请确认BI服务已更新及ERP数据已同步后重试')
  } finally {
    if (sequence === request) loading.value = false
  }
}
watch(() => props.query, load, { deep: true })
watch(
  [data, loading, error, warehouseId, warehouseName, () => props.query],
  () => {
    emit('evidence-change', {
      query: { ...props.query },
      warehouseId: warehouseId.value,
      warehouseName: warehouseName.value,
      snapshot: data.value,
      loading: loading.value,
      error: error.value,
    })
  },
  { immediate: true, deep: true },
)
void searchWarehouses()
onBeforeUnmount(() => {
  disposed = true
  request += 1
  warehouseRequest += 1
})
</script>
<style scoped>
.supply-investigation {
  border-top: 1px solid #dce4ec;
  padding: 20px 0;
}
header,
.supply-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
header {
  justify-content: space-between;
}
h3 {
  margin: 0;
  font-size: 16px;
}
h4 {
  margin: 12px 0 4px;
  font-size: 14px;
}
.supply-controls :deep(.el-select) {
  width: 220px;
  max-width: 100%;
}
.scope,
.source-state {
  font-size: 12px;
  color: #596a7d;
  line-height: 1.6;
}
.supply-charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}
.supply-charts > section {
  min-width: 0;
}
.mapping-warning,
.warning {
  color: #9a5a0b;
}
@media (max-width: 750px) {
  .supply-charts {
    grid-template-columns: 1fr;
  }
  .supply-controls {
    width: 100%;
  }
}
</style>
