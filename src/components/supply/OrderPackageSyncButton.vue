<template>
  <el-button v-if="can('integration:dhb:write')" :plain="plain" :loading="loading" @click="open"
    >{{ jobBusy ? '查看同步进度' : '同步订单' }}</el-button
  >
  <el-dialog
    v-model="visible"
    title="同步订货宝订单"
    width="780px"
    :close-on-click-modal="false"
  >
    <el-alert
      title="按依赖顺序同步订货宝订单（含明细）、收款和付款，使用服务端增量游标，并重新核对本地待处理记录。订单、明细、收款沿用来源业务创建/修改人和时间。"
      type="info"
      :closable="false"
    />
    <DhbSyncJobProgress :job="job" :notice="notice" />
    <el-alert v-if="jobError" :title="jobError" type="error" :closable="false" />
    <el-alert v-if="error" :title="error" type="error" :closable="false" class="package-sync-status" />
    <div v-if="result" aria-live="polite">
      <el-alert
        :title="resultTitle"
        :type="allSucceeded ? 'success' : 'warning'"
        :closable="false"
        class="package-sync-status"
      />
      <div class="package-sync-metrics">
        <div
          v-for="metric in totalMetrics"
          :key="metric.label"
          class="package-sync-metric"
          :class="{ 'has-issues': metric.label === '问题' && (metric.value || 0) > 0 }"
        >
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value ?? '—' }}</strong>
          <small>{{ metric.label === '问题' ? '项' : '条' }}</small>
        </div>
      </div>
      <el-table :data="packageSteps" size="small">
        <el-table-column label="对象">
          <template #default="{ row }">{{ objectLabel(row.objectType) }}</template>
        </el-table-column>
        <el-table-column prop="fetched" label="核对记录" />
        <el-table-column prop="created" label="新增">
          <template #default="{ row }">{{ row.created ?? '—' }}</template>
        </el-table-column>
        <el-table-column prop="updated" label="修改">
          <template #default="{ row }">{{ row.updated ?? '—' }}</template>
        </el-table-column>
        <el-table-column prop="repaired" label="修复">
          <template #default="{ row }">{{ row.repaired ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="问题">
          <template #default="{ row }">
            {{
              stepIssues(row) === null ? '—' : stepIssues(row)
            }}
          </template>
        </el-table-column>
      </el-table>
      <p class="package-sync-explanation">
        问题包括客户/商品/地区/员工未映射和处理失败；同一来源记录可能有多项问题，不是新增或修改数量。
      </p>
      <p
        v-for="(step, index) in packageSteps.filter((item) => item.message)"
        :key="index"
        class="package-sync-explanation"
      >
        {{ step.message }}
      </p>
    </div>
    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
      <el-button type="primary" :loading="busy" :disabled="busy || !connectorId" @click="run">
        开始同步
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import {
  getDhbSyncTasks,
  type DhbSyncOrchestrationResult,
} from '@/api/core/dhb-orchestration'
import { useDhbSyncJob } from '@/composables/useDhbSyncJob'
import DhbSyncJobProgress from './DhbSyncJobProgress.vue'

defineProps<{
  /** 与查询区其他次级按钮保持一致的浅底样式。 */
  plain?: boolean
}>()
const emit = defineEmits<{ completed: [result: DhbSyncOrchestrationResult] }>()
const { can } = useSupplyPermissions()

const visible = ref(false)
const loading = ref(false)
const error = ref('')
const connectorId = ref('')
const result = ref<DhbSyncOrchestrationResult | null>(null)
const { job, busy: jobBusy, notice, error: jobError, start } = useDhbSyncJob((value) => {
  result.value = value
  emit('completed', value)
})
const busy = computed(() => loading.value || jobBusy.value)

