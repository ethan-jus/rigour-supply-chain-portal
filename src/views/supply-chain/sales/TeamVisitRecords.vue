<template>
  <section class="field-page visit-ledger">
    <template v-if="detailId">
      <div class="field-heading-tools">
        <button ref="detailBack" type="button" class="field-link" @click="closeDetail">
          返回拜访记录
        </button>
        <button
          v-if="q('fromBoard') === '1' && q('boardView') === 'map' && canBoard"
          type="button"
          class="field-link"
          @click="backToBoard"
        >
          返回工作日地图
        </button>
      </div>
      <el-alert v-if="detailError" :title="detailError" type="error" :closable="false" />
      <p v-else-if="!detail" class="field-empty" role="status">正在读取拜访详情</p>
      <SalesVisitDetailPage
        v-else
        :key="detail.id"
        :visit="detail"
        :can-map="canMap"
        @map="openMap(detail)"
        @history="openHistory"
        @changed="refreshDetail"
      />
    </template>

    <template v-else>
      <header class="field-heading">
        <SupplyPageTitle>{{ route.meta.title }}</SupplyPageTitle>
        <button
          v-if="q('fromBoard') === '1' && canBoard"
          type="button"
          class="field-link"
          @click="backToBoard"
        >
          {{ q('boardView') === 'map' ? '返回团队外勤' : '返回人员日报' }}
        </button>
      </header>
      <OrderRegisterFilterCard
        class="order-register-filter--compact"
        :loading="busy"
        @search="search"
        @reset="reset"
      >
        <template #primary>
          <div class="list-filter-field list-filter-field--date-range">
            <el-date-picker
              v-model="range"
              type="daterange"
              format="YYYY/MM/DD"
              value-format="YYYY-MM-DD"
              start-placeholder="起始日期"
              end-placeholder="截止日期"
              aria-label="拜访日期"
              clearable
              @clear="clearDate"
            />
          </div>
          <div class="list-filter-group">
            <div class="list-filter-field list-filter-field--select">
              <el-select
                v-model="department"
                placeholder="部门"
                aria-label="部门"
                clearable
                filterable
                @change="departmentChanged"
              >
                <el-option
                  v-for="o in options.departments"
                  :key="o.id"
                  :label="o.name"
                  :value="o.id"
                />
              </el-select>
            </div>
            <el-checkbox v-if="department" v-model="desc" @change="departmentChanged"
              >含子部门</el-checkbox
            >
          </div>
          <div class="list-filter-field list-filter-field--person">
            <el-select
              v-model="person"
              placeholder="业务员"
              aria-label="业务员"
              clearable
              filterable
            >
              <el-option v-for="o in options.people" :key="o.id" :label="o.name" :value="o.id" />
            </el-select>
          </div>
          <div class="list-filter-field">
            <el-input
              v-model="keyword"
              clearable
              maxlength="80"
              placeholder="门店"
              aria-label="门店"
            />
          </div>
          <div class="list-filter-field list-filter-field--select">
            <el-select v-model="status" clearable placeholder="核验状态" aria-label="核验状态">
              <el-option
                v-for="(label, value) in assessmentNames"
                :key="value"
                :label="label"
                :value="value"
              />
            </el-select>
          </div>
          <el-tag
            v-if="q('origin')"
            closable
            @close="changeQuery({ origin: undefined, page: undefined })"
          >
            {{ q('origin') === 'UNPLANNED' ? '计划外到店' : '计划内到店' }}
          </el-tag>
          <el-tag
            v-if="q('city')"
            closable
            @close="changeQuery({ city: undefined, page: undefined })"
          >
            {{ cityName(q('city')) }}
          </el-tag>
          <el-tag v-if="employeeCode" closable @close="clearEmployee"
            >员工 {{ employeeCode }}</el-tag
          >
        </template>
      </OrderRegisterFilterCard>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <section
        ref="ledgerPanel"
        class="field-panel"
        v-loading="busy"
        aria-labelledby="visit-ledger-title"
      >
        <header class="field-panel-header ledger-panel-header">
          <h2 id="visit-ledger-title">
            {{ assessment ? assessmentNames[assessment] + '拜访' : '全部拜访' }}
          </h2>
          <span v-if="data" class="field-muted ledger-result-count">
            {{ data.total }} 条记录 <span aria-hidden="true">·</span> {{ data.stores }} 家已访门店
          </span>
        </header>
        <div class="field-table-wrap" tabindex="0" role="region" aria-label="拜访台账，可横向浏览">
          <table class="field-table visit-table" aria-labelledby="visit-ledger-title">
            <colgroup>
              <col class="visit-store-col" />
              <col />
              <col />
              <col class="visit-time-col" />
              <col class="visit-short-col" />
              <col class="visit-short-col" />
              <col class="visit-short-col" />
              <col class="visit-audio-col" />
              <col class="visit-short-col" />
              <col />
              <col class="visit-actions-col" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">门店</th>
                <th scope="col">业务员</th>
                <th scope="col">部门</th>
                <th scope="col">到店 / 离店</th>
                <th scope="col" title="同一业务员对同一门店的初访或回访">类型</th>
                <th scope="col" title="截至本次，该门店在可见范围内的累计拜访次数">拜访数</th>
                <th scope="col">停留</th>
                <th scope="col" title="录音文件数及已核时长">录音</th>
                <th scope="col">门头</th>
                <th scope="col">核验</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in data?.items" :key="row.id" :data-visit-id="row.id">
                <th scope="row" class="visit-store">
                  <button
                    type="button"
                    class="field-link"
                    :title="storeName(row)"
                    @click="openDetail(row.id, row.date)"
                  >
                    {{ storeName(row) }}
                  </button>
                </th>
                <td>{{ row.name || '—' }}</td>
                <td>{{ row.departmentName || '—' }}</td>
                <td>
                  {{ fieldClock(row.arrived) }}–{{
                    row.departed ? fieldClock(row.departed) : '进行中'
                  }}
                  <small>{{ row.date }}</small>
                </td>
                <td>{{ visitType(row.id) }}</td>
                <td>
                  {{
                    data?.storeVisitCounts?.[row.id]
                      ? '第 ' + data.storeVisitCounts[row.id]!.storeVisits + ' 次'
                      : '—'
                  }}
                </td>
                <td>
                  {{ visitDwellMinutes(row) === null ? '—' : visitDwellMinutes(row) + ' 分钟' }}
                </td>
                <td>
                  <button
                    v-if="row.files && canAudio"
                    type="button"
                    class="field-link"
                    :aria-label="storeName(row) + '的录音与转写'"
                    @click="openDetail(row.id, row.date)"
                  >
                    {{ row.files }} 段
                  </button>
                  <span v-else>{{ row.files ? row.files + ' 段' : '—' }}</span>
                  <small v-if="row.files">{{
                    recordings(row.files, row.verifiedFiles, row.verifiedMillis)
                  }}</small>
                  <small v-if="row.verifiedFiles > 0 && row.files > row.verifiedFiles"
                    >部分文件待核</small
                  >
                </td>
                <td>
                  <VisitStorefrontThumbnail
                    v-if="canPhotos && (row.hasStorefrontPhoto ?? row.photos > 0)"
                    :key="owner + row.id"
                    :visit-id="row.id"
                    :store-name="storeName(row)"
                  />
                  <span v-else class="field-muted">{{ !canPhotos ? '无权限' : '暂无' }}</span>
                </td>
                <td>
                  <span class="field-status" :data-status="row.assessment">{{
                    assessmentNames[row.assessment] || '待核'
                  }}</span>
                  <small
                    v-if="row.assessment !== 'VALID' && visitAssessmentReason(row)"
                    :title="visitAssessmentReason(row)"
                    >{{ visitAssessmentReason(row) }}</small
                  >
                </td>
                <td>
                  <div class="visit-actions">
                    <button type="button" class="field-link" @click="openDetail(row.id, row.date)">
                      详情
                    </button>
                    <button
                      v-if="canMap"
                      type="button"
                      class="field-link map-link"
                      :aria-label="storeName(row) + '的工作日地图'"
                      @click="openMap(row)"
                    >
                      <el-icon><MapLocation /></el-icon>地图
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="data && !data.items.length" class="field-empty">没有符合条件的拜访记录</p>
        <ListTableFooter v-if="data?.total">
          <CompactPagination
            :total="data.total"
            :current-page="page"
            :page-size="size"
            :page-sizes="[25, 50, 100]"
            @current-change="turn"
            @size-change="resize"
          />
        </ListTableFooter>
      </section>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  isNavigationFailure,
  NavigationFailureType,
  useRoute,
  useRouter,
  type LocationQueryRaw,
} from 'vue-router'
import { MapLocation } from '@element-plus/icons-vue'
import { useNavigationStore } from '@/stores/navigation'
import { useAuthStore } from '@/stores/auth'
import VisitStorefrontThumbnail from './VisitStorefrontThumbnail.vue'
import { fieldClock } from '@/api/core/sales-fieldwork'
import {
  readVisitLedger,
  assessmentNames,
  cityName,
  recordings,
  visitAssessmentReason,
  visitDwellMinutes,
  type ReportLedger,
  type ReportVisit,
} from '@/api/core/sales-fieldwork-report'
import type { HistoryCapture } from '@/api/core/sales-fieldwork-evidence'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import OrderRegisterFilterCard from '@/components/supply/OrderRegisterFilterCard.vue'
import CompactPagination from '@/components/supply/CompactPagination.vue'
import ListTableFooter from '@/components/supply/ListTableFooter.vue'
import SalesVisitDetailPage from './SalesVisitDetailPage.vue'

