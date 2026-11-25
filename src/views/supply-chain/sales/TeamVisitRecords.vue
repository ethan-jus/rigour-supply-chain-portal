<template>
  <section class="field-page visit-ledger supply-page supply-page--business-main">
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
      class="order-register-filter--compact visit-filters"
      :loading="busy"
      @search="search"
      @reset="reset"
    >
      <template #primary>
        <div class="list-filter-group">
          <span class="filter-label">拜访日期</span>
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
        </div>
        <div class="list-filter-group">
          <label class="filter-label" for="visit-filter-department">部门</label>
          <div class="list-filter-field list-filter-field--select">
            <el-select
              v-model="department"
              id="visit-filter-department"
              placeholder="全部部门"
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
            placeholder="搜索业务员"
            no-match-text="没有匹配的业务员"
            aria-label="业务员"
            clearable
            filterable
          >
            <template #prefix
              ><el-icon aria-hidden="true"><Search /></el-icon
            ></template>
            <el-option v-for="o in options.people" :key="o.id" :label="o.name" :value="o.id" />
          </el-select>
        </div>
        <div class="list-filter-field">
          <el-input
            v-model="keyword"
            clearable
            maxlength="80"
            placeholder="搜索门店"
            aria-label="门店"
          />
        </div>
        <div class="list-filter-group">
          <label class="filter-label" for="visit-filter-status">核验</label>
          <div class="list-filter-field list-filter-field--select">
            <el-select
              id="visit-filter-status"
              v-model="status"
              clearable
              placeholder="全部状态"
              aria-label="核验状态"
            >
              <el-option
                v-for="(label, value) in assessmentNames"
                :key="value"
                :label="label"
                :value="value"
              />
            </el-select>
          </div>
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
        <el-tag v-if="employeeCode" closable @close="clearEmployee">员工 {{ employeeCode }}</el-tag>
      </template>
    </OrderRegisterFilterCard>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-card shadow="never" class="list-card" v-loading="busy" aria-labelledby="visit-ledger-title">
      <header class="field-panel-header ledger-panel-header">
        <h2 id="visit-ledger-title">
          {{ assessment ? assessmentNames[assessment] + '拜访' : '拜访明细' }}
          <span v-if="data" class="field-count">{{ data.total }}</span>
        </h2>
        <span v-if="data" class="field-muted ledger-result-count">
          {{ data.stores }} 家已访门店
        </span>
      </header>
      <div
        ref="ledgerPanel"
        class="field-table-wrap"
        tabindex="0"
        role="region"
        aria-label="拜访台账，可横向浏览"
      >
        <table class="field-table visit-table" aria-labelledby="visit-ledger-title">
          <colgroup>
            <col class="date-col" />
            <col />
            <col class="region-col" />
            <col class="person-col" />
            <col class="department-col" />
            <col class="clock-col" />
            <col class="clock-col" />
            <col class="type-col" />
            <col class="count-col" />
            <col class="dwell-col" />
            <col class="outcome-col" />
            <col class="visit-audio-col" />
            <col class="photo-col" />
            <col class="assessment-col" />
            <col v-if="canMap" class="action-col" />
          </colgroup>
          <thead>
            <tr>
              <template v-for="column in leadingColumns" :key="column.key">
                <th
                  :class="{
                    'arrival-heading': column.key === 'arrived',
                    'departure-heading': column.key === 'departed',
                  }"
                  scope="col"
                  :aria-sort="
                    sort === column.key ? (ascending ? 'ascending' : 'descending') : undefined
                  "
                >
                  <button
                    type="button"
                    class="visit-sort"
                    :aria-label="'按' + column.label + '排序'"
                    @click="sortBy(column.key)"
                  >
                    {{ column.label }}
                    <span class="sort-carets" aria-hidden="true"></span>
                  </button>
                </th>
                <th v-if="column.key === 'store'" scope="col" title="门店所在省市">地区</th>
              </template>
              <th scope="col" title="同一业务员对同一门店的初访或回访">类型</th>
              <th scope="col" title="截至本次，该门店在可见范围内的累计拜访次数">拜访数</th>
              <th scope="col">停留</th>
              <th scope="col">沟通结果</th>
              <th scope="col" title="播放本次拜访录音">录音</th>
              <th scope="col">门头</th>
              <th scope="col">核验</th>
              <th v-if="canMap" scope="col">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data?.items" :key="row.id" :data-visit-id="row.id">
              <td class="date-cell">{{ row.date }}</td>
              <th scope="row" class="visit-store">
                <button
                  type="button"
                  class="field-link"
                  :title="storeName(row)"
                  aria-haspopup="dialog"
                  @click="openDetail(row)"
                >
                  {{ storeName(row) }}
                </button>
              </th>
              <td class="clipped-cell" :title="data?.storeRegions?.[row.id]">
                {{ data?.storeRegions?.[row.id] || '—' }}
              </td>
              <td class="visit-person clipped-cell" :title="row.name">{{ row.name || '—' }}</td>
              <td class="clipped-cell" :title="row.departmentName || undefined">
                {{ row.departmentName || '—' }}
              </td>
              <td class="arrival-time">
                <time>{{ fieldClock(row.arrived) }}</time
                ><span aria-hidden="true"> – </span>
              </td>
              <td class="departure-time">
                <time v-if="row.departed">{{ fieldClock(row.departed) }}</time>
                <span v-else>进行中</span>
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
                <span
                  class="visit-outcome"
                  :class="{ contacted: row.communicationResult && row.outcome === 'CONTACTED' }"
                  >{{ row.communicationResult || '未记录' }}</span
                >
              </td>
              <td>
                <VisitRecordingPlayer
                  v-if="row.files && canAudio"
                  :key="owner + row.id"
                  :visit="row.id"
                  :store="storeName(row)"
                  :total-millis="
                    row.playbackMillis ??
                    (row.verifiedFiles === row.files ? row.verifiedMillis : null)
                  "
                  :active="activeRecording === row.id"
                  @activate="activeRecording = row.id"
                />
                <span v-else>{{ row.files ? '无权限' : '—' }}</span>
              </td>
              <td class="storefront-cell">
                <VisitStorefrontThumbnail
                  v-if="canPhotos && (row.hasStorefrontPhoto ?? row.photos > 0)"
                  :key="owner + row.id"
                  :visit-id="row.id"
                  :store-name="storeName(row)"
                />
                <span v-else :title="canPhotos ? '无门头照' : undefined">{{
                  canPhotos ? '—' : '无权限'
                }}</span>
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
              <td v-if="canMap">
                <button
                  type="button"
                  class="field-link map-link"
                  :aria-label="storeName(row) + '的工作日地图'"
                  @click="openMap(row)"
                >
                  <svg
                    aria-hidden="true"
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path
                      d="M20 10c0 5-5.55 10.2-7.42 11.81a.9.9 0 0 1-1.16 0C9.55 20.2 4 15 4 10a8 8 0 1 1 16 0Z"
                    />
                    <circle cx="12" cy="10" r="2.5" /></svg
                  >地图
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="data && !data.items.length" class="field-empty">没有符合条件的拜访记录</p>
      <ListTableFooter v-if="data">
        <CompactPagination
          :total="data.total"
          :current-page="page"
          :page-size="size"
          @current-change="turn"
          @size-change="resize"
        />
      </ListTableFooter>
    </el-card>
    <SalesVisitDetailDialog
      v-if="detailId"
      :key="owner"
      :visit-id="detailId"
      :date="detailDate"
      :record="data?.items.find((row) => row.id === detailId) ?? selected ?? undefined"
      :visit-type="visitType(detailId)"
      :region="data?.storeRegions?.[detailId]"
      :rows="data?.items"
      @select="openDetail"
      :can-map="canMap"
      @close="closeDetail"
      @map="openMap"
      @changed="ledgerRevision++"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Search } from '@element-plus/icons-vue'
