<template>
  <section class="field-page field-report">
    <div v-if="ledgerReturn" class="field-heading-tools">
      <a :href="ledgerReturn.href" class="field-link" @click="returnToLedger">
        {{
          ledgerReturn.query.detail || ledgerReturn.query.visitId ? '返回拜访详情' : '返回拜访记录'
        }}
      </a>
    </div>
    <header class="field-heading">
      <div class="field-title">
        <SupplyPageTitle>{{ route.meta.title }}</SupplyPageTitle>
      </div>
      <div class="field-heading-tools">
        <span v-if="report">数据截至 {{ asOf }}</span>
        <button type="button" class="field-link" @click="methodOpen = true">指标口径</button>
      </div>
    </header>

    <OrderRegisterFilterCard
      class="order-register-filter--compact"
      :loading="busy"
      @search="search"
      @reset="reset"
    >
      <template #primary>
        <div class="list-filter-field list-filter-field--select">
          <el-date-picker
            v-model="filter.date"
            type="date"
            format="YYYY/MM/DD"
            value-format="YYYY-MM-DD"
            :clearable="false"
            :disabled-date="isFuture"
            placeholder="工作日"
            aria-label="工作日"
          />
        </div>
        <div class="list-filter-field list-filter-field--select">
          <el-select
            v-model="filter.city"
            clearable
            filterable
            placeholder="全部城市"
            aria-label="城市"
            @change="changeCity"
          >
            <el-option
              v-for="c in options.cities"
              :key="c.name"
              :value="c.name"
              :label="cityName(c.name)"
            />
          </el-select>
        </div>
        <div class="list-filter-group">
          <div class="list-filter-field list-filter-field--select">
            <el-select
              v-model="filter.departmentId"
              clearable
              filterable
              placeholder="全部部门"
              aria-label="部门"
              @change="changeDept"
            >
              <el-option
                v-for="d in options.departments"
                :key="d.id"
                :value="d.id"
                :label="d.name"
              />
            </el-select>
          </div>
          <el-checkbox
            v-if="filter.departmentId"
            v-model="filter.includeDescendants"
            @change="changeDept"
            >含子部门</el-checkbox
          >
        </div>
        <div class="list-filter-field list-filter-field--person">
          <el-select
            v-model="filter.person"
            clearable
            filterable
            placeholder="全部业务员"
            aria-label="业务员"
          >
            <el-option v-for="p in options.people" :key="p.id" :value="p.id" :label="p.name" />
          </el-select>
        </div>
        <div class="field-shortcuts" role="group" aria-label="常用工作日">
          <button
            type="button"
            class="field-shortcut"
            :aria-pressed="filter.date === today"
            @click="pickDate(today)"
          >
            今天
          </button>
          <button
            type="button"
            class="field-shortcut"
            :aria-pressed="filter.date === yesterday"
            @click="pickDate(yesterday)"
          >
            昨天
          </button>
        </div>
      </template>
    </OrderRegisterFilterCard>

    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <template v-if="report">
      <details class="field-panel team-summary" :open="summaryOpen" @toggle="rememberSummary">
        <summary>团队工作日汇总</summary>
        <dl class="metrics" aria-label="当前筛选范围的指标">
          <div
            v-for="[label, value, unit, description] in reportCards(report.summary)"
            :key="label"
          >
            <dt>{{ label }}</dt>
            <dd>
              <strong>{{ value }}</strong
              ><span v-if="unit">{{ unit }}</span>
            </dd>
            <small>{{ description }}</small>
          </div>
        </dl>
      </details>
      <div
        v-if="
          !filter.city &&
          !filter.departmentId &&
          !filter.person &&
          !filter.status &&
          !filter.pendingOnly &&
          report.cities.length
        "
        class="cities"
      >
        <strong>城市对照</strong>
        <button
          v-for="c in report.cities"
          :key="c.name"
          class="field-button"
          type="button"
          @click="pickCity(c.name)"
        >
          <b>{{ cityName(c.name) }}</b> {{ c.people }} 人 · {{ c.stores }} 家 ·
          {{ c.pendingPeople }} 人待核
        </button>
      </div>
    </template>

    <div class="field-panel field-tabbar" role="group" aria-label="团队外勤视图">
      <button
        class="field-tab"
        type="button"
        :aria-pressed="tab === 'map'"
        @click="selectTab('map')"
      >
        人员与轨迹
      </button>
      <button
        class="field-tab"
        type="button"
        :aria-pressed="tab === 'report'"
        @click="selectTab('report')"
      >
        人员日报
      </button>
      <button
        v-if="canMap"
        class="field-tab"
        type="button"
        :aria-pressed="tab === 'compare'"
        @click="selectTab('compare')"
      >
        轨迹对比
      </button>
    </div>
    <div v-if="tab !== 'compare'" :class="{ 'field-map-workbench': tab === 'map' }">
      <aside
        v-if="tab === 'map'"
        class="field-panel map-roster"
        v-loading="busy"
        aria-labelledby="map-roster-title"
      >
        <header class="field-panel-header">
          <h2 id="map-roster-title">业务员</h2>
          <span v-if="report" class="field-count">{{ report.total }} 人</span>
        </header>
        <div class="map-roster-list" tabindex="0" role="region" aria-label="业务员列表">
          <button
            v-for="row in mapRows"
            :key="row.salesProfileId"
            type="button"
            class="map-roster-person"
            :aria-pressed="row.salesProfileId === selected?.salesProfileId"
            @click="choose(row)"
          >
            <span class="employee-initial" aria-hidden="true">{{
              row.employeeName.slice(0, 1)
            }}</span>
            <span class="map-roster-name"
              ><strong>{{ row.employeeName }}</strong
              ><small>{{ row.departmentName || '部门待核' }}</small></span
            >
            <span class="field-status" :data-status="row.status">{{
              workNames[row.status] || row.status
            }}</span>
          </button>
        </div>
        <p v-if="report && !report.items.length" class="field-empty">当前筛选没有匹配的员工</p>
        <div v-if="report && report.total > size" class="map-roster-pages">
          <el-button size="small" :disabled="page === 1" @click="turn(page - 1)">上一页</el-button>
          <span>{{ page }} / {{ Math.ceil(report.total / size) }}</span>
          <el-button size="small" :disabled="page * size >= report.total" @click="turn(page + 1)"
            >下一页</el-button
          >
        </div>
      </aside>
      <section
        v-if="tab === 'report'"
        class="field-panel roster"
        aria-labelledby="field-roster-title"
        v-loading="busy"
      >
        <header class="field-panel-header">
          <div class="roster-heading">
            <h2 id="field-roster-title">{{ rosterTitle }}</h2>
            <span v-if="report" class="field-count">{{ report.total }} 人</span>
          </div>
          <div class="field-panel-tools">
            <button
              class="field-button"
              type="button"
              :aria-pressed="filter.pendingOnly"
              @click="togglePending"
            >
              只看待核<span v-if="report"> · {{ report.summary.pendingPeople }} 人</span>
            </button>
            <div class="field-filter">
              <span class="field-filter-label">排序</span>
              <el-select
                v-model="filter.sort"
                size="small"
                aria-label="排序"
                class="roster-sort"
                @change="search"
              >
                <el-option label="待核优先" value="risk" />
                <el-option label="拜访最多" value="visits" />
                <el-option label="里程最多" value="distance" />
              </el-select>
            </div>
          </div>
        </header>
        <div
          class="field-table-wrap roster-scroll"
          tabindex="0"
          role="region"
          aria-label="人员日报，可横向浏览"
        >
          <table class="field-table roster-table">
            <thead>
              <tr>
                <th scope="col">员工 / 部门</th>
                <th scope="col">
                  <el-dropdown trigger="click" @command="setWorkStatus">
                    <button
                      type="button"
                      :class="['field-column-filter', { 'is-active': filter.status }]"
                      aria-label="筛选工作状态"
                      :title="workNames[filter.status] || '筛选工作状态'"
                    >
                      工作状态 <el-icon><Filter /></el-icon>
                    </button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="" :disabled="!filter.status"
                          >全部工作状态</el-dropdown-item
                        >
                        <el-dropdown-item
                          v-for="(label, value) in workNames"
                          :key="value"
                          :command="value"
                          :disabled="filter.status === value"
                          >{{ label }}</el-dropdown-item
                        >
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </th>
                <th scope="col">打卡</th>
                <th scope="col">门店 / 次</th>
                <th scope="col">计划完成</th>
                <th scope="col">工作时长</th>
                <th scope="col">录音 / 已核时长</th>
                <th scope="col">里程 km</th>
                <th scope="col">企微新增</th>
                <th scope="col">作业核查</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in report?.items"
                :key="r.salesProfileId"
                :class="{ selected: r.salesProfileId === selected?.salesProfileId }"
                @click="choose(r)"
              >
                <th scope="row">
                  <button
                    class="employee"
                    type="button"
                    :aria-pressed="r.salesProfileId === selected?.salesProfileId"
                    :aria-label="'查看' + r.employeeName + '工作日'"
                    @click.stop="choose(r)"
                  >
                    <span class="employee-initial" aria-hidden="true">{{
                      r.employeeName.slice(0, 1)
                    }}</span>
                    <strong :title="r.employeeName">{{ r.employeeName }}</strong>
                    <small :title="r.departmentName || '部门待核'">{{
                      r.departmentName || '部门待核'
                    }}</small>
                  </button>
                </th>
                <td>
                  <span class="field-status" :data-status="r.status">{{
                    workNames[r.status] || r.status
                  }}</span>
                </td>
                <td>{{ r.punchCount }}</td>
                <td>
                  <b>{{ r.storeCount }}</b> / {{ r.visitCount }}
                </td>
                <td>{{ r.completedPlans }} / {{ r.planned }}</td>
                <td>
                  {{
                    r.status === 'MISSING_CHECKOUT' && !r.periods.some((p) => p.end)
                      ? '—'
                      : duration(r.workMinutes)
                  }}<sup v-if="r.status === 'ACTIVE'">暂</sup
                  ><sup v-else-if="r.status === 'MISSING_CHECKOUT'">待</sup>
                </td>
                <td>
                  {{ r.files }} / {{ recordings(r.files, r.verifiedFiles, r.verifiedMillis)
                  }}<sup v-if="r.files > r.verifiedFiles">待</sup>
                </td>
                <td>
                  {{ r.distanceMeters == null ? '—' : (r.distanceMeters / 1000).toFixed(1)
                  }}<sup v-if="r.gapCount">断</sup>
                </td>
                <td>{{ r.newContacts ?? '待同步' }}</td>
                <td>
                  <button
                    v-if="r.issues.length"
                    class="field-button risk"
                    type="button"
                    @click.stop="inspectEmployee(r)"
                  >
                    {{ r.issues[0]?.title
                    }}{{ r.issues.length > 1 ? ' +' + (r.issues.length - 1) : '' }}
                  </button>
                  <span v-else class="field-muted">{{
                    r.pendingReviewCount
                      ? r.pendingReviewCount + ' 项待核'
                      : r.workDayId && r.distanceMeters == null
                        ? r.summaryPending
                          ? '计算中'
                          : '点位不足'
                        : '—'
                  }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="report && !report.items.length" class="field-empty">当前筛选没有匹配的员工</p>
        <ListTableFooter v-if="report && report.total > size">
          <CompactPagination
            :current-page="page"
            :page-size="size"
            :total="report.total"
            :page-sizes="[20, 50, 100]"
            @current-change="turn"
            @size-change="resize"
          />
        </ListTableFooter>
      </section>
      <SalesFieldworkDay
        v-if="tab === 'map' && selected && report"
        workbench
        :key="report.date + selected.salesProfileId"
        :person="rosterPerson(selected)"
        :daily="selected"
        :date="report.date"
        :initial-visit="focusVisit"
        @ledger="toLedger"
        @changed="load"
      />
      <p
        v-else-if="tab === 'map' && report && focusVisit && focused"
        class="field-panel field-empty"
        role="status"
      >
        {{ extraLoading ? '正在定位拜访工作日' : '当前范围内找不到这次拜访的工作日' }}
      </p>
    </div>
    <SalesTrackComparison
      v-else-if="canMap && report"
      :staff-options="options.people"
      :initial-person="selected?.salesProfileId"
      :initial-date="report.date"
      :mode="comparisonMode"
      :compare-date="q('compareDate')"
      :compare-person="q('comparePerson')"
      @change="changeComparison"
    />

    <el-drawer v-model="methodOpen" title="指标口径" size="min(440px, 96vw)" destroy-on-close>
      <dl class="field-method">
        <template v-for="[metric, definition] in metricDefinitions" :key="metric">
          <dt>{{ metric }}</dt>
          <dd>{{ definition }}</dd>
        </template>
      </dl>
    </el-drawer>
    <el-drawer v-model="caseOpen" title="外勤疑点" size="min(500px, 96vw)" destroy-on-close>
      <el-alert v-if="caseError" :title="caseError" type="error" />
      <SalesFieldworkCasePanel v-else :cases="cases" @changed="caseChanged" />
    </el-drawer>
  </section>
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue'
import { isNavigationFailure, NavigationFailureType, useRoute, useRouter } from 'vue-router'
import { Filter } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { businessDate } from '@/utils/business-date'
import { fieldClock } from '@/api/core/sales-fieldwork'
import { dayCases, type FieldworkCase } from '@/api/core/sales-fieldwork-review'
import {
  readFieldReport,
  reportCards,
  rosterPerson,
  cityName,
  duration,
  recordings,
  workNames,
  type DailyReport,
  type ReportEmployee,
} from '@/api/core/sales-fieldwork-report'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import OrderRegisterFilterCard from '@/components/supply/OrderRegisterFilterCard.vue'
import ListTableFooter from '@/components/supply/ListTableFooter.vue'
import CompactPagination from '@/components/supply/CompactPagination.vue'
import SalesFieldworkCasePanel from './SalesFieldworkCasePanel.vue'
const SalesFieldworkDay = defineAsyncComponent(() => import('./SalesFieldworkDay.vue'))
const SalesTrackComparison = defineAsyncComponent(() => import('./SalesTrackComparison.vue'))
const auth = useAuthStore(),
  route = useRoute(),
  router = useRouter(),
  canMap = computed(() => auth.hasPermission('sales:location:sensitive:read'))
const today = businessDate(new Date()),
  yesterday = businessDate(new Date(Date.now() - 86400000))
const isFuture = (day: Date) => businessDate(day) > today
const q = (key: string) => (typeof route.query[key] === 'string' ? String(route.query[key]) : '')
const defaults = () => ({
  date: today,
  city: '',
  departmentId: '',
  person: '',
  status: '',
  includeDescendants: false,
  pendingOnly: false,
  sort: 'risk',
})
const filter = ref(defaults())
const tab = computed(() =>
  q('view') === 'compare' && canMap.value ? 'compare' : q('view') === 'report' ? 'report' : 'map',
)
const summaryOpen = ref(tab.value === 'report')
watch(tab, (value) => {
  summaryOpen.value = value === 'report'
})
function rememberSummary(event: Event) {
  summaryOpen.value = (event.currentTarget as HTMLDetailsElement).open
}
const page = computed(() => Math.max(1, Math.min(100000, Math.floor(Number(q('page'))) || 1)))
const size = computed(() => ([20, 50, 100].includes(Number(q('size'))) ? Number(q('size')) : 20))
const focused = computed(() => q('selected') || q('person'))
const focusVisit = computed(() => q('visit'))
const comparisonMode = computed(() => (q('compareMode') === 'person' ? 'person' : 'day'))
const ledgerReturn = computed(() => {
  const target = q('ledgerBack')
  if (!canMap.value || !target.startsWith('/') || target.startsWith('//')) return null
  const resolved = router.resolve(target)
  return resolved.name === 'SupplySalesVisitsRecords' ? resolved : null
})
const reportFilters = computed(() => ({
  date: q('date') || today,
  city: q('city'),
  departmentId: q('departmentId'),
  person: q('person'),
  status: q('status'),
  sort: q('sort') || 'risk',
  includeDescendants: q('descendants') === '1',
  pendingOnly: q('pendingOnly') === '1',
  page: page.value,
  size: size.value,
}))
const reportKey = computed(() => JSON.stringify(reportFilters.value))
const owner = computed(() =>
  JSON.stringify([auth.user?.tenantId, auth.user?.id, auth.user?.permissions]),
)
const busy = ref(false),
  error = ref(''),
  report = ref<DailyReport | null>(null)
const options = ref<Pick<DailyReport, 'cities' | 'people' | 'departments'>>({
  cities: [],
  people: [],
  departments: [],
})
const extraSelection = ref<ReportEmployee | null>(null)
const extraLoading = ref(false)
const mapRows = computed(() => {
  const rows = report.value?.items ?? []
  return extraSelection.value ? [extraSelection.value, ...rows] : rows
})
const selected = computed(() => {
  const match = mapRows.value.find((row) => row.salesProfileId === focused.value)
  return match || (focusVisit.value && focused.value ? undefined : mapRows.value[0])
})
watch([report, focused, focusVisit, owner], async (_, __, onCleanup) => {
  extraLoading.value = false
  extraSelection.value = null
  const shown = report.value
  const id = focused.value
  if (!shown || !focusVisit.value || !id || shown.items.some((row) => row.salesProfileId === id))
    return
  const request = new AbortController()
  onCleanup(() => request.abort())
  extraLoading.value = true
  try {
    const result = await readFieldReport(
      {
        ...reportFilters.value,
        person: id,
        page: 1,
        size: 1,
      },
      request.signal,
    )
    if (!request.signal.aborted)
      extraSelection.value = result.items.find((row) => row.salesProfileId === id) ?? null
  } catch (cause) {
    if (!request.signal.aborted)
      error.value = cause instanceof Error ? cause.message : '所选业务员的工作日读取失败'
  } finally {
    if (!request.signal.aborted) extraLoading.value = false
  }
})
const asOf = computed(() =>
  report.value
    ? businessDate(report.value.asOf).slice(5) + ' ' + fieldClock(report.value.asOf)
    : '',
)
const rosterTitle = computed(() => {
  const { city, departmentId } = filter.value
  const department = options.value.departments.find((item) => item.id === departmentId)?.name
  return (department || (city ? cityName(city) : '')) + '人员日报'
})
const methodOpen = ref(false)
const metricDefinitions = [
  ['工作打卡', '按工作日统计服务端收到的签到和签退，包含分段恢复，门店到离店另计。'],
  ['拜访门店', '已到且已离的记录按门店去重；同店回访分别计入完成次数。'],
  ['工作时长', '累计有签到和签退的工作段，外勤中的时段暂计至数据截止时刻。'],
  ['录音文件', '统计服务端已经收到的不同录音文件。'],
  ['录音总时长', '汇总已核时长，未核文件单独列出。'],
  ['已记录里程', '累计服务端确认的连续路段里程，采样缺口两端不连线。'],
  ['新增企微', '按员工与联系人真实新增时间去重，未覆盖的人员显示待同步。'],
] as const
const caseOpen = ref(false),
  caseError = ref(''),
  cases = ref<FieldworkCase[]>([])
let active: AbortController | undefined, caseRequest: AbortController | undefined
function returnToLedger(event: MouseEvent) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const target = ledgerReturn.value
  if (!target) return
  event.preventDefault()
  if (router.options.history.state.back === target.fullPath) router.back()
  else void router.push(target.fullPath)
}
function updateQuery(query: Record<string, string | undefined>, replace = false) {
  return router.push({ name: 'SupplySalesDashboard', query: { ...route.query, ...query }, replace })
}
function selectTab(view: string) {
  void updateQuery({ view })
}
function choose(row: ReportEmployee) {
  void updateQuery({ selected: row.salesProfileId, visit: undefined, view: 'map' })
}
function inspectEmployee(row: ReportEmployee) {
  void openCase(row)
}
function changeComparison(state: { mode: string; date: string; person: string }) {
  void updateQuery({
    compareMode: state.mode,
    compareDate: state.date || undefined,
    comparePerson: state.person || undefined,
  })
}
async function openCase(r: ReportEmployee) {
  if (!r.workDayId || !auth.hasPermission('sales:risk:read')) return
  caseRequest?.abort()
  const token = new AbortController()
  caseRequest = token
  caseOpen.value = true
  caseError.value = ''
  cases.value = []
  try {
    const answer = await dayCases(r.salesProfileId, r.workDayId, token.signal)
    if (!token.signal.aborted) cases.value = answer
  } catch (e) {
    if (!token.signal.aborted) caseError.value = e instanceof Error ? e.message : '核查事项读取失败'
  }
}
function caseChanged(item: FieldworkCase) {
  cases.value = cases.value.map((r) => (r.id === item.id ? item : r))
  void load()
}
async function load() {
  active?.abort()
  const token = new AbortController()
  active = token
  busy.value = true
  error.value = ''
  report.value = null
  if (!auth.hasPermission('sales:dashboard:read')) {
    busy.value = false
    error.value = '暂无外勤监督权限'
    return
  }
  try {
    const data = await readFieldReport(
      {
        ...reportFilters.value,
        person: reportFilters.value.person || undefined,
      },
      token.signal,
    )
    if (!token.signal.aborted) {
      if (!data.items.length && page.value > 1) {
        await updateQuery({ page: String(Math.max(1, Math.ceil(data.total / size.value))) }, true)
        return
      }
      report.value = data
      options.value = data
    }
  } catch (e) {
    if (!token.signal.aborted) error.value = e instanceof Error ? e.message : '人员日报读取失败'
  } finally {
    if (!token.signal.aborted) busy.value = false
  }
}
function search() {
  const f = filter.value
  if (!f.date) return
  void updateQuery({
    date: f.date,
    city: f.city || undefined,
    departmentId: f.departmentId || undefined,
    person: f.person || undefined,
    status: f.status || undefined,
    descendants: f.departmentId && f.includeDescendants ? '1' : undefined,
    pendingOnly: f.pendingOnly ? '1' : undefined,
    sort: f.sort === 'risk' ? undefined : f.sort,
    page: undefined,
    visit: undefined,
    selected: undefined,
  }).then((failure) => {
    if (isNavigationFailure(failure, NavigationFailureType.duplicated)) void load()
  })
}
function turn(value: number) {
  void updateQuery({
    page: value > 1 ? String(value) : undefined,
    selected: undefined,
    visit: undefined,
  })
}
function resize(value: number) {
  void updateQuery({ size: String(value), page: undefined, selected: undefined, visit: undefined })
}
function togglePending() {
  filter.value.pendingOnly = !filter.value.pendingOnly
  search()
}
function setWorkStatus(status: string) {
  filter.value.status = status
  search()
}
function pickCity(city: string) {
  filter.value.city = city
  changeCity()
}
function changeCity() {
  filter.value.departmentId = ''
  filter.value.includeDescendants = false
  options.value = { ...options.value, departments: [], people: [] }
  changeDept()
}
function changeDept() {
  filter.value.person = ''
  options.value = { ...options.value, people: [] }
  search()
}
function pickDate(v: string) {
  filter.value.date = v
  search()
}
function reset() {
  filter.value = defaults()
  search()
}
function toLedger(visit?: string, openDetail = false) {
  if (!selected.value) return
  const f = reportFilters.value
  void router.push({
    name: 'SupplySalesVisitsRecords',
    query: {
      from: f.date,
      to: f.date,
      person: selected.value.salesProfileId,
      city: f.city || undefined,
      departmentId: f.departmentId || undefined,
      descendants: f.includeDescendants ? '1' : undefined,
      backPerson: f.person || undefined,
      backPage: String(page.value),
      backSize: String(size.value),
      backSort: f.sort,
      backStatus: f.status || undefined,
      backPending: f.pendingOnly ? '1' : undefined,
      fromBoard: '1',
      fromVisit: visit,
      detail: openDetail ? visit : undefined,
      detailDate: openDetail && visit ? f.date : undefined,
      boardView: tab.value,
      boardSelected: selected.value.salesProfileId,
      boardDate: f.date,
      boardCity: f.city || undefined,
      boardDept: f.departmentId || undefined,
      boardDesc: f.includeDescendants ? '1' : undefined,
    },
  })
}
watch(owner, () => {
  caseOpen.value = false
  caseRequest?.abort()
  cases.value = []
  options.value = { cities: [], departments: [], people: [] }
})
watch(
  [reportKey, owner],
  () => {
    if (route.name !== 'SupplySalesDashboard') return
    filter.value = reportFilters.value
    void load()
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  active?.abort()
  caseRequest?.abort()
})
</script>