const route = useRoute()
const router = useRouter()
const nav = useNavigationStore()
const auth = useAuthStore()
const canBoard = computed(() => nav.hasPath('SUPPLY_CHAIN', '/supply-chain/sales'))
const canMap = computed(() => canBoard.value && auth.hasPermission('sales:location:sensitive:read'))
const canPhotos = computed(() => auth.hasPermission('sales:evidence:sensitive:read'))
const canAudio = computed(() => auth.hasPermission('sales:recording:sensitive:play'))
const owner = computed(() =>
  JSON.stringify([auth.user?.id, auth.user?.tenantId, auth.user?.permissions]),
)
const q = (key: string) => (typeof route.query[key] === 'string' ? String(route.query[key]) : '')
const storeName = (row: ReportVisit) => row.store || row.customer || '门店待关联'
const defaultOptions = () => ({ departments: [], people: [] })
const options = ref<Pick<ReportLedger, 'departments' | 'people'>>(defaultOptions())
const data = ref<ReportLedger | null>(null)
const busy = ref(false)
const error = ref('')
const range = ref<[string, string] | null>(null)
const department = ref('')
const person = ref('')
const keyword = ref('')
const status = ref('')
const desc = ref(false)
const employeeCode = computed(() => q('employeeCode'))
const assessment = computed(() =>
  Object.hasOwn(assessmentNames, q('assessment')) ? q('assessment') : '',
)
const page = computed(() => Math.max(1, Math.min(100000, Math.floor(Number(q('page'))) || 1)))
const size = computed(() => ([25, 50, 100].includes(Number(q('size'))) ? Number(q('size')) : 25))
const ledgerFilters = computed(() => ({
  from: q('from') || undefined,
  to: q('to') || q('from') || undefined,
  city: q('city'),
  departmentId: q('departmentId'),
  person: q('person'),
  keyword: q('keyword'),
  origin: q('origin'),
  includeDescendants: q('descendants') === '1',
  employeeCode: employeeCode.value,
  assessment: assessment.value,
  page: page.value,
  size: size.value,
}))
const ledgerKey = computed(() => JSON.stringify(ledgerFilters.value))
const ledgerRevision = ref(0)
const detailId = computed(() => q('detail') || q('visitId'))
const detailDate = computed(() => q('detailDate') || ledgerFilters.value.from)
const detail = ref<ReportVisit | null>(null)
const detailError = ref('')
const detailRevision = ref(0)
const refreshDetail = () => detailRevision.value++

