<template>
  <section class="workbench" aria-label="业务首页">
    <header class="workbench__heading">
      <div>
        <h1>工作台</h1>
        <p>
          {{ todayText }}<span v-if="overview">{{ scopeLabel }}</span>
        </p>
      </div>
      <router-link v-if="orderEntry" class="primary-action" :to="orderEntry.path"
        ><Document />查看订单<ArrowRight
      /></router-link>
    </header>
    <div v-if="!ready" class="home-state" :role="navigationError ? 'alert' : 'status'">
      {{ navigationLoading ? '正在加载业务入口' : navigationError || '业务入口尚未加载' }}
      <button v-if="!navigationLoading" class="text-action" type="button" @click="retryNavigation">
        重新加载
      </button>
    </div>
    <template v-else>
      <section class="home-summary" aria-label="本月经营" :aria-busy="summaryLoading">
        <header class="section-heading">
          <h2>本月经营</h2>
          <span>{{ monthText }}</span>
          <div class="section-actions">
            <button
              class="text-action"
              type="button"
              :disabled="summaryLoading"
              aria-label="刷新首页数据"
              @click="refresh"
            >
              <Refresh /></button
            ><router-link v-if="biEntry" :to="biEntry.path">经营总览<TopRight /></router-link
            ><button
              v-if="canReadSummary"
              type="button"
              class="icon-action"
              aria-label="打开经营总览大屏"
              @click="meetingOpen = true"
            >
              <FullScreen />
            </button>
          </div>
        </header>
        <p v-if="!canReadSummary" class="home-notice">当前账号暂无经营数据访问权限</p>
        <p v-else-if="summaryError" class="home-notice" role="alert">{{ summaryError }}</p>
        <p v-else-if="summaryLoading" class="home-notice" role="status">正在读取经营数据…</p>
        <div class="summary-metrics">
          <div class="summary-metric summary-metric--sales">
            <span>本月交易额</span
            ><strong :title="currency(sales)">{{ summaryCurrency(sales) }}</strong>
            <div
              class="metric-target"
              title="目标完成率按已配置目标的城市汇总；未配置目标的城市不计入此进度"
            >
              <span
                >{{ salesTarget?.target ? '目标完成' : missingTargetLabel }}
                <b>{{ percentage(salesTarget?.rate ?? null) }}</b></span
              ><small v-if="salesTarget?.target"
                >{{ number(salesTarget.actual) }} / {{ number(salesTarget.target) }}</small
              >
            </div>
            <el-progress
              :percentage="progress(salesTarget?.rate)"
              :show-text="false"
              :stroke-width="8"
              color="#287bff"
            /><small v-if="salesTarget?.incomplete" class="target-note"
              >按已配置{{ salesTarget.level }}目标汇总{{
                salesTarget.incomplete ? ' · 覆盖不完整' : ''
              }}</small
            >
          </div>
          <div class="summary-metric summary-metric--receipts">
            <span>本月到账</span><strong :title="currency(receipts)">{{ summaryCurrency(receipts) }}</strong
            ><small class="metric-description">按实际到账日期</small>
            <div
              class="metric-target"
              title="目标完成率按已配置目标的城市汇总；未配置目标的城市不计入此进度"
            >
              <span
                >{{ receiptTarget?.target ? '目标完成' : missingTargetLabel }}
                <b>{{ percentage(receiptTarget?.rate ?? null) }}</b></span
              ><small v-if="receiptTarget?.target"
                >{{ number(receiptTarget.actual) }} / {{ number(receiptTarget.target) }}</small
              >
            </div>
            <el-progress
              :percentage="progress(receiptTarget?.rate)"
              :show-text="false"
              :stroke-width="8"
              color="#14b5c6"
            /><small v-if="receiptTarget?.incomplete" class="target-note"
              >按已配置{{ receiptTarget.level }}目标汇总{{
                receiptTarget.incomplete ? ' · 覆盖不完整' : ''
              }}</small
            >
          </div>
          <div class="summary-metric">
            <span>成交客户</span
            ><strong>{{ number(customers) }}<small v-if="customers != null">家</small></strong>
          </div>
          <div class="summary-metric summary-metric--retention">
            <span>复购率</span><strong>{{ percentage(retentionRate) }}</strong
            ><small
              class="retention-definition"
              title="本月下单且本月之前已有订单的客户，除以本月成交客户"
              >本月复购客户 / 本月成交客户</small
            ><b>{{ number(returning) }} / {{ number(retentionCustomers) }}</b
            ><small v-if="retentionError" class="target-note">{{ retentionError }}</small>
          </div>
        </div>
        <p v-if="dataTime" class="data-time">数据更新 {{ dataTime }}</p>
      </section>
      <nav v-if="shortcuts.length" class="home-shortcuts" aria-label="常用业务">
        <router-link v-for="entry in shortcuts" :key="entry.path" :to="entry.path"
          ><ConsoleNavIcon :icon-key="entry.iconKey" /><span>{{ entry.name }}</span></router-link
        >
      </nav>
      <div class="home-columns">
        <section class="home-tasks" aria-label="待处理业务">
          <header class="section-heading"><h2>待处理业务</h2></header>
          <div v-if="availableTasks.length" class="task-tabs" role="tablist" aria-label="待办类型">
            <button
              v-for="key in availableTasks"
              :id="`home-task-${key}`"
              :key="key"
              class="task-tab"
              :class="{ 'is-active': task === key }"
              role="tab"
              type="button"
              :aria-selected="task === key"
              aria-controls="home-task-panel"
              @click="task = key"
            >
              {{ homeTaskLabels[key] }}<span>{{ number(tasks[key].count) }}</span>
            </button>
          </div>
          <div
            id="home-task-panel"
            role="tabpanel"
            :aria-labelledby="`home-task-${task}`"
            :aria-busy="currentTask.loading"
          >
            <div v-if="!availableTasks.length" class="home-state">暂无已授权的业务待办</div>
            <div v-else-if="currentTask.loading" class="home-state" role="status">
              正在加载待办…
            </div>
            <div v-else-if="currentTask.error" class="home-state" role="alert">
              {{ currentTask.error
              }}<button type="button" class="text-action" @click="refresh">重试</button>
            </div>
            <div v-else-if="!currentTask.rows.length" class="home-state">
              暂无{{ homeTaskLabels[task] }}事项
            </div>
            <div v-else class="task-table-scroll">
              <table class="task-table">
                <thead>
                  <tr>
                    <th>客户</th>
                    <th class="amount">
                      {{
                        task === 'payment'
                          ? '到账金额'
                          : task === 'unpaid'
                            ? '待回款金额'
                            : '订单金额'
                      }}
                    </th>
                    <th>{{ task === 'payment' ? '到账日期' : '订单日期' }}</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in currentTask.rows" :key="row.id">
                    <td :title="row.customer">{{ row.customer }}</td>
                    <td class="amount">{{ currency(row.amount) }}</td>
                    <td>{{ rowDate(row.date) }}</td>
                    <td>
                      <span class="task-status">{{ homeTaskLabels[task] }}</span>
                    </td>
                    <td>
                      <router-link class="task-row-action" :to="taskLink(row.orderNo)"
                        >{{ task === 'payment' ? '核对' : task === 'unpaid' ? '跟进' : '查看'
                        }}<ArrowRight
                      /></router-link>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <footer v-if="availableTasks.length" class="task-footer">
            <router-link :to="taskLink()">查看全部<ArrowRight /></router-link>
          </footer>
        </section>
        <aside class="home-support">
          <section v-if="analysisEntries.length" class="home-analysis" aria-label="经营分析">
            <h2>经营分析</h2>
            <router-link v-for="entry in analysisEntries" :key="entry.path" :to="entry.path"
              ><ConsoleNavIcon :icon-key="entry.iconKey" /><span
                ><strong>{{ entry.name }}</strong
                ><small>{{ analysisDescription(entry.path) }}</small></span
              ><ArrowRight
            /></router-link>
          </section>
          <section class="home-recent" aria-label="最近访问">
            <h2>最近访问</h2>
            <router-link v-for="entry in recent" :key="entry.path" :to="entry.path"
              ><ConsoleNavIcon :icon-key="entry.iconKey" /><span>{{ entry.name }}</span
              ><small>{{ recentTime(entry.path) }}</small
              ><ArrowRight
            /></router-link>
            <p v-if="!recent.length">访问过的业务页面会显示在这里</p>
          </section>
        </aside>
      </div>
      <div v-if="!entries.some((entry) => entry.path !== '/supply-chain')" class="home-state">
        暂无已授权的业务入口<button type="button" class="text-action" @click="retryNavigation">
          重新加载
        </button>
      </div>
    </template>
    <BiMeetingPresentation
      v-if="meetingOpen && canReadSummary"
      :query="query"
      :scope-label="scopeLabel"
      @close="meetingOpen = false"
      @report="openReport"
    />
  </section>
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { SupplyDashboardQuery } from '@/api/core/bi'
import { ArrowRight, Document, FullScreen, Refresh, TopRight } from '@element-plus/icons-vue'
import { useNavigationStore } from '@/stores/navigation'
import { useConsoleWorkspace } from '@/stores/console-workspace'
import {
  consoleEntries,
  homeAnalysisPaths,
  homeShortcutPaths,
  selectEntries,
} from '@/utils/console-navigation'
import { businessDate, displayDateTime } from '@/utils/business-date'
import {
  finite,
  meetingMetric,
  meetingTarget,
  percentage,
} from '@/views/supply-chain/bi/meeting-model'
import { homeTaskLabels, useConsoleHomeData, type HomeTask } from '@/composables/useConsoleHomeData'
import ConsoleNavIcon from './ConsoleNavIcon.vue'
const BiMeetingPresentation = defineAsyncComponent(
  () => import('@/views/supply-chain/bi/components/BiMeetingPresentation.vue'),
)
const navigation = useNavigationStore()
const workspace = useConsoleWorkspace()
const route = useRoute()
const router = useRouter()
const code = computed(() => String(route.meta.applicationCode || 'SUPPLY_CHAIN'))
const navigationLoading = ref(false)
const navigationError = ref('')
let navRequest = 0
const ready = computed(
  () => !navigationLoading.value && !navigationError.value && navigation.isLoaded(code.value),
)
const entries = computed(() =>
  ready.value ? consoleEntries(navigation.getNavigation(code.value)) : [],
)
const stop = navigation.$onAction(({ name, args, after, onError }) => {
  if (name !== 'fetchNavigation' || args[0] !== code.value) return
  const request = ++navRequest
  navigationLoading.value = true
  navigationError.value = ''
  after(() => {
    if (request === navRequest) navigationLoading.value = false
  })
  onError(() => {
    if (request === navRequest) {
      navigationLoading.value = false
      navigationError.value = '业务入口加载失败，请重试'
    }
  })
})
onBeforeUnmount(stop)
async function retryNavigation() {
  if (!navigationLoading.value) await navigation.fetchNavigation(code.value).catch(() => {})
}
const {
  overview,
  analysis,
  query,
  today,
  summaryLoading,
  summaryError,
  retentionError,
  scopeLabel,
  tasks,
  canReadSummary,
  availableTasks,
  refresh,
} = useConsoleHomeData(entries)
const todayText = computed(() =>
  new Date(`${today.value}T12:00:00+08:00`).toLocaleDateString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }),
)
const monthText = computed(() => `${today.value.slice(0, 4)}年${Number(today.value.slice(5, 7))}月`)
const orderEntry = computed(() =>
  entries.value.find((entry) => entry.path === homeShortcutPaths[0]),
)
const biEntry = computed(() => entries.value.find((entry) => entry.path === homeAnalysisPaths[0]))
const shortcuts = computed(() => selectEntries(entries.value, homeShortcutPaths))
const analysisEntries = computed(() => selectEntries(entries.value, homeAnalysisPaths))
const recent = computed(() =>
  selectEntries(
    entries.value,
    workspace.recent.map((item) => item.path),
  ).slice(0, 2),
)
const sales = computed(() => meetingMetric(overview.value, 'sales_amount'))
const receipts = computed(() => meetingMetric(overview.value, 'receipt_amount'))
const customers = computed(() => meetingMetric(overview.value, 'cooperated_customer_count'))
const missingTargetLabel = computed(() =>
  overview.value ? '尚未设置目标' : summaryLoading.value ? '正在读取目标' : '目标暂不可用',
)
const salesTarget = computed(() =>
  overview.value ? meetingTarget(overview.value, 'SALES_AMOUNT') : null,
)
const receiptTarget = computed(() =>
  overview.value ? meetingTarget(overview.value, 'RECEIPT_AMOUNT') : null,
)
const returning = computed(() =>
  customers.value != null
    ? finite(analysis.value?.customerRetention?.returningCustomerCount)
    : null,
)
const retentionCustomers = computed(() =>
  customers.value != null ? finite(analysis.value?.customerRetention?.orderingCustomerCount) : null,
)
const retentionRate = computed(() =>
  returning.value != null && retentionCustomers.value != null && retentionCustomers.value > 0
    ? (returning.value / retentionCustomers.value) * 100
    : null,
)
const dataTime = computed(() => {
  const times = overview.value?.freshness
    ?.filter((source) => ['ORDER_SALES_ORDER', 'ORDER_PAYMENT_RECORD'].includes(source.sourceCode))
    .map((source) => source.latestUpdatedTime)
    .filter(Boolean)
  return times?.length ? displayDateTime([...times].sort()[0]) : ''
})
const task = ref<HomeTask>('payment')
const currentTask = computed(() => tasks[task.value])
watch(
  availableTasks,
  (keys) => {
    if (!keys.includes(task.value)) task.value = keys[0] || 'payment'
  },
  { immediate: true },
)
const meetingOpen = ref(false)
watch(canReadSummary, (allowed) => {
  if (!allowed) meetingOpen.value = false
})
const number = (value: number | null | undefined) =>
  value == null ? '—' : value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
