<template>
  <el-button v-if="can('integration:dhb:write')" :loading="loading" @click="open">{{
    jobBusy ? '查看同步进度' : buttonLabel || syncLabel
  }}</el-button>
  <el-dialog
    v-model="visible"
    :title="syncLabel"
    :width="incrementalCustomer ? '760px' : '600px'"
    :close-on-click-modal="false"
  >
    <el-alert
      :title="
        incrementalCustomer
          ? '同步订货宝新增和变更的客户，并重新核对本地待关联记录。保留客户原始创建时间和创建人。'
          : `本次只同步${label}。缺少客户、商品等映射时会保留待处理，请到对应页面补齐。`
      "
      type="info"
      :closable="false"
    />
    <el-form label-width="90px" style="margin-top: 16px">
      <el-form-item v-if="!incrementalCustomer" label="来源连接器"
        ><el-select v-model="connectorId" aria-label="来源连接器" :disabled="busy"
          ><el-option v-for="id in connectors" :key="id" :value="id" :label="id" /></el-select
      ></el-form-item>
      <el-form-item v-if="!incrementalCustomer" label="变更范围"
        ><el-date-picker
          v-model="range"
          type="datetimerange"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          :disabled="busy"
      /></el-form-item>
    </el-form>
    <div v-if="busy" role="status" class="sync-status">正在同步{{ label }}，请稍候…</div>
    <DhbSyncJobProgress v-if="incrementalCustomer" :job="job" :notice="notice" />
    <el-alert v-if="jobError" :title="jobError" type="error" :closable="false" />
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div v-if="result" aria-live="polite">
      <el-alert
        :title="resultTitle"
        :type="success ? 'success' : 'warning'"
        :closable="false"
        class="sync-status"
      />
      <template v-if="incrementalCustomer">
        <div class="sync-metrics">
          <div
            v-for="metric in customerMetrics"
            :key="metric.label"
            class="sync-metric"
            :class="{ 'has-issues': metric.label === '问题' && (metric.value || 0) > 0 }"
          >
            <span>{{ metric.label }}</span
            ><strong>{{ metric.value ?? '—' }}</strong
            ><small>{{ metric.label === '问题' ? '项' : '条' }}</small>
          </div>
        </div>
        <p class="sync-explanation">
          问题包括客户待关联、地区/员工/字典未匹配和处理失败；同一订货宝记录可能有多项问题。
        </p>
        <el-table :data="steps" size="small">
          <el-table-column label="核对记录" prop="fetched" />
          <el-table-column label="无需更新"
            ><template #default="{ row }">{{ row.duplicates ?? '—' }}</template></el-table-column
          >
          <el-table-column label="待关联/配置问题" prop="unmapped" />
          <el-table-column label="处理失败"
            ><template #default="{ row }">{{ row.rejected ?? '—' }}</template></el-table-column
          >
        </el-table>
        <p class="sync-explanation">
          列表“未关联”按本系统客户计数；同步按订货宝客户编码核对，同一门店的多个编码分别统计。核对记录还包含历史待处理重试，修复记录不代表新增客户。
        </p>
        <p
          v-for="(step, index) in steps.filter((s) => s.message)"
          :key="index"
          class="sync-explanation"
        >
          {{ step.message }}
        </p>
      </template>
      <el-table v-else :data="steps" size="small">
        <el-table-column label="对象" prop="objectType" />
        <el-table-column label="读取" prop="fetched" />
        <el-table-column label="处理" prop="changed" />
        <el-table-column label="结果说明"
          ><template #default="{ row }">{{
            row.message || (row.unmapped ? `${row.unmapped} 条待处理` : '已完成')
          }}</template></el-table-column
        >
      </el-table>
    </div>
    <template #footer
      ><el-button @click="visible = false">关闭</el-button
      ><el-button
        v-if="!incrementalCustomer"
        type="primary"
        :loading="busy"
        :disabled="!connectorId || (!incrementalCustomer && !range)"
        @click="run"
        >开始{{ syncLabel }}</el-button
      ></template
    >
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { getDhbSyncTasks, type DhbSyncOrchestrationResult } from '@/api/core/dhb-orchestration'
import { syncDhbPage, type DhbPageScope } from '@/api/core/dhb-page-sync'
import { useDhbSyncJob } from '@/composables/useDhbSyncJob'
import DhbSyncJobProgress from './DhbSyncJobProgress.vue'
const props = defineProps<{ scope: DhbPageScope; label: string; buttonLabel?: string }>()
const incrementalCustomer = computed(() => props.scope === 'CUSTOMER')
const syncLabel = computed(() => (incrementalCustomer.value ? '同步' : `同步${props.label}`))
const emit = defineEmits<{ completed: [result: DhbSyncOrchestrationResult] }>()
const { can } = useSupplyPermissions()
const visible = ref(false),
  loading = ref(false),
  error = ref(''),
  connectorId = ref('')