function visitType(id: string) {
  const counts = data.value?.storeVisitCounts?.[id]
  return counts ? (counts.salespersonVisits === 1 ? '初访' : '回访') : '—'
}

function changeQuery(query: Record<string, string | undefined>, replace = false) {
  return router.push({
    name: 'SupplySalesVisitsRecords',
    query: { ...route.query, ...query },
    replace,
  })
}

function search() {
  void changeQuery({
    from: range.value?.[0],
    to: range.value?.[1],
    departmentId: department.value || undefined,
    person: person.value || undefined,
    assessment: status.value || undefined,
    keyword: keyword.value.trim() || undefined,
    descendants: department.value && desc.value ? '1' : undefined,
    page: undefined,
  }).then((failure) => {
    if (isNavigationFailure(failure, NavigationFailureType.duplicated)) ledgerRevision.value++
  })
}

function reset() {
  range.value = null
  department.value = person.value = keyword.value = status.value = ''
  desc.value = false
  void changeQuery({
    from: undefined,
    to: undefined,
    city: undefined,
    departmentId: undefined,
    person: undefined,
    origin: undefined,
    keyword: undefined,
    descendants: undefined,
    assessment: undefined,
    employeeCode: undefined,
    page: undefined,
  })
}

function clearDate() {
  range.value = null
  search()
}
function turn(value: number) {
  void changeQuery({ page: value > 1 ? String(value) : undefined })
}
function resize(value: number) {
  void changeQuery({ size: String(value), page: undefined })
}
function clearEmployee() {
  void changeQuery({ employeeCode: undefined, page: undefined })
}
function departmentChanged() {
  person.value = ''
  search()
}