import {
  isNavigationFailure,
  NavigationFailureType,
  useRoute,
  useRouter,
  type LocationQueryRaw,
} from 'vue-router'
import { useNavigationStore } from '@/stores/navigation'
import { useAuthStore } from '@/stores/auth'
import VisitRecordingPlayer from './VisitRecordingPlayer.vue'
import VisitStorefrontThumbnail from './VisitStorefrontThumbnail.vue'
import { fieldClock } from '@/api/core/sales-fieldwork'
import {
  readVisitLedger,
  assessmentNames,
  cityName,
  type LedgerSort,
  visitAssessmentReason,
  visitDwellMinutes,
  type ReportLedger,
  type ReportVisit,
} from '@/api/core/sales-fieldwork-report'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import OrderRegisterFilterCard from '@/components/supply/OrderRegisterFilterCard.vue'
import CompactPagination from '@/components/supply/CompactPagination.vue'
import ListTableFooter from '@/components/supply/ListTableFooter.vue'
import SalesVisitDetailDialog from './SalesVisitDetailDialog.vue'

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
const size = computed(() =>
  [20, 50, 100, 200].includes(Number(q('size'))) ? Number(q('size')) : 20,
)
const activeRecording = ref('')
const leadingColumns: { label: string; key: LedgerSort }[] = [
  { label: '日期', key: 'date' },
  { label: '门店', key: 'store' },
  { label: '业务员', key: 'person' },
  { label: '部门', key: 'department' },
  { label: '到店', key: 'arrived' },
  { label: '离店', key: 'departed' },
]
const sort = computed(() => leadingColumns.find((c) => c.key === q('sort'))?.key ?? 'date')
const startsAscending = (key: LedgerSort) =>
  key === 'store' || key === 'person' || key === 'department'