const packageObjectTypes = new Set(['SALES_ORDER', 'ORDER_LINE', 'RECEIPT', 'PAYMENT'])
const steps = computed(() => result.value?.tenants.flatMap((item) => item.steps) ?? [])
const packageSteps = computed(() =>
  steps.value.filter((item) => packageObjectTypes.has(item.objectType)),
)
const allSucceeded = computed(
  () =>
    packageSteps.value.length > 0 &&
    packageSteps.value.every((item) =>
      ['SUCCEEDED', 'SUCCEEDED_WITH_WARNINGS'].includes(item.status),
    ),
)

function objectLabel(value: string) {
  if (value === 'SALES_ORDER') return '订单'
  if (value === 'ORDER_LINE') return '订单明细'
  if (value === 'RECEIPT') return '收款'
  if (value === 'PAYMENT') return '付款'
  return value
}

function stepIssues(row: { rejected?: number | null; unmapped?: number | null }): number | null {
  const rejected = row.rejected ?? null
  if (rejected === null && row.unmapped === null) return null
  return (rejected ?? 0) + (row.unmapped || 0)
}

function sumMetric(key: 'created' | 'updated' | 'repaired'): number | null {
  if (!packageSteps.value.length) return null
  if (!packageSteps.value.every((item) => item[key] != null)) return null
  return packageSteps.value.reduce((total, item) => total + item[key]!, 0)
}

const totalMetrics = computed(() => {
  const rejected = packageSteps.value.every((item) => item.rejected != null)
    ? packageSteps.value.reduce((total, item) => total + item.rejected!, 0)
    : null
  const unmapped = packageSteps.value.reduce(
    (total, item) => total + (item.unmapped || 0),
    0,
  )
  return [
    { label: '新增', value: sumMetric('created') },
    { label: '修改', value: sumMetric('updated') },
    { label: '修复', value: sumMetric('repaired') },
    { label: '问题', value: rejected == null ? null : rejected + unmapped },
  ]
})

const resultTitle = computed(() => {
  if (!allSucceeded.value) return '同步未全部完成，请查看结果说明'
  if (totalMetrics.value.some((item) => item.value == null))
    return '同步完成，当前服务未提供完整数量明细'
  return `同步完成：${totalMetrics.value
    .map((item) => `${item.label} ${item.value} ${item.label === '问题' ? '项' : '条'}`)
    .join('，')}`
})

async function open() {
  if (loading.value) return
  visible.value = true
  if (jobBusy.value) return
  error.value = ''
  result.value = null
  connectorId.value = ''
  loading.value = true
  try {
    const connectors = [...new Set((await getDhbSyncTasks()).map((item) => item.connectorId))]
    if (connectors.length === 1) {
      connectorId.value = connectors[0]!
    } else if (connectors.length === 0) {
      error.value = '尚未配置订货宝同步，请管理员在集成设置中配置。'
    } else {
      error.value = '存在多个订货宝连接，请管理员在集成设置中明确订单同步来源。'
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '无法读取订货宝同步配置'
  } finally {
    loading.value = false
  }
  if (connectorId.value && !error.value) await run()
}

async function run() {
  if (!connectorId.value || busy.value) return
  error.value = ''
  result.value = null
  try {
    await start({
      scope: 'ORDER_SALES_PACKAGE',
      connectorId: connectorId.value,
      incremental: true,
      maxPages: 500,
    })
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : '同步请求未取得完整结果，请核对后台批次后重试'
  }
}
</script>

<style scoped>
.package-sync-status {
  margin: 12px 0;
}
.package-sync-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin: 16px 0;
}
.package-sync-metric {
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-light);
}
.package-sync-metric span {
  display: block;
  margin-bottom: 8px;
  color: var(--el-text-color-regular);
}
.package-sync-metric strong {
  font-size: 24px;
  margin-right: 5px;
}
.package-sync-metric small,
.package-sync-explanation {
  color: var(--el-text-color-secondary);
}
.package-sync-explanation {
  font-size: 12px;
  line-height: 1.7;
}
.package-sync-metric.has-issues strong {
  color: var(--el-color-warning);
}
@media (max-width: 600px) {
  .package-sync-metrics {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