const detailBack = ref<HTMLButtonElement | null>(null)
const ledgerPanel = ref<HTMLElement | null>(null)
let listVisitId = ''
function openDetail(id: string, date: string) {
  if (!detailId.value) listVisitId = id
  void changeQuery({ detail: id, detailDate: date, visitId: undefined })
}
function openHistory(item: HistoryCapture) {
  openDetail(item.visitId, item.businessDate)
}
function closeDetail() {
  const query: LocationQueryRaw = { ...route.query }
  delete query.detail
  delete query.detailDate
  delete query.visitId
  const target = router.resolve({ name: 'SupplySalesVisitsRecords', query })
  if (router.options.history.state.back === target.fullPath) router.back()
  else void router.replace(target.fullPath)
}
watch(detailId, async (id) => {
  await nextTick()
  if (id) {
    detailBack.value?.focus()
  } else if (listVisitId) {
    const row = [
      ...(ledgerPanel.value?.querySelectorAll<HTMLElement>('[data-visit-id]') ?? []),
    ].find((item) => item.dataset.visitId === listVisitId)
    row?.querySelector('button')?.focus()
  }
})
function backToBoard() {
  if (!canBoard.value) return
  const savedScope = q('boardDate') !== ''
  const target = router.resolve({
    name: 'SupplySalesDashboard',
    query: {
      date: (savedScope ? q('boardDate') : q('from')) || undefined,
      city: (savedScope ? q('boardCity') : q('city')) || undefined,
      departmentId: (savedScope ? q('boardDept') : q('departmentId')) || undefined,
      descendants: (savedScope ? q('boardDesc') : q('descendants')) || undefined,
      person: q('backPerson') || undefined,
      selected: q('boardSelected') || q('person') || undefined,
      visit: q('fromVisit') || undefined,
      view: q('boardView') || 'report',
      page: q('backPage') || undefined,
      size: q('backSize') || undefined,
      sort: q('backSort') || undefined,
      status: q('backStatus') || undefined,
      pendingOnly: q('backPending') || undefined,
    },
  })
  if (router.options.history.state.back === target.fullPath) router.back()
  else void router.push(target.fullPath)
}
function openMap(row: ReportVisit) {
  if (!canMap.value) return
  void router.push({
    name: 'SupplySalesDashboard',
    query: {
      date: row.date,
      city: row.city || undefined,
      selected: row.profileId,
      visit: row.id,
      view: 'map',
      ledgerBack: route.fullPath,
    },
  })
}

