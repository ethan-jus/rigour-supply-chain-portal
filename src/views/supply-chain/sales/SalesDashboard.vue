<template>
  <div class="dashboard">
    <div class="dashboard-toolbar">
      <div class="range-shortcuts">
        <el-button :type="rangeMode === 'today' ? 'primary' : 'default'" @click="selectToday">今日</el-button>
        <el-button :type="rangeMode === 'month' ? 'primary' : 'default'" @click="selectMonth">本月</el-button>
      </div>
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        :clearable="false"
        @change="load"
      />
      <el-button :loading="loading" @click="load">刷新</el-button>
    </div>

    <el-alert
      v-if="errorMessage"
      :title="errorMessage"
      type="error"
      :closable="false"
      show-icon
    />

    <el-skeleton v-if="loading && !dashboard" :rows="8" animated />

    <template v-else-if="dashboard">
      <div class="metric-grid">
        <article class="metric-card metric-card--primary">
          <span>拜访次数</span><strong>{{ dashboard.totals.totalVisitCount }}</strong>
          <p>完成离店 {{ dashboard.totals.completedVisitCount }}</p>
        </article>
        <article class="metric-card metric-card--success">
          <span>确认有效</span><strong>{{ dashboard.totals.effectiveVisitCount }}</strong>
          <p>有效率 {{ percentage(dashboard.totals.effectiveVisitCount, dashboard.totals.completedVisitCount) }}</p>
        </article>
        <article class="metric-card metric-card--warning">
          <span>待核验</span><strong>{{ dashboard.totals.pendingReviewVisitCount }}</strong>
          <p>已离店但未形成最终结论</p>
        </article>
        <article class="metric-card">
          <span>覆盖门店</span><strong>{{ dashboard.totals.uniqueStoreCount }}</strong>
          <p>负责 {{ dashboard.totals.assignedStoreCount }} · 首访 {{ dashboard.totals.firstVisitCount }} · 复访 {{ dashboard.totals.revisitCount }}</p>
        </article>
      </div>

      <div class="operations-grid">
        <el-card shadow="never">
          <template #header><strong>人员与考勤</strong></template>
          <div class="fact-grid">
            <div><span>在职销售</span><strong>{{ dashboard.totals.activeSalesCount }}</strong></div>
            <div><span>区间有出勤</span><strong>{{ dashboard.totals.attendedSalesCount }}</strong></div>
            <div><span>当前工作中</span><strong>{{ dashboard.totals.workingSalesCount }}</strong></div>
            <div><span>已完成工作日</span><strong>{{ dashboard.totals.finishedWorkDayCount }}</strong></div>
          </div>
        </el-card>
        <el-card shadow="never">
          <template #header><strong>工作证据</strong></template>
          <div class="evidence-callout" :class="{ 'evidence-callout--warning': dashboard.totals.totalInterruptionCount > 0 }">
            <span>定位采集中断</span>
            <strong>{{ dashboard.totals.totalInterruptionCount }} 次</strong>
            <p>中断用于风险排查，不直接判定旷工或无效拜访。</p>
          </div>
        </el-card>
      </div>

      <el-card shadow="never" class="people-card">
        <template #header>
          <div class="card-header">
            <div><strong>销售执行明细</strong><small>{{ dashboard.from }} 至 {{ dashboard.to }}</small></div>
            <el-tag type="info" effect="plain">共 {{ dashboard.people.length }} 人</el-tag>
          </div>
        </template>
        <el-table :data="dashboard.people" stripe empty-text="当前区间没有销售人员数据">
          <el-table-column label="销售" min-width="150" fixed>
            <template #default="scope">
              <div class="sales-cell"><strong>{{ scope.row.salesNo }}</strong><span>{{ scope.row.working ? '工作中' : '非工作中' }}</span></div>
            </template>
          </el-table-column>
          <el-table-column prop="workDayCount" label="出勤天数" width="100" sortable />
          <el-table-column prop="totalVisitCount" label="拜访" width="90" sortable />
          <el-table-column prop="completedVisitCount" label="完成" width="90" sortable />
          <el-table-column prop="effectiveVisitCount" label="有效" width="90" sortable />
          <el-table-column prop="pendingReviewVisitCount" label="待核验" width="100" sortable />
          <el-table-column label="首访 / 复访" width="120">
            <template #default="scope">{{ scope.row.firstVisitCount }} / {{ scope.row.revisitCount }}</template>
          </el-table-column>
          <el-table-column label="覆盖 / 负责" width="120">
            <template #default="scope">{{ scope.row.uniqueStoreCount }} / {{ scope.row.assignedStoreCount }}</template>
          </el-table-column>
          <el-table-column label="有效率" min-width="160">
            <template #default="scope">
              <div class="rate-cell">
                <el-progress :percentage="rate(scope.row.effectiveVisitCount, scope.row.completedVisitCount)" :stroke-width="8" />
              </div>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-alert
        title="指标口径"
        description="完成离店表示硬证据门禁已通过；确认有效只统计已经形成最终复核结论的拜访。首访/复访按该销售历史上是否更早拜访过同一门店区分。"
        type="info"
        :closable="false"
        show-icon
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { apiClient } from '@/api'

