<template>
  <section class="overview-pulse">
    <h2>今日外勤</h2>
    <div class="pulse-body" v-if="summary">
      <span
        ><b>{{ summary.people }}</b> 位员工</span
      >
      <span
        ><b>{{ summary.stores }}</b> 家已访</span
      >
      <span
        ><b>{{ summary.completedPlans }}/{{ summary.planned }}</b> 完成计划</span
      >
      <span
        ><b>{{ summary.pendingPeople }}</b> 人有待核事项</span
      >
      <time :datetime="asOf">{{ date.slice(5).replace('-', '.') }}　{{ fieldClock(asOf) }}</time>
    </div>
    <div v-else class="pulse-body">
      <span role="status">{{ error ? '外勤日报暂不可用' : '正在读取外勤日报' }}</span>
      <button v-if="error" type="button" @click="load">重试</button>
    </div>
    <router-link
      v-if="canOpenReport && (!employeeCode || profile)"
      :to="{
        name: 'SupplySalesDashboard',
        query: {
          date,
          departmentId,
          descendants: departmentId && includeSubDepartments ? '1' : undefined,
          person: profile,
          view: 'report',
        },
      }"
      >查看人员日报</router-link
    >
  </section>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { businessDate } from '@/utils/business-date'
import { fieldClock } from '@/api/core/sales-fieldwork'
import { readFieldReport, type ReportSummary } from '@/api/core/sales-fieldwork-report'

const props = defineProps<{
  departmentId?: number
  includeSubDepartments: boolean
  employeeCode: string
  canOpenReport: boolean
}>()
const auth = useAuthStore()
const date = ref(businessDate(new Date()))
const asOf = ref('')
const profile = ref<string>()
const summary = ref<ReportSummary | null>(null)
const error = ref('')
let active: AbortController | undefined
async function load() {
  active?.abort()
  const current = new AbortController()
  active = current
  date.value = businessDate(new Date())
  summary.value = null
  asOf.value = ''
  profile.value = undefined
  error.value = ''
  try {
    const report = await readFieldReport(
      {
        date: date.value,
        departmentId: props.departmentId == null ? undefined : String(props.departmentId),
        includeDescendants: props.departmentId ? props.includeSubDepartments : undefined,
        employeeCode: props.employeeCode || undefined,
        size: 1,
      },
      current.signal,
    )
    if (current.signal.aborted) return
    summary.value = report.summary
    asOf.value = report.asOf
    if (props.employeeCode)
      profile.value = report.items.find(
        (row) => row.employeeCode === props.employeeCode,
      )?.salesProfileId
  } catch (e) {
    if (!current.signal.aborted) error.value = e instanceof Error ? e.message : '今日外勤读取失败'
  }
}

watch(
  () => [
    props.departmentId,
    props.includeSubDepartments,
    props.employeeCode,
    auth.user?.id,
    auth.user?.tenantId,
  ],
  load,
  { immediate: true },
)
onBeforeUnmount(() => active?.abort())
</script>

<style scoped>
.overview-pulse {
  padding: 7px 14px;
  border: 1px solid var(--sales-overview-line);
  border-radius: 6px;
  background: white;
}
.overview-pulse,
.pulse-body {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 13px;
  align-items: baseline;
}
.pulse-body {
  flex: 1 1 290px;
}
.overview-pulse h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 680;
}
.overview-pulse a,
.overview-pulse button {
  border: 0;
  padding: 0;
  background: none;
  color: #165a70;
  font: inherit;
  font-weight: 650;
  text-decoration: none;
  cursor: pointer;
}
.overview-pulse a:hover,
.overview-pulse button:hover {
  text-decoration: underline;
}
.pulse-body b {
  font-size: 16px;
}
.pulse-body time {
  color: var(--sales-overview-muted);
  font-size: 12px;
}
</style>
