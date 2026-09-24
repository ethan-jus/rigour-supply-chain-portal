<template>
  <el-button
    v-if="can('hr:employee:sync') && can('integration:dhb:write') && can('integration:dhb:read')"
    :loading="loading"
    @click="open"
    >{{ busy ? '查看同步进度' : '同步业务员' }}</el-button
  >
  <el-dialog v-model="visible" title="同步业务员" width="760px" :close-on-click-modal="false">
    <el-alert
      title="只同步订货宝业务员。已有员工仅补关联编号，保留全部档案；新员工补录姓名、手机号、销售部下对应部门和业务员岗位。来源无在职状态时标记待确认，不推断入职日期。"
      type="info"
      :closable="false"
    />
    <DhbSyncJobProgress :job="job" :notice="notice" />
    <el-alert
      v-if="error || configError"
      :title="error || configError"
      type="error"
      :closable="false"
    />
    <template v-if="result">
      <el-alert
        :title="
          result.status === 'SUCCEEDED'
            ? '业务员同步完成'
            : '同步结束，仍有待核对项，请查看结果说明'
        "
        :type="result.status === 'SUCCEEDED' ? 'success' : 'warning'"
        :closable="false"
      />
      <el-table :data="steps">
        <el-table-column label="核对业务员" prop="fetched" />
        <el-table-column label="新增员工" prop="created" />
        <el-table-column label="新增关联" prop="updated" />
        <el-table-column label="已有关联" prop="duplicates" />
        <el-table-column label="待核对" prop="rejected" />
      </el-table>
      <p v-for="(step, index) in steps" :key="index">{{ step.message }}</p>
      <p>部门无法唯一匹配、姓名或手机号冲突时不自动建档。此操作不会启动客户或订单同步。</p>
    </template>
    <template #footer><el-button @click="visible = false">关闭</el-button></template>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { useDhbSyncJob } from '@/composables/useDhbSyncJob'
import { getDhbSyncTasks, type DhbSyncOrchestrationResult } from '@/api/core/dhb-orchestration'
import DhbSyncJobProgress from './DhbSyncJobProgress.vue'

const emit = defineEmits<{ completed: [result: DhbSyncOrchestrationResult] }>()
const { can } = useSupplyPermissions()
const visible = ref(false)
const loading = ref(false)
const configError = ref('')
const result = ref<DhbSyncOrchestrationResult | null>(null)
const steps = computed(() => result.value?.tenants.flatMap((tenant) => tenant.steps) ?? [])
const { job, busy, notice, error, start } = useDhbSyncJob((value) => {
  result.value = value
  emit('completed', value)
})
async function open() {
  visible.value = true
  if (loading.value || busy.value) return
  loading.value = true
  configError.value = ''
  result.value = null
  try {
    const connectors = [...new Set((await getDhbSyncTasks()).map((task) => task.connectorId))]
    if (connectors.length !== 1) {
      configError.value = '请管理员配置唯一的订货宝同步来源后再同步业务员。'
      return
    }
    await start({
      scope: 'SALESPERSON',
      connectorId: connectors[0]!,
      incremental: true,
      maxPages: 100,
    })
  } catch (cause) {
    configError.value = cause instanceof Error ? cause.message : '无法读取订货宝同步配置'
  } finally {
    loading.value = false
  }
}
</script>