interface ManagementDashboardTotals {
  activeSalesCount: number
  attendedSalesCount: number
  workingSalesCount: number
  finishedWorkDayCount: number
  totalInterruptionCount: number
  totalVisitCount: number
  completedVisitCount: number
  effectiveVisitCount: number
  pendingReviewVisitCount: number
  firstVisitCount: number
  revisitCount: number
  uniqueStoreCount: number
  assignedStoreCount: number
}

interface SalesPersonActivity {
  salesProfileId: string
  employeeId: string
  salesNo: string
  working: boolean
  workDayCount: number
  totalVisitCount: number
  completedVisitCount: number
  effectiveVisitCount: number
  pendingReviewVisitCount: number
  firstVisitCount: number
  revisitCount: number
  uniqueStoreCount: number
  assignedStoreCount: number
}

interface ManagementDashboard {
  from: string
  to: string
  generatedAt: string
  totals: ManagementDashboardTotals
  people: SalesPersonActivity[]
}

const today = localDate(new Date())
const monthStart = `${today.slice(0, 7)}-01`
const dateRange = ref<[string, string]>([monthStart, today])
const dashboard = ref<ManagementDashboard | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const rangeMode = computed(() => {
  if (dateRange.value[0] === today && dateRange.value[1] === today) return 'today'
  if (dateRange.value[0] === monthStart && dateRange.value[1] === today) return 'month'
  return 'custom'
})

function localDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function selectToday() {
  dateRange.value = [today, today]
  void load()
}

function selectMonth() {
  dateRange.value = [monthStart, today]
  void load()
}

async function load() {
  if (!dateRange.value?.[0] || !dateRange.value?.[1]) return
  loading.value = true
  errorMessage.value = ''
  try {
    dashboard.value = await apiClient.get('/sales/management/dashboard', {
      params: { from: dateRange.value[0], to: dateRange.value[1] },
    }) as ManagementDashboard
  } catch (error) {
    errorMessage.value = errorMessageOf(error)
  } finally {
    loading.value = false
  }
}

function errorMessageOf(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return '销售管控数据加载失败'
}

function rate(numerator: number, denominator: number): number {
  if (!denominator) return 0
  return Math.min(100, Math.round(numerator / denominator * 100))
}

function percentage(numerator: number, denominator: number): string {
  return `${rate(numerator, denominator)}%`
}

onMounted(() => { void load() })
</script>

<style scoped lang="scss">
@use '@/assets/styles/variables' as *;

.dashboard { display: grid; gap: $spacing-lg; }
.dashboard-toolbar { display: flex; flex-wrap: wrap; gap: $spacing-sm; align-items: center; padding: $spacing-md; background: $color-bg-white; border: 1px solid $color-border-base; border-radius: $border-radius-lg; }
.range-shortcuts { display: flex; gap: $spacing-sm; }
.metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: $spacing-md; }
.metric-card { padding: 20px; background: $color-bg-white; border: 1px solid $color-border-base; border-radius: $border-radius-lg; box-shadow: $shadow-sm; }
.metric-card > span { color: $color-text-secondary; font-size: $font-size-sm; }
.metric-card > strong { display: block; margin-top: 10px; color: $color-text-primary; font-size: 32px; line-height: 1; }
.metric-card > p { margin: 10px 0 0; color: $color-text-secondary; font-size: $font-size-xs; }
.metric-card--primary > strong { color: $color-primary; }
.metric-card--success > strong { color: $color-success; }
.metric-card--warning > strong { color: $color-warning; }
.operations-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: $spacing-md; }
.fact-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: $spacing-md; text-align: center; }
.fact-grid div { padding: 12px; background: $color-bg-muted; border-radius: $border-radius-base; }
.fact-grid span { display: block; color: $color-text-secondary; font-size: $font-size-xs; }
.fact-grid strong { display: block; margin-top: 7px; color: $color-text-primary; font-size: $font-size-xl; }
.evidence-callout { padding: 10px 4px; }
.evidence-callout span { color: $color-text-secondary; font-size: $font-size-sm; }
.evidence-callout strong { display: block; margin-top: 8px; color: $color-success; font-size: 28px; }
.evidence-callout--warning strong { color: $color-warning; }
.evidence-callout p { margin: 8px 0 0; color: $color-text-secondary; font-size: $font-size-xs; }
.card-header { display: flex; align-items: center; justify-content: space-between; }
.card-header > div { display: flex; flex-direction: column; gap: 4px; }
.card-header small { color: $color-text-secondary; }
.sales-cell { display: flex; flex-direction: column; gap: 4px; }
.sales-cell span { color: $color-text-secondary; font-size: $font-size-xs; }
.rate-cell { min-width: 130px; }
@media (max-width: 1200px) { .metric-grid { grid-template-columns: repeat(2, 1fr); } .operations-grid { grid-template-columns: 1fr; } }
@media (max-width: 760px) { .metric-grid { grid-template-columns: 1fr; } .fact-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