const connectors = ref<string[]>([]),
  range = ref<[Date, Date] | null>(null)
const result = ref<DhbSyncOrchestrationResult | null>(null)
const { job, busy: jobBusy, notice, error: jobError, start } = useDhbSyncJob((value) => {
  result.value = value
  emit('completed', value)
})
const busy = computed(() => loading.value || jobBusy.value)
const steps = computed(() => result.value?.tenants.flatMap((t) => t.steps) ?? [])
const success = computed(() => result.value?.status === 'SUCCEEDED' && steps.value.length > 0)
const customerMetrics = computed(() => {
  const sum = (key: 'created' | 'updated' | 'repaired' | 'rejected') =>
    steps.value.length && steps.value.every((step) => step[key] != null)
      ? steps.value.reduce((total, step) => total + step[key]!, 0)
      : null
  const rejected = sum('rejected')
  return [
    { label: '新增客户', value: sum('created') },
    { label: '修改客户', value: sum('updated') },
    { label: '修复记录', value: sum('repaired') },
    {
      label: '问题',
      value:
        rejected == null
          ? null
          : rejected + steps.value.reduce((total, step) => total + (step.unmapped || 0), 0),
    },
  ]
})
const resultTitle = computed(() => {
  const completed =
    success.value ||
    (steps.value.length &&
      steps.value.every((step) => ['SUCCEEDED', 'SUCCEEDED_WITH_WARNINGS'].includes(step.status)))
  if (!completed) return '同步未全部完成，请查看结果说明'
  if (!incrementalCustomer.value) return '同步完成'
  if (customerMetrics.value.some((metric) => metric.value == null))
    return '同步完成，当前服务未提供完整数量明细'
  return `同步完成：${customerMetrics.value.map((metric) => `${metric.label} ${metric.value} ${metric.label === '问题' ? '项' : '条'}`).join('，')}`
})
async function open() {
  if (loading.value) return
  visible.value = true
  if (jobBusy.value) return
  connectorId.value = ''
  loading.value = true
  error.value = ''
  result.value = null
  // 首次范围显式展示；历史匹配需要时由操作者向前调整，不能悄悄触发全部对象。
  range.value = [new Date('2026-09-04T00:00:00+08:00'), new Date()]
  try {
    connectors.value = [...new Set((await getDhbSyncTasks()).map((t) => t.connectorId))]
    if (connectors.value.length === 1) connectorId.value = connectors.value[0]!
    else if (incrementalCustomer.value)
      error.value =
        connectors.value.length === 0
          ? '尚未配置订货宝同步，请管理员在集成设置中配置。'
          : '存在多个订货宝连接，请管理员在集成设置中明确客户同步来源。'
  } catch (e) {
    error.value = e instanceof Error ? e.message : '无法读取订货宝同步配置'
  } finally {
    loading.value = false
  }
  if (incrementalCustomer.value && connectorId.value && !error.value) await run()
}
async function run() {
  if ((!incrementalCustomer.value && !range.value) || !connectorId.value || busy.value) return
  loading.value = true
  error.value = ''
  result.value = null
  try {
    if (incrementalCustomer.value) {
      await start({ scope: props.scope, connectorId: connectorId.value, incremental: true, maxPages: 100 })
      return
    }
    result.value = await syncDhbPage({
      scope: props.scope,
      connectorId: connectorId.value,
      ...(incrementalCustomer.value
        ? { incremental: true }
        : { from: range.value![0].toISOString(), to: range.value![1].toISOString() }),
      maxPages: 100,
    })
    emit('completed', result.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '同步请求未取得完整结果，请核对后台批次后重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.sync-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin: 16px 0;
}
.sync-metric {
  padding: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-light);
}
.sync-metric span {
  display: block;
  margin-bottom: 8px;
  color: var(--el-text-color-regular);
}
.sync-metric strong {
  font-size: 24px;
  margin-right: 5px;
}
.sync-metric small,
.sync-explanation {
  color: var(--el-text-color-secondary);
}
.sync-explanation {
  font-size: 12px;
  line-height: 1.7;
}
.has-issues strong {
  color: var(--el-color-warning);
}
@media (max-width: 600px) {
  .sync-metrics {
    grid-template-columns: repeat(2, 1fr);
  }
}
.sync-status {
  margin: 12px 0;
}
</style>
