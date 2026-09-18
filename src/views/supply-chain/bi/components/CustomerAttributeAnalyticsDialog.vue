<template>
  <el-dialog
    v-model="visible"
    title="客户来源与经营类别"
    width="min(1100px, 96vw)"
    destroy-on-close
  >
    <div v-loading="loading">
      <p class="scope-note">{{ scopeLabel }}。客户类型、商品分类及订单来源：全部。</p>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <el-empty
        v-else-if="data?.status === 'NOT_READY'"
        description="客户属性尚未同步，请同步客户数据后重试"
      />
      <el-empty v-else-if="data?.status === 'EMPTY'" description="当前范围暂无客户档案" />
      <template v-else-if="data?.status === 'READY'">
        <el-alert :title="qualityNote" type="info" :closable="false" show-icon />
        <el-tabs v-model="tab">
          <el-tab-pane
            v-for="group in groups"
            :key="group.key"
            :label="group.title"
            :name="group.key"
          >
            <EchartsChart
              :option="chart(group.items)"
              :height="Math.min(640, Math.max(260, group.items.length * 32 + 70))"
            />
            <el-table :data="group.items" max-height="360">
              <el-table-column prop="name" :label="group.title" min-width="160" fixed />
              <el-table-column prop="customerCount" label="当前客户数" width="110" align="right" />
              <el-table-column label="期间下单客户" width="120" align="right">
                <template #default="{ row }">{{ row.orderingCustomerCount ?? '—' }}</template>
              </el-table-column>
              <el-table-column label="期间订单数" width="110" align="right">
                <template #default="{ row }">{{ row.orderCount ?? '—' }}</template>
              </el-table-column>
              <el-table-column label="期间订单应收" min-width="135" align="right">
                <template #default="{ row }">{{ money(row.salesAmount) }}</template>
              </el-table-column>
              <el-table-column label="对应累计回款" min-width="135" align="right">
                <template #default="{ row }">{{ money(row.paidAmount) }}</template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
        <p class="scope-note">
          来源保留原文，导入表名不代表获客渠道。按客户当前档案分类，包含期间零订单客户；仅统计关联到当前客户的订单，历史订单不代表成交时分类。订单未同步时业绩显示“—”。快照：{{
            timestamp(data.syncedAt)
          }}。
        </p>
      </template>
      <el-button :loading="loading" @click="load">刷新客户属性统计</el-button>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { displayDateTime } from '@/utils/business-date'
import { computed, ref, watch } from 'vue'
import type { EChartsOption } from 'echarts'
import {
  getCustomerAttributeAnalytics,
  type CustomerAttributeAnalytics,
  type CustomerAttributeItem,
  type CustomerAttributeQuery,
} from '@/api/core/bi-customer-attributes'
import EchartsChart from './EchartsChart.vue'
import { biErrorMessage } from '../bi-error'

const props = defineProps<{
  modelValue: boolean
  query: CustomerAttributeQuery
  scopeLabel: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})
const loading = ref(false)
const error = ref('')
const data = ref<CustomerAttributeAnalytics | null>(null)
const tab = ref('sources')
let sequence = 0
const groups = computed(() => [
  { key: 'sources', title: '客户来源', items: data.value?.sources || [] },
  { key: 'categories', title: '经营类别', items: data.value?.businessCategories || [] },
])
const qualityNote = computed(() =>
  groups.value
    .map(
      (group) =>
        `${group.title}未填写 ${group.items.filter((i) => i.missing).reduce((sum, i) => sum + i.customerCount, 0)} 户`,
    )
    .join('；'),
)
function chart(items: CustomerAttributeItem[]): EChartsOption {
  return {
    tooltip: { trigger: 'axis', renderMode: 'richText' },
    grid: { left: 150, right: 45, top: 20, bottom: 35 },
    xAxis: { type: 'value', minInterval: 1, name: '户' },
    yAxis: {
      type: 'category',
      inverse: true,
      data: items.map((i) => i.name),
      axisLabel: { width: 130, overflow: 'truncate' },
    },
    dataZoom:
      items.length > 16
        ? [{ type: 'slider', yAxisIndex: 0, startValue: 0, endValue: 15, width: 12 }]
        : [],
    series: [
      {
        type: 'bar',
        name: '当前客户数',
        barMaxWidth: 22,
        data: items.map((i) => ({
          value: i.customerCount,
          itemStyle: { color: i.missing ? '#94a3b8' : '#2563eb' },
        })),
        label: { show: true, position: 'right' },
      },
    ],
  }
}
const money = (value: number | string | null) =>
  value == null
    ? '—'
    : Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const timestamp = (value: string | null) => (value ? displayDateTime(value) : '—')
async function load() {
  const id = ++sequence
  loading.value = true
  error.value = ''
  data.value = null
  try {
    const result = await getCustomerAttributeAnalytics(props.query)
    if (id === sequence) data.value = result
  } catch (e) {
    if (id === sequence) error.value = biErrorMessage(e, '客户属性加载失败，请重试')
  } finally {
    if (id === sequence) loading.value = false
  }
}
watch(
  () => [props.modelValue, props.query] as const,
  ([open]) => {
    if (open) void load()
    else {
      sequence++
      loading.value = false
      data.value = null
    }
  },
  { deep: true, immediate: true },
)
</script>

<style scoped>
.scope-note {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.7;
}
.el-alert,
.el-table {
  margin-bottom: 16px;
}
</style>
