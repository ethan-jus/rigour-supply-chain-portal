<template>
  <section class="customer-followup">
    <header class="followup-header">
      <div class="followup-heading">
        <SupplyPageTitle>客户跟进</SupplyPageTitle>
        <span>{{ sectionName }}</span>
      </div>
      <div class="followup-filters" aria-label="客户跟进筛选">
        <label>
          <span>月份</span>
          <span class="list-filter-field list-filter-field--select">
            <el-date-picker
              v-model="month"
              type="month"
              format="YYYY 年 M 月"
              value-format="YYYY-MM"
              aria-label="月份"
              :clearable="false"
              :disabled-date="afterCurrentMonth"
            />
          </span>
        </label>
        <label>
          <span>员工</span>
          <span class="list-filter-field list-filter-field--person">
            <el-select
              v-model="employee"
              placeholder="全部员工"
              aria-label="员工"
              filterable
              clearable
            >
              <el-option value="" label="全部员工" />
              <el-option
                v-for="owner in owners"
                :key="owner.value"
                :label="owner.label"
                :value="owner.value"
              />
            </el-select>
          </span>
        </label>
      </div>
    </header>

    <dl class="followup-panel followup-metrics" :aria-busy="busy">
      <div v-for="metric in summary" :key="metric.label">
        <dt>{{ metric.label }}</dt>
        <dd>
          {{ metric.value ?? '—' }}<span v-if="metric.value != null">{{ metric.unit }}</span>
        </dd>
        <small>{{ metric.note }}</small>
      </div>
    </dl>

    <section class="followup-panel followup-worklist">
      <h2>门店工作清单</h2>
      <div class="followup-tabs" role="group" aria-label="门店工作清单视图">
        <button type="button" :aria-pressed="tab === 'progress'" @click="tab = 'progress'">
          门店进展
        </button>
        <button type="button" :aria-pressed="tab === 'tasks'" @click="showTasks()">跟进任务</button>
      </div>

      <template v-if="tab === 'progress'">
        <div class="followup-controls">
          <label>
            <span>跟进依据</span>
            <span class="list-filter-field list-filter-field--select">
              <el-select v-model="reason" aria-label="跟进依据">
                <el-option value="ALL" label="全部" />
                <el-option
                  v-for="item in reasons"
                  :key="item.code"
                  :value="item.code"
                  :label="item.label"
                />
              </el-select>
            </span>
          </label>
          <button type="button" class="overview-link" :disabled="busy" @click="load">刷新</button>
        </div>
        <p v-if="problem" class="followup-error" role="alert">{{ problem }}</p>
        <div class="overview-table followup-table" :aria-busy="busy">
          <table>
            <thead>
              <tr>
                <th scope="col">门店</th>
                <th scope="col">跟进依据</th>
                <th scope="col">主责</th>
                <th scope="col">下一步</th>
                <th scope="col" aria-label="操作"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in visibleRows" :key="row.key">
                <td>
                  <strong>{{ row.name }}</strong
                  ><small>{{ row.city || '—' }}</small>
                </td>
                <td>
                  <strong>{{ reasonLabel[row.reason] }}</strong
                  ><small>{{ row.evidence }}</small>
                </td>
                <td>
                  <span v-if="row.ownerName" class="followup-owner">
                    <span class="followup-initial" aria-hidden="true">{{
                      row.ownerName.slice(-1)
                    }}</span>
                    <span>{{ row.ownerName }}</span>
                  </span>
                  <span v-else class="followup-muted">主责待核</span>
                </td>
                <td>
                  <span
                    class="followup-state"
                    :class="{ 'is-verification': row.reason === 'VERIFICATION' }"
                  >
                    {{ nextStep(row) }}
                  </span>
                </td>
                <td>
                  <router-link
                    v-if="row.reason === 'VERIFICATION' && row.storeId && canOpenCrm"
                    class="overview-link"
                    :to="storeLink(row.storeId)"
                    >核对关联</router-link
                  >
                  <button
                    v-else-if="taskByRow[row.key]"
                    type="button"
                    class="overview-link"
                    @click="showTasks(taskByRow[row.key])"
                  >
                    查看任务
                  </button>
                  <button
                    v-else
                    type="button"
                    class="overview-link"
                    :aria-label="'查看 ' + row.name"
                    @click="inspect(row)"
                  >
                    {{ row.reason === 'VERIFICATION' ? '核对关联' : '查看' }}
                  </button>
                </td>
              </tr>
              <tr v-if="!visibleRows.length">
                <td colspan="5" class="followup-empty" role="status">
                  {{
                    busy
                      ? '正在读取门店进展'
                      : !canReadCrm && !canReadRestock
                        ? '当前账号暂无门店进展读取权限'
                        : problem
                          ? '当前范围暂无可展示的结果'
                          : '当前范围暂无对应的门店线索'
                  }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <ListTableFooter v-if="filteredRows.length > pageSize">
          <CompactPagination
            v-model:current-page="page"
            :page-size="pageSize"
            :page-sizes="[pageSize]"
            :total="filteredRows.length"
          />
        </ListTableFooter>
      </template>

      <BiOperationsWorkbench
        v-else
        kind="CUSTOMER"
        :owner-staff-code="employee"
        :sales-owners="owners"
        :regions="regions"
        :action-seed="taskSeed"
        :action-to-open="openedTask"
        show-task-number
        @changed="taskChanged"
      />
    </section>

    <p class="followup-hint">
      <el-icon aria-hidden="true"><InfoFilled /></el-icon>
      <span>App 的跟进结果按任务编号回到这里。门店归属、订货账号关联在 CRM 门店资料核对。</span>
    </p>
    <details class="followup-method">
      <summary>口径说明</summary>
      <p>
        门店线索按所选月份截至日判断。待复购使用已确认的历史订单与 CRM
        生效周期，首单证据不足的门店进入待核。补货承诺取 App 在所选月份登记、目前待跟进的记录。
      </p>
      <p>
        门店汇总按 CRM
        门店编号去重。员工按门店主责筛选，补货承诺按登记人筛选。跟进任务显示当前进度和办理期限。
      </p>
    </details>

    <el-drawer
      :model-value="!!selected"
      :title="selected?.name || '跟进依据'"
      size="min(510px, 100vw)"
      destroy-on-close
      @close="closeDetails"
    >
      <div v-if="selected" class="followup-detail">
        <h2>{{ reasonLabel[selected.reason] }}</h2>
        <p>{{ selected.evidence }}</p>
        <dl>
          <div>
            <dt>城市</dt>
            <dd>{{ selected.city || '—' }}</dd>
          </div>
          <div>
            <dt>主责</dt>
            <dd>{{ selected.ownerName || '待核' }}</dd>
          </div>
        </dl>
        <p v-if="detailBusy" role="status">正在核对原单与跟进任务</p>
        <p v-if="detailError" class="followup-error" role="alert">{{ detailError }}</p>
        <div class="followup-detail-actions">
          <router-link
            v-if="selected.storeId && canOpenCrm"
            class="overview-link"
            :to="storeLink(selected.storeId)"
          >
            查看门店资料
          </router-link>
          <router-link
            v-if="selected.commitment && canOpenVisits"
            class="overview-link"
            :to="visitLink(selected.commitment)"
          >
            查看原拜访
          </router-link>
          <router-link
            v-if="orderNo && canOpenOrders"
            class="overview-link"
            :to="{ name: 'SupplyOrderSalesOrders', query: { orderNo } }"
          >
            查看原订单
          </router-link>
          <button
            v-if="taskByRow[selected.key]"
            type="button"
            class="overview-link"
            @click="showTasks(taskByRow[selected.key])"
          >
            查看任务
          </button>
          <button
            v-else-if="draftTask && canAssign"
            type="button"
            class="overview-link"
            @click="startTask"
          >
            发起跟进
          </button>
        </div>
      </div>
    </el-drawer>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { InfoFilled } from '@element-plus/icons-vue'
import { useRoute } from 'vue-router'
import { getSupplyDashboardFilterOptions } from '@/api/core/bi'
import { getBiActions, type BiAction, type BiActionSeed } from '@/api/core/bi-operations'
import { getSalesOrder } from '@/api/core/order-sales'
import {
  getRestockCommitments,
  getStoreFollowupEvidence,
  type FollowupPeriod,
  type FollowupReason,
  type RestockCommitment,
  type StoreFollowupEvidence,
} from '@/api/core/sales-customer-followups'
import CompactPagination from '@/components/supply/CompactPagination.vue'
import ListTableFooter from '@/components/supply/ListTableFooter.vue'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import { useAuthStore } from '@/stores/auth'
import { useNavigationStore } from '@/stores/navigation'
import {
  businessDate,
  businessMonth,
  businessMonthRange,
  businessPeriodDays,
} from '@/utils/business-date'
import BiOperationsWorkbench from '../bi/components/BiOperationsWorkbench.vue'

interface FollowupRow {
  key: string
  storeId: string | null
  name: string
  city: string | null
  ownerName: string | null
  reason: FollowupReason
  evidence: string
  orderId?: string | null
  commitment?: RestockCommitment
}

const reasonLabel: Record<FollowupReason, string> = {
  VISITED_NO_ORDER: '已访未首单',
  REORDER: '待复购',
  RESTOCK: '补货承诺',
  VERIFICATION: '关联待核',
}
const reasons = (Object.keys(reasonLabel) as FollowupReason[]).map((code) => ({
  code,
  label: reasonLabel[code],
}))
const pageSize = 20
const batchSize = 100
const openStatuses = ['OPEN', 'IN_PROGRESS'] as const
const route = useRoute()
const auth = useAuthStore()
const nav = useNavigationStore()
const allows = (path: string) => nav.hasPath('SUPPLY_CHAIN', path)
const crmPath = '/supply-chain/crm/stores/mine'
const sectionName = computed(
  () =>
    nav
      .getNavigation('SUPPLY_CHAIN')
      .find((module) => module.code === 'SUPPLY_CHAIN.MENU.SALES')
      ?.children.find((group) =>
        group.children.some((item) => item.routePath === '/supply-chain/sales/customer-followups'),
      )?.displayName || '团队经营',
)
const canReadTeam = computed(() => auth.hasPermission('crm:pool:team-read'))
const canReadCrm = computed(() => canReadTeam.value || auth.hasPermission('crm:pool:private-read'))
const canReadRestock = computed(() => auth.hasPermission('sales:dashboard:read'))
const canOpenCrm = computed(() => canReadCrm.value && allows(crmPath))
const canOpenVisits = computed(() => allows('/supply-chain/sales/visits/records'))
const canOpenOrders = computed(() => allows('/supply-chain/order/sales-orders'))
const canAssign = computed(() => auth.hasPermission('analytics:operations:write'))
const currentMonth = businessMonth(new Date())
const today = businessDate(new Date())
const month = ref(currentMonth)
const employee = ref('')
const reason = ref<FollowupReason | 'ALL'>('ALL')
const tab = ref<'progress' | 'tasks'>('progress')
const page = ref(1)
const owners = ref<{ value: string; label: string }[]>([])
const regions = ref<{ value: string; label: string }[]>([])
const ownerNames = computed(() => new Map(owners.value.map((item) => [item.value, item.label])))
const authScope = () => [auth.user?.tenantId, auth.user?.id, auth.user?.permissions]
const afterCurrentMonth = (date: Date) =>
  date.getFullYear() > Number(currentMonth.slice(0, 4)) ||
  (date.getFullYear() === Number(currentMonth.slice(0, 4)) &&
    date.getMonth() + 1 > Number(currentMonth.slice(5)))
const period = computed<FollowupPeriod>(() => {
  const [from, end] = businessMonthRange(month.value || currentMonth)
  return { from, through: end > today ? today : end, ownerCode: employee.value || undefined }
})

watch(
  () => [route.query.month, route.query.ownerStaffCode],
  ([linkedMonth, owner]) => {
    month.value =
      typeof linkedMonth === 'string' &&
      /^\d{4}-(0[1-9]|1[0-2])$/.test(linkedMonth) &&
      linkedMonth <= currentMonth
        ? linkedMonth
        : currentMonth
    employee.value = typeof owner === 'string' ? owner : ''
  },
  { immediate: true },
)
watch(
  authScope,
  async (_value, _previous, onCleanup) => {
    let stale = false
    onCleanup(() => {
      stale = true
    })
    owners.value = []
    regions.value = []
    try {
      const data = await getSupplyDashboardFilterOptions()
      if (stale) return
      const options = (values: typeof data.salesOwners) =>
        values.map((option) => ({ value: option.optionValue, label: option.optionLabel }))
      owners.value = options(data.salesOwners)
      regions.value = options(data.regions)
    } catch {
      if (!stale) owners.value = []
    }
  },
  { immediate: true, deep: true },
)

const crm = ref<StoreFollowupEvidence[]>([])
const restock = ref<RestockCommitment[]>([])
const busy = ref(true)
const problem = ref('')
const crmReady = ref(false)
const restockReady = ref(false)
const openCount = ref<number | null>(null)
let active: AbortController | undefined

async function readCrm(query: FollowupPeriod, signal: AbortSignal) {
  const items: StoreFollowupEvidence[] = []
  let cursor: string | undefined
  const view = canReadTeam.value ? 'TEAM' : 'MINE'
  do {
    const response = await getStoreFollowupEvidence(
      { ...query, view, cursor, size: batchSize },
      signal,
    )
    items.push(...response.items)
    cursor = response.nextCursor || undefined
  } while (cursor && !signal.aborted)
  return items
}
async function readRestock(query: FollowupPeriod, signal: AbortSignal) {
  const items = new Map<string, RestockCommitment>()
  for (let pageNumber = 1; !signal.aborted; pageNumber++) {
    const response = await getRestockCommitments(
      { ...query, page: pageNumber, size: batchSize },
      signal,
    )
    for (const row of response.slice(0, batchSize)) items.set(row.id, row)
    if (response.length <= batchSize) break
  }
  return [...items.values()]
}
async function readOpenCount(owner: string | undefined, signal: AbortSignal) {
  const pages = await Promise.all(
    openStatuses.map((status) =>
      getBiActions({ kind: 'CUSTOMER', status, employeeCode: owner, pageSize: 1 }, signal),
    ),
  )
  return pages.reduce((count, result) => count + result.total, 0)
}

async function load() {
  active?.abort()
  const request = new AbortController()
  active = request
  const query = period.value
  closeDetails()
  taskByRow.value = {}
  openedTask.value = null
  taskSeed.value = null
  busy.value = true
  page.value = 1
  problem.value = ''
  crm.value = []
  restock.value = []
  crmReady.value = false
  restockReady.value = false
  openCount.value = null
  const needsCrm = canReadCrm.value
  const needsRestock = canReadRestock.value
  const [stores, commitments, tasks] = await Promise.allSettled([
    needsCrm ? readCrm(query, request.signal) : Promise.resolve([]),
    needsRestock ? readRestock(query, request.signal) : Promise.resolve([]),
    readOpenCount(query.ownerCode, request.signal),
  ])
  if (request.signal.aborted) return
  crmReady.value = stores.status === 'fulfilled'
  restockReady.value = commitments.status === 'fulfilled'
  if (stores.status === 'fulfilled') crm.value = stores.value
  if (commitments.status === 'fulfilled') restock.value = commitments.value
  if (tasks.status === 'fulfilled') openCount.value = tasks.value
  const unavailable = [
    stores.status === 'rejected' ? '门店进展' : '',
    commitments.status === 'rejected' ? '补货承诺' : '',
    tasks.status === 'rejected' ? '开放跟进' : '',
  ].filter(Boolean)
  problem.value = unavailable.length ? unavailable.join('、') + '暂不可用，可刷新重试。' : ''
  busy.value = false
}

const rows = computed<FollowupRow[]>(() => {
  const stores = crm.value.map((row): FollowupRow => {
    const note =
      row.reason === 'REORDER' && row.lastOrderAt
        ? '上次下单 ' +
          businessDate(row.lastOrderAt).slice(5) +
          '，截至本期已隔 ' +
          (businessPeriodDays(businessDate(row.lastOrderAt), period.value.through) - 1) +
          ' 天'
        : row.reason === 'VISITED_NO_ORDER'
          ? '有效到店，已核实订货历史，当前尚无首单'
          : '已有效到店，订货关联或历史仍待核对'
    const visit = row.lastVisitAt ? ' · 到店 ' + businessDate(row.lastVisitAt).slice(5) : ''
    return {
      key: 'store-' + row.storeId,
      storeId: row.storeId,
      name: row.name,
      city: row.city,
      ownerName: row.ownerName || ownerNames.value.get(row.ownerCode || '') || null,
      reason: row.reason,
      evidence: note + (row.reason === 'REORDER' ? '' : visit),
      orderId: row.orderId,
    }
  })
  const commitments = restock.value.map((row): FollowupRow => ({
    key: 'restock-' + row.id,
    storeId: row.storeId,
    name: row.store || '门店待核',
    city: row.city,
    ownerName: ownerNames.value.get(row.employee || '') || row.salesperson || null,
    reason: row.storeId ? 'RESTOCK' : 'VERIFICATION',
    evidence: row.storeId
      ? 'App 已登记补货意向，约 ' + row.due.slice(5) + ' 跟进'
      : 'App 已登记补货意向，门店编号待核',
    commitment: row,
  }))
  return [...stores, ...commitments].sort(
    (a, b) =>
      reasons.findIndex((item) => item.code === a.reason) -
      reasons.findIndex((item) => item.code === b.reason),
  )
})
const filteredRows = computed(() =>
  rows.value.filter((row) => reason.value === 'ALL' || row.reason === reason.value),
)
const visibleRows = computed(() =>
  filteredRows.value.slice((page.value - 1) * pageSize, page.value * pageSize),
)
const summary = computed(() => {
  const count = (needsVerification: boolean) =>
    new Set(
      rows.value
        .filter((row) => row.storeId && (row.reason === 'VERIFICATION') === needsVerification)
        .map((row) => row.storeId),
    ).size
  const evidenceReady =
    !busy.value &&
    (canReadCrm.value || canReadRestock.value) &&
    crmReady.value &&
    restockReady.value
  return [
    {
      label: '有跟进依据的门店',
      value: evidenceReady ? count(false) : null,
      unit: '家',
      note: '按门店去重',
    },
    { label: '开放跟进', value: openCount.value, unit: '项', note: '与 App 共用任务' },
    { label: '关联待核', value: evidenceReady ? count(true) : null, unit: '家', note: '单列核查' },
  ]
})

const selected = ref<FollowupRow | null>(null)
const taskByRow = ref<Record<string, BiAction>>({})
const openedTask = ref<BiAction | null>(null)
const taskSeed = ref<BiActionSeed | null>(null)
const draftTask = ref<BiActionSeed | null>(null)
const orderNo = ref('')
const detailBusy = ref(false)
const detailError = ref('')
let detailRequest: AbortController | undefined
function closeDetails() {
  detailRequest?.abort()
  selected.value = null
  draftTask.value = null
  orderNo.value = ''
  detailBusy.value = false
  detailError.value = ''
}
function showTasks(task?: BiAction) {
  closeDetails()
  taskSeed.value = null
  openedTask.value = task || null
  tab.value = 'tasks'
}
function startTask() {
  taskSeed.value = draftTask.value
  openedTask.value = null
  closeDetails()
  tab.value = 'tasks'
}
function nextStep(row: FollowupRow) {
  if (row.reason === 'VERIFICATION') return '待核'
  const task = taskByRow.value[row.key]
  if (task) return task.status === 'IN_PROGRESS' ? '办理中' : '待办理'
  return '待跟进'
}
function storeLink(id: string) {
  return { path: crmPath, query: { storeId: id, team: canReadTeam.value ? '1' : undefined } }
}
function visitLink(row: RestockCommitment) {
  return {
    name: 'SupplySalesVisitsRecords',
    query: { from: row.visitDate, to: row.visitDate, person: row.profileId, visitId: row.visitId },
  }
}
async function inspect(row: FollowupRow) {
  closeDetails()
  selected.value = row
  if (!row.orderId || !canOpenOrders.value) return
  const request = new AbortController()
  detailRequest = request
  detailBusy.value = true
  try {
    const order = await getSalesOrder(row.orderId)
    if (request.signal.aborted) return
    orderNo.value = order.orderNo
    if (!order.customerId) return
    const businessRef = 'customer-id:' + order.customerId
    const matches = await Promise.all(
      openStatuses.map((status) =>
        getBiActions({ kind: 'CUSTOMER', businessRef, status, pageSize: 1 }, request.signal),
      ),
    )
    if (request.signal.aborted) return
    const task = matches.flatMap((result) => result.items)[0]
    if (task) taskByRow.value = { ...taskByRow.value, [row.key]: task }
    else
      draftTask.value = {
        kind: 'CUSTOMER',
        businessRef,
        businessLabel: row.name,
        note: row.evidence,
      }
  } catch {
    if (!request.signal.aborted) detailError.value = '暂无法核对原订单或已有任务。'
  } finally {
    if (!request.signal.aborted) detailBusy.value = false
  }
}
function taskChanged() {
  openedTask.value = null
  taskSeed.value = null
  void load()
}
watch(reason, () => {
  page.value = 1
})
watch([period, canReadCrm, canReadRestock, authScope], load, { immediate: true, deep: true })
onBeforeUnmount(() => {
  active?.abort()
  detailRequest?.abort()
})
</script>

<style scoped lang="scss" src="./sales-overview-table.scss"></style>
<style scoped lang="scss" src="./sales-customer-followup.scss"></style>
