<template>
  <section v-if="job || notice" class="dhb-job-progress" aria-live="polite">
    <el-alert v-if="notice" :title="notice" type="warning" :closable="false" />
    <template v-if="job">
      <el-alert :title="job.stage" :type="alertType" :closable="false" />
      <p>状态：{{ statusLabel }} · 已用时 {{ elapsed }} · 任务 {{ job.jobId }}</p>
      <p v-if="active">可以关闭弹窗继续操作。再次点击同步按钮会查看原任务，不会重复启动。</p>
      <p v-if="job.status === 'UNKNOWN'">任务状态待核实，不代表执行失败；请勿重复提交。</p>
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { DhbPageSyncJob } from '@/api/core/dhb-page-sync'
const props = defineProps<{ job: DhbPageSyncJob | null; notice: string }>()
const now = ref(Date.now())
const timer = setInterval(() => { now.value = Date.now() }, 1000)
onBeforeUnmount(() => clearInterval(timer))
const active = computed(() => props.job && !['SUCCEEDED', 'FAILED'].includes(props.job.status))
const statusLabel = computed(() => ({ QUEUED: '排队中', RUNNING: '后台执行中', SUCCEEDED: '已结束', FAILED: '执行失败', UNKNOWN: '等待核实' })[props.job?.status || 'QUEUED'])
const alertType = computed(() => props.job?.status === 'FAILED' ? 'error' : props.job?.status === 'UNKNOWN' ? 'warning' : 'info')
const elapsed = computed(() => {
  if (!props.job) return '—'
  const seconds = Math.max(0, Math.floor(((props.job.finishedAt ? Date.parse(props.job.finishedAt) : now.value) - Date.parse(props.job.startedAt)) / 1000))
  return `${Math.floor(seconds / 60)}分${seconds % 60}秒`
})
</script>
<style scoped>
.dhb-job-progress { margin: 12px 0; overflow-wrap: anywhere; }
.dhb-job-progress p { margin: 8px 0; color: var(--el-text-color-secondary); font-size: 12px; }
</style>