const currency = (value: number | null) => (value == null ? '—' : `¥${number(value)}`)
const summaryCurrency = (value: number | null) =>
  value != null && Math.abs(value) >= 1_000_000 ? `¥${number(value / 10000)}万` : currency(value)
const progress = (value: number | null | undefined) => Math.min(100, Math.max(0, value || 0))
function rowDate(value: string | null) {
  if (!value) return '—'
  try {
    return businessDate(value)
  } catch {
    return value.slice(0, 10)
  }
}
function taskLink(orderNo?: string) {
  return {
    path: task.value === 'payment' ? homeShortcutPaths[1] : homeShortcutPaths[0],
    query: { homeTask: task.value, ...(orderNo ? { orderNo } : {}) },
  }
}
function recentTime(path: string) {
  return displayDateTime(workspace.recent.find((item) => item.path === path)?.visitedAt).slice(
    5,
    16,
  )
}
function analysisDescription(path: string) {
  return path.endsWith('city-operating')
    ? '各城市交易与到账排名'
    : path.endsWith('/sales')
      ? '销售排名与产品表现'
      : '经营全貌与目标进度'
}
function openReport(page: number, reportQuery: SupplyDashboardQuery) {
  meetingOpen.value = false
  const section = (
    { 2: 'city-operating', 3: 'product-sales', 4: 'sales-collection' } as Record<number, string>
  )[page]
  const target =
    entries.value.find((entry) => entry.path === `/supply-chain/bi/${section}`) || biEntry.value
  if (target)
    void router.push({
      path: target.path,
      query: {
        ...reportQuery,
        from: reportQuery.from ? businessDate(reportQuery.from) : undefined,
        to: reportQuery.to ? businessDate(reportQuery.to) : undefined,
      },
    })
}
</script>
<style scoped src="./console-dashboard.css"></style>