watch(owner, () => {
  options.value = defaultOptions()
})
watch(
  [ledgerKey, owner, ledgerRevision],
  async (_, __, onCleanup) => {
    const filters = ledgerFilters.value
    range.value = filters.from && filters.to ? [filters.from, filters.to] : null
    department.value = filters.departmentId
    person.value = filters.person
    keyword.value = filters.keyword
    status.value = filters.assessment
    desc.value = filters.includeDescendants
    const request = new AbortController()
    onCleanup(() => request.abort())
    busy.value = true
    error.value = ''
    data.value = null
    try {
      const result = await readVisitLedger(filters, request.signal)
      if (request.signal.aborted) return
      if (!result.items.length && filters.page > 1) {
        await changeQuery(
          { page: String(Math.max(1, Math.ceil(result.total / filters.size))) },
          true,
        )
        return
      }
      data.value = result
      options.value = result
    } catch (cause) {
      if (!request.signal.aborted)
        error.value = cause instanceof Error ? cause.message : '拜访记录读取失败'
    } finally {
      if (!request.signal.aborted) busy.value = false
    }
  },
  { immediate: true },
)

watch(
  [detailId, detailDate, owner, detailRevision],
  async (_, __, onCleanup) => {
    if (detail.value?.id !== detailId.value) detail.value = null
    detailError.value = ''
    if (!detailId.value) return
    const id = detailId.value
    const date = detailDate.value
    const request = new AbortController()
    onCleanup(() => request.abort())
    try {
      const result = await readVisitLedger(
        { from: date, to: date, visitId: id, size: 1 },
        request.signal,
      )
      if (request.signal.aborted) return
      detail.value = result.items.find((row) => row.id === id) ?? null
      if (!detail.value) detailError.value = '当前范围内找不到这条拜访记录'
    } catch (cause) {
      if (!request.signal.aborted)
        detailError.value = cause instanceof Error ? cause.message : '拜访详情读取失败'
    }
  },
  { immediate: true },
)
</script>

<style scoped lang="scss" src="./sales-fieldwork.scss"></style>
<style scoped lang="scss">
.visit-ledger {
  gap: 14px;
  width: 100%;
}
.ledger-panel-header {
  min-height: 48px;
  padding: 8px 14px;
}
.ledger-result-count {
  font-variant-numeric: tabular-nums;
}
.ledger-result-count > span {
  margin-inline: 3px;
}
.visit-table {
  min-width: 1080px;
  table-layout: fixed;
  font-size: var(--app-font-size-base, 14px);
  font-variant-numeric: tabular-nums;
}
.visit-store-col {
  width: 19%;
}
.visit-time-col {
  width: 12%;
}
.visit-short-col {
  width: 6%;
}
.visit-audio-col {
  width: 13%;
}
.visit-actions-col {
  width: 9%;
}
.visit-actions {
  display: flex;
  gap: 10px;
}
.visit-table th,
.visit-table td {
  padding-inline: clamp(8px, 0.8vw, 18px);
}
.visit-table thead th {
  height: 42px;
  padding-block: 8px;
  border-top-color: var(--field-line);
  border-bottom: 1px solid var(--field-line);
  background: #f3f6fa;
  color: var(--field-ink);
  font-size: var(--app-font-size-small, 13px);
  font-weight: 650;
}
.visit-table td,
.visit-table tbody th {
  height: 58px;
  padding-block: 9px;
  text-align: left;
}
.visit-table tbody tr:first-child > * {
  border-top: 0;
}
.visit-table .field-status {
  font-size: var(--app-font-size-small, 13px);
  font-weight: 600;
}
.visit-table small,
.visit-store button {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.visit-table small {
  margin-top: 4px;
  color: var(--field-muted);
  font-size: var(--app-font-size-caption, 12px);
  font-weight: 400;
}
.visit-store button {
  text-align: left;
}
.map-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
</style>