<style scoped lang="scss" src="./sales-fieldwork.scss"></style>
<style scoped lang="scss">
.field-report {
  gap: 10px;
}
.field-report .list-filter-field :deep(.el-date-editor.el-input) {
  width: 100%;
}
.team-summary > summary {
  padding: 9px 12px;
  font-weight: 650;
  cursor: pointer;
}
.team-summary > summary:focus-visible {
  outline: 2px solid var(--field-accent);
  outline-offset: -3px;
}
.field-report .field-tabbar {
  gap: 14px;
  padding: 0 12px;
}
.field-report .field-tab {
  min-height: 39px;
}
.field-map-workbench {
  display: grid;
  grid-template-columns: 224px minmax(0, 1fr);
  align-items: start;
  gap: 10px;
}
.map-roster .field-panel-header {
  border-bottom: 1px solid var(--field-line);
}
.map-roster-list {
  max-height: min(58vh, 540px);
  overflow: auto;
}
.map-roster-person {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  min-height: 47px;
  padding: 6px 9px;
  border: 0;
  border-bottom: 1px solid var(--field-line);
  background: transparent;
  color: var(--field-ink);
  text-align: left;
  font: inherit;
  cursor: pointer;
}
.map-roster-person:last-child {
  border-bottom: 0;
}
.map-roster-person:hover,
.map-roster-person[aria-pressed='true'] {
  background: var(--field-selected);
}
.map-roster-person:focus-visible {
  outline: 2px solid var(--field-accent);
  outline-offset: -3px;
}
.map-roster-name {
  flex: 1;
  min-width: 0;
}
.map-roster-name :is(strong, small) {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.map-roster-name small {
  margin-top: 2px;
  font-size: 11px;
  color: var(--field-muted);
}
.map-roster-person .field-status {
  white-space: nowrap;
}
.map-roster-pages {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px;
  border-top: 1px solid var(--field-line);
}
@media (max-width: 1160px) {
  .field-map-workbench {
    grid-template-columns: minmax(0, 1fr);
  }
  .map-roster-list {
    display: flex;
  }
  .map-roster-person {
    flex: 0 0 185px;
    border: 0;
    border-right: 1px solid var(--field-line);
  }
}
.metrics {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  margin: 0;
  padding: 6px 0;
}
.metrics > div {
  min-width: 0;
  padding: 0 12px;
}
.metrics > div + div {
  border-left: 1px solid var(--field-line);
}
.metrics dt,
.metrics small {
  color: var(--field-muted);
  font-size: 12px;
}
.metrics dd {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 3px;
  margin: 1px 0;
}
.metrics dd strong {
  font-size: clamp(15px, 1.65vw, 23px);
  font-weight: 720;
  line-height: 1.15;
  letter-spacing: -0.025em;
}
.metrics dd span {
  font-weight: 650;
}
.cities,
.roster-heading {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px 8px;
}
.cities {
  color: var(--field-muted);
  font-size: 12px;
}
.cities button {
  font-weight: 400;
}
.cities button b {
  margin-right: 4px;
}
.roster-sort {
  width: 86px;
}
.roster-scroll {
  max-height: 182px;
}
.roster-table {
  min-width: 835px;
  white-space: nowrap;
}
.roster-table th,
.roster-table td {
  height: 30px;
  text-align: right;
}
.roster-table tr > :is(th, td):is(:first-child, :nth-child(2), :last-child) {
  text-align: left;
}
.roster-table tbody tr {
  cursor: pointer;
}
.roster-table tbody tr.selected {
  background: var(--field-selected);
}
.roster-table th:first-child {
  width: 20%;
}
.employee {
  display: flex;
  max-width: clamp(155px, 17vw, 244px);
  align-items: center;
  gap: 5px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.employee strong,
.employee small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.employee strong {
  font-weight: 700;
}
.employee small {
  color: var(--field-muted);
  font-weight: 400;
  font-size: 11px;
}
.employee-initial {
  display: grid;
  width: 21px;
  height: 21px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 4px;
  background: #e3eeeb;
  color: #31675f;
  font-size: 12px;
}
.selected .employee-initial {
  background: #177b6d;
  color: white;
}
.roster .risk {
  min-height: 21px;
  max-width: 143px;
  padding: 1px 5px;
  overflow: hidden;
  border-color: #ecd9bb;
  background: #fbf0df;
  color: #805016;
  font-size: 12px;
  text-overflow: ellipsis;
}
.roster sup {
  margin-left: 2px;
  color: #805016;
}
.field-method {
  margin: 0;
}
.field-method dt {
  font-weight: 700;
}
.field-method dd {
  margin: 3px 0 11px;
  line-height: 1.5;
  color: #495f6e;
}
@media (max-width: 840px) {
  .metrics {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    row-gap: 7px;
  }
  .metrics > div:nth-child(5) {
    border-left: 0;
  }
}
@media (max-width: 520px) {
  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .metrics > div:nth-child(odd) {
    border-left: 0;
  }
}
</style>