const ascending = computed(() =>
  q('ascending') ? q('ascending') === '1' : startsAscending(sort.value),
)
function sortBy(key: LedgerSort) {
  const next = key === sort.value ? !ascending.value : startsAscending(key)
  void changeQuery({ sort: key, ascending: next ? '1' : '0', page: undefined })
}
const ledgerFilters = computed(() => ({
  sort: sort.value,
  ascending: ascending.value,
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
const selected = ref<ReportVisit | null>(null)
const detailId = computed(() => selected.value?.id || q('detail') || q('visitId'))
const detailDate = computed(
  () => selected.value?.date || q('detailDate') || ledgerFilters.value.from,
)

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
    sort: undefined,
    ascending: undefined,
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

const ledgerPanel = ref<HTMLElement | null>(null)
function openDetail(row: ReportVisit) {
  activeRecording.value = ''
  selected.value = row
}
async function closeDetail(restoreFocus = true) {
  const id = detailId.value
  selected.value = null
  if (q('detail') || q('visitId')) {
    const query: LocationQueryRaw = { ...route.query }
    delete query.detail
    delete query.detailDate
    delete query.visitId
    await router.replace({ name: 'SupplySalesVisitsRecords', query })
  }
  if (!restoreFocus) return
  await nextTick()
  const rows = ledgerPanel.value?.querySelectorAll<HTMLElement>('[data-visit-id]')
  const trigger = Array.from(rows ?? []).find((row) => row.dataset.visitId === id)
  trigger?.querySelector('button')?.focus({ preventScroll: true })
}
function backToBoard() {
  if (!canBoard.value) return
  const savedScope = q('boardDate') !== ''
  const dayBack = q('dayBack')
  const saved =
    dayBack.startsWith('/') && !dayBack.startsWith('//') ? router.resolve(dayBack) : null
  const target =
    saved?.name === 'SupplySalesDashboard'
      ? saved
      : router.resolve({
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
async function openMap(row: ReportVisit) {
  if (!canMap.value) return
  if (detailId.value) await closeDetail(false)
  void router.push({
    name: 'SupplySalesDashboard',
    query: {
      date: row.date,
      selected: row.profileId,
      visit: row.id,
      view: 'map',
      ledgerBack: route.fullPath,
    },
  })
}

watch(owner, () => {
  selected.value = null
  options.value = defaultOptions()
})
watch(
  [ledgerKey, owner, ledgerRevision],
  async (_, __, onCleanup) => {
    const filters = ledgerFilters.value
    activeRecording.value = ''
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
</script>

<style scoped lang="scss" src="./sales-fieldwork.scss"></style>
<style scoped lang="scss">
.visit-ledger {
  gap: 14px;
  width: 100%;
}
.visit-ledger.supply-page {
  --visit-font:
    Inter, -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-family: var(--visit-font);
  color: #18324a;
  -webkit-font-smoothing: auto;
}
.visit-ledger .visit-filters {
  --el-font-family: var(--visit-font);
  --el-border-color: #d3dce5;
  --el-border-radius-base: 5px;
  --el-text-color-placeholder: #637486;
  --el-text-color-regular: #18324a;
  --el-component-size: 34px;
  border: 1px solid #dfe5ea;
  border-radius: 8px;
  background: #fff;
}
.visit-ledger.supply-page > .visit-filters.filter-card :deep(.el-card__body) {
  padding: 14px 19px;
}
.visit-filters :deep(.order-register-filter__fields) {
  column-gap: clamp(13px, 1.3vw, 20px);
}
.visit-filters .filter-label {
  font-size: 13px;
  font-weight: 550;
  white-space: nowrap;
}
.visit-filters :deep(.el-input__wrapper),
.visit-filters :deep(.el-select__wrapper) {
  min-height: 34px;
  border-radius: 5px;
}
.visit-filters :deep(.el-range-editor) {
  height: 34px;
}
.visit-filters :deep(.el-select__placeholder.is-transparent) {
  color: var(--el-text-color-placeholder);
}
.visit-filters :deep(.el-select__prefix) {
  color: #637486;
}
.visit-filters .list-filter-field--person :deep(.el-select__wrapper) {
  padding-inline: 8px;
  gap: 4px;
}
.visit-person {
  font-weight: 500;
}
.ledger-panel-header {
  min-height: 48px;
  padding: 8px 14px;
}
.ledger-result-count {
  font-variant-numeric: tabular-nums;
}
.ledger-panel-header h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--app-font-size-lg, 16px);
}
.visit-table {
  min-width: 1360px;
  table-layout: fixed;
  color: #18324a;
  font-family: var(--visit-font);
  font-size: 14px;
  font-synthesis: none;
  font-variant-numeric: tabular-nums;
}
.visit-ledger .field-table-wrap {
  container-type: inline-size;
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.date-col {
  width: clamp(116px, 6cqw, 144px);
}
.date-cell {
  white-space: nowrap;
}
.region-col {
  width: clamp(128px, 7cqw, 176px);
}
.person-col {
  width: clamp(80px, 4.4cqw, 108px);
}
.department-col {
  width: clamp(84px, 5cqw, 124px);
}
.clock-col {
  width: clamp(59px, 3.5cqw, 82px);
}
.type-col {
  width: clamp(56px, 3cqw, 72px);
}
.count-col {
  width: clamp(72px, 4cqw, 96px);
}
.dwell-col {
  width: clamp(86px, 4cqw, 100px);
}
.outcome-col {
  width: clamp(90px, 6cqw, 148px);
}
.visit-outcome {
  display: inline-flex;
  padding: 1px 7px;
  border-radius: 4px;
  background: #edf0f3;
  color: #5d6770;
  font-size: 12px;
  line-height: 19px;
  font-weight: 550;
  white-space: nowrap;
}
.visit-outcome.contacted {
  color: #2e60aa;
  background: #eaf1ff;
}
.visit-audio-col {
  width: clamp(116px, 8.6cqw, 214px);
}
.photo-col {
  width: clamp(94px, 6cqw, 140px);
}
.assessment-col {
  width: clamp(122px, calc(11cqw - 16px), 272px);
}
.action-col {
  width: clamp(72px, 4cqw, 96px);
}
.visit-sort {
  display: inline-flex;
  align-items: center;
  min-height: 26px;
  gap: 5px;
  padding: 0;
  border: 0;
  background: transparent;
  font: inherit;
  color: inherit;
  cursor: pointer;
}
.visit-sort:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}
.sort-carets {
  display: inline-grid;
  gap: 2px;
  color: var(--el-text-color-placeholder);
}
.sort-carets::before,
.sort-carets::after {
  content: '';
  border-inline: 5px solid transparent;
}
.sort-carets::before {
  border-bottom: 5px solid currentColor;
}
.sort-carets::after {
  border-top: 5px solid currentColor;
}
th[aria-sort='ascending'] .sort-carets::before,
th[aria-sort='descending'] .sort-carets::after {
  color: var(--el-color-primary);
}
.visit-table th,
.visit-table td {
  padding: 11px 13px;
  border-top-color: #e6ebef;
  line-height: 1.5;
}
.visit-table tr > :first-child {
  padding-left: 20px;
}
.visit-table thead th {
  height: 44px;
  padding-block: 8px;
  border-top-color: var(--field-line);
  border-bottom: 1px solid var(--field-line);
  background: #f5f7fa;
  color: #566a7d;
  font-size: 13px;
  font-weight: 600;
}
.visit-table td,
.visit-table tbody th {
  text-align: left;
}
.visit-table tbody tr:first-child > * {
  border-top: 0;
}
.visit-table .field-status {
  gap: 6px;
  padding: 3px 8px;
  border-radius: 4px;
  background: #f0f2f4;
  color: #586572;
  font-size: 12px;
  font-weight: 550;
  line-height: 18px;
}
.visit-table .field-status::before {
  width: 5px;
  height: 5px;
}
.visit-table [data-status='VALID'] {
  background: #e8f4ee;
  color: #267355;
}
.visit-table [data-status='PENDING'] {
  background: #fff3dc;
  color: #88520d;
}
.visit-table [data-status='INVALID'] {
  background: #fbecee;
  color: #a13545;
}
.visit-table [data-status='IN_PROGRESS'] {
  background: #eaf1ff;
  color: #285caf;
}
.visit-table .clipped-cell {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.visit-table .storefront-cell {
  padding-block: 5px;
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
.visit-table .arrival-heading {
  padding-inline: 0 13px;
  text-align: right;
}
.visit-table .arrival-time {
  padding-inline: 0 4px;
  text-align: right;
  white-space: nowrap;
}
.visit-table .departure-heading,
.visit-table .departure-time {
  padding-left: 0;
  white-space: nowrap;
}
.visit-table .field-link {
  padding: 0;
  color: #235bd5;
  font: inherit;
  font-weight: 550;
}
.map-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
