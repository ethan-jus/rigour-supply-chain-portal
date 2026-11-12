<template>
  <div class="transport-page">
    <OrderRegisterFilterCard
      class="order-register-filter--compact"
      :loading="loading"
      @search="search"
      @reset="reset"
    >
      <template #primary>
        <div class="list-filter-field list-filter-field--text">
          <el-input
            v-model="filters.documentNo"
            clearable
            placeholder="费用单号"
            aria-label="费用单号"
          />
        </div>
        <div class="list-filter-field list-filter-field--text">
          <el-input
            v-model="filters.platformOrderNo"
            clearable
            placeholder="快递单号"
            aria-label="快递单号"
          />
        </div>
        <div class="list-filter-field list-filter-field--select">
          <el-select
            v-model="filters.carrierCode"
            clearable
            placeholder="物流公司"
            aria-label="物流公司"
            ><el-option
              v-for="o in costOptions('COST_CARRIER')"
              :key="o.value"
              :label="o.label"
              :value="o.value"
          /></el-select>
        </div>
        <div class="list-filter-field list-filter-field--select">
          <el-select
            v-model="filters.typeCode"
            clearable
            placeholder="运输类型"
            aria-label="运输类型"
            ><el-option
              v-for="t in transportTypes"
              :key="t.value"
              :label="t.label"
              :value="t.value"
          /></el-select>
        </div>
        <div class="list-filter-field list-filter-field--date-range">
          <el-date-picker
            v-model="dates"
            type="daterange"
            start-placeholder="运输开始日期"
            end-placeholder="结束日期"
            range-separator="至"
            value-format="YYYY-MM-DD"
            aria-label="运输日期"
          />
        </div>
        <div class="list-filter-field list-filter-field--select">
          <el-select
            v-model="filters.statusCode"
            clearable
            placeholder="单据状态"
            aria-label="单据状态"
            ><el-option label="待确认" value="DRAFT" /><el-option
              label="已确认"
              value="CONFIRMED" /><el-option label="已作废" value="VOID"
          /></el-select>
        </div>
        <div class="list-filter-field list-filter-field--select">
          <el-select
            v-model="filters.sourceSystem"
            clearable
            placeholder="数据来源"
            aria-label="数据来源"
            ><el-option label="货拉拉同步" value="HUOLALA" /><el-option
              label="手动录入"
              value="MANUAL_ENTRY"
          /></el-select>
        </div>
        <div class="list-filter-field list-filter-field--select">
          <el-select
            v-model="filters.relationState"
            clearable
            placeholder="订单关联状态"
            aria-label="订单关联状态"
            ><el-option label="已关联" value="LINKED" /><el-option label="未关联" value="UNLINKED"
          /></el-select>
        </div>
        <div class="list-filter-field list-filter-field--text">
          <el-input
            v-model="filters.sourceDocumentNo"
            clearable
            placeholder="业务订单号"
            aria-label="业务订单号"
          />
        </div>
        <div class="list-filter-field list-filter-field--person">
          <el-input
            v-model="filters.sourceEmployeeName"
            clearable
            placeholder="业务员"
            aria-label="业务员"
          />
        </div>
        <div class="list-filter-field list-filter-field--select">
          <el-input
            v-model="filters.sourceDepartmentName"
            clearable
            placeholder="部门"
            aria-label="部门"
          />
        </div>
        <div class="list-filter-field list-filter-field--text">
          <el-input
            v-model="filters.receiverName"
            clearable
            placeholder="收货方"
            aria-label="收货方"
          />
        </div>
        <div class="list-filter-field list-filter-field--person">
          <el-input
            v-model="filters.platformEmployeeName"
            clearable
            placeholder="货拉拉下单员工"
            aria-label="货拉拉下单员工"
          />
        </div>
        <div class="list-filter-field list-filter-field--select">
          <el-select
            v-model="filters.employeeRelationState"
            clearable
            placeholder="员工关联状态"
            aria-label="员工关联状态"
            ><el-option label="已关联" value="LINKED" /><el-option label="未关联" value="UNLINKED"
          /></el-select>
        </div>
        <div class="list-filter-field list-filter-field--person">
          <el-select
            v-model="filters.mappedEmployeeCode"
            clearable
            filterable
            placeholder="本系统关联员工"
            aria-label="本系统关联员工"
            ><el-option
              v-for="employee in importEmployees"
              :key="employee.employeeCode"
              :label="employee.employeeName"
              :value="employee.employeeCode"
          /></el-select>
        </div>
        <div class="list-filter-field list-filter-field--text">
          <el-input
            v-model="filters.contactPhone"
            clearable
            placeholder="联系电话"
            aria-label="联系电话"
          />
        </div>
      </template>
    </OrderRegisterFilterCard>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <section class="transport-list">
      <div class="list-heading">
        <div>
          <strong>物流运输记录</strong><el-tag round type="info">{{ result.page.total }} 条</el-tag
          ><span v-if="selected.length" class="selection">已选 {{ selected.length }} 条</span>
        </div>
        <div class="list-toolbar">
          <el-button v-if="can('integration:huolala:sync')" @click="openSync"
            >同步货拉拉订单</el-button
          ><el-button v-if="can('order:logistics-cost:write')" type="primary" @click="create"
            >新增运输记录</el-button
          >
        </div>
      </div>
      <el-table
        ref="table"
        v-loading="loading"
        :data="result.page.items"
        row-key="id"
        border
        max-height="650"
        empty-text="暂无运输记录"
        @selection-change="selectionChanged"
      >
        <el-table-column type="selection" width="40" :reserve-selection="true" fixed="left" />
        <el-table-column label="费用单号" min-width="190" fixed="left"
          ><template #default="{ row }"
            ><el-button
              link
              type="primary"
              class="document-link"
              :title="row.documentNo"
              @click="view(row as CostRecord)"
              >{{ row.documentNo }}</el-button
            ></template
          ></el-table-column
        >
        <el-table-column
          v-for="col in displayed"
          :key="col.key"
          :label="col.label"
          :min-width="col.width"
          :align="col.key === 'stopCount' ? 'center' : col.numeric ? 'right' : 'left'"
          :show-overflow-tooltip="!['route', 'orders'].includes(col.key)"
        >
          <template #default="{ row }"
            ><TransportRouteSummary
              v-if="col.key === 'route'"
              :route="routeOf(row as CostRecord, platformOf(row as CostRecord))"
            /><template v-else-if="col.key === 'orders'"
              ><div
                v-for="(text, i) in lines(row as CostRecord, col.key)"
                :key="i"
                class="table-line"
              >
                {{ text }}
              </div></template
            ><el-tag
              v-else-if="col.key === 'status'"
              :type="
                row.statusCode === 'CONFIRMED'
                  ? 'success'
                  : row.statusCode === 'VOID'
                    ? 'info'
                    : 'warning'
              "
              >{{ statusName(row.statusCode) }}</el-tag
            ><span v-else :class="{ 'money-cell': col.numeric }">{{
              value(row as CostRecord, col.key)
            }}</span></template
          >
        </el-table-column>
        <el-table-column label="操作" fixed="right" width="140"
          ><template #default="{ row }"
            ><TransportRecordActions
              :record="row as CostRecord"
              @view="view(row as CostRecord)"
              @edit="edit(row as CostRecord)"
              @action="(action) => act(row as CostRecord, action)" /></template
        ></el-table-column>
      </el-table>
      <ListTableFooter>
        <template #actions>
          <el-button v-if="can('integration:huolala:read')" @click="connection('employees')"
            >员工关联</el-button
          ><el-button v-if="can('integration:huolala:read')" @click="connection('runs')"
            >同步记录</el-button
          ><TableColumnSettings
            label="显示列"
            :columns="columnOptions"
            :visibility="visibility"
            size="default"
            @change="(k, v) => (visibility[k] = v)"
            @reset="resetColumns"
          /><el-button
            v-if="can('order:logistics-cost:export')"
            :disabled="loading || !result.page.total"
            @click="openExport"
            >自定义导出</el-button
          ><el-dropdown
            ><el-button
              >其他操作<el-icon><ArrowDown /></el-icon></el-button
            ><template #dropdown
              ><el-dropdown-menu
                ><el-dropdown-item
                  v-if="can('integration:huolala:read')"
                  @click="connection('connection')"
                  >货拉拉连接</el-dropdown-item
                ><el-dropdown-item
                  v-if="can('order:logistics-cost:manage-imports')"
                  @click="openImport()"
                  >历史报表补录</el-dropdown-item
                ></el-dropdown-menu
              ></template
            ></el-dropdown
          >
        </template>
        <CompactPagination
          :current-page="page"
          :page-size="step"
          :total="result.page.total"
          @current-change="changePage"
          @size-change="changeSize"
      /></ListTableFooter>
    </section>
    <TransportRecordEditor
      v-if="editorOpen"
      :key="editorKey"
      v-model="editorOpen"
      :detail="active"
      :readonly="readonly"
      @saved="load"
      @edit="(section) => open(active!.record, false, section)"
      @action="(action) => act(active!.record, action)"
      @associate-employee="associateEmployee"
      @sync="syncOne"
      :initial-section="initialSection"
    />
    <CostExportDialog
      v-model="exportOpen"
      v-model:fields="exportFields"
      :columns="exportColumns"
      :scope="
        exportIds.length
          ? `已选 ${exportIds.length} 条运输记录`
          : `全部筛选结果（${exportCount} 条）`
      "
      :busy="exporting"
      :error="exportError"
      @confirm="doExport"
    />
    <el-dialog v-model="syncOpen" title="同步货拉拉订单" width="520px" :close-on-click-modal="false"
      ><el-form label-position="top"
        ><el-form-item label="运输日期"
          ><el-date-picker
            v-model="syncDates"
            :disabled="syncing"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始日期"
            end-placeholder="结束日期" /></el-form-item
        ><el-form-item label="指定货拉拉订单号"
          ><el-input
            v-model="syncNo"
            :disabled="syncing"
            placeholder="可选，填写后只同步此单" /></el-form-item></el-form
      ><el-alert v-if="syncMessage" :title="syncMessage" type="info" :closable="false" /><template
        #footer
        ><el-button @click="syncOpen = false">关闭</el-button
        ><el-button type="primary" :loading="syncing" @click="sync">开始同步</el-button></template
      ></el-dialog
    >
    <el-dialog v-model="importOpen" title="历史货拉拉报表补录" width="min(1200px, 95vw)"
      ><CostCarrierOrdersPanel
        v-if="importOpen"
        :cities="importCities"
        :employees="importEmployees"
        :references-ready="importReady"
        @generated="load"
        @open-cost="generated"
    /></el-dialog>
  </div>
</template>
<script setup lang="ts">
import {
  computed,
  onMounted,
  onBeforeUnmount,
  onActivated,
  onDeactivated,
  reactive,
  ref,
} from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox, type TableInstance } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import ListTableFooter from '@/components/supply/ListTableFooter.vue'
import OrderRegisterFilterCard from '@/components/supply/OrderRegisterFilterCard.vue'
import CompactPagination from '@/components/supply/CompactPagination.vue'
import TableColumnSettings from '@/components/supply/TableColumnSettings.vue'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import {
  changeCostStatus,
  getCostCities,
  getCostEmployees,
  type CostEmployee,
  type CostRecord,
} from '@/api/core/cost'
import {
  getTransportRecords,
  getTransport,
  confirmTransport,
  exportSelectedTransport,
  type TransportDetail,
  type TransportPage,
  type TransportQuery,
} from '@/api/core/transport-records'
import { huolalaApi, type HuolalaRun } from '@/api/core/huolala'
import { errorMessage } from '@/api/core/error'
import { displayRecordActor, displayRecordDateTime } from '@/utils/business-display'
import {
  amountOf,
  money,
  ordersOf,
  receiversOf,
  routeOf,
  routeText,
  vehicleOf,
  statusName,
  transportTypes,
  typeName,
} from './transport-records'
import { currentSource, platformPaymentStatus } from './huolala-source'
import { costLabel, costOptions, loadCostDictionaries } from './cost-dictionaries'
import CostExportDialog from './CostExportDialog.vue'
import TransportRecordEditor from './TransportRecordEditor.vue'
import TransportRecordActions from './TransportRecordActions.vue'
import TransportRouteSummary from './TransportRouteSummary.vue'
import CostCarrierOrdersPanel from './CostCarrierOrdersPanel.vue'
import { exportCostRows } from './cost-export'
import { collectCostExportRows, selectedCostColumns } from './custom-cost-export'
const { can } = useSupplyPermissions(),
  router = useRouter(),
  route = useRoute()
const result = ref<TransportPage>({
  page: { total: 0, begin: 0, step: 20, items: [] },
  platformRecords: {},
})
const filters = ref<Partial<TransportQuery>>({}),
  dates = ref<string[]>([]),
  page = ref(1),
  step = ref(20),
  loading = ref(false),
  error = ref('')
const table = ref<TableInstance>(),
  selected = ref<CostRecord[]>([])
let applied: TransportQuery = { begin: 0, step: 20 },
  serial = 0
const columns = [
  { key: 'platformNo', label: '快递单号', width: 160 },
  { key: 'carrier', label: '物流公司', width: 80 },
  { key: 'vehicle', label: '车型', width: 80 },
  { key: 'orderedAt', label: '下单时间', width: 165 },
  { key: 'route', label: '行驶路段', width: 210 },
  { key: 'stopCount', label: '收货点数', width: 80 },
  { key: 'type', label: '运输类型', width: 120 },
  { key: 'amount', label: '运输费用（元）', width: 120, numeric: true },
  { key: 'status', label: '单据状态', width: 90 },
  { key: 'creator', label: '创建人', width: 80 },
  { key: 'relation', label: '订单关联状态', width: 130, optional: true },
  { key: 'date', label: '运输日期', width: 106, optional: true },
  { key: 'receivers', label: '收货方', width: 150, optional: true },
  { key: 'source', label: '数据来源', width: 96, optional: true },
  { key: 'platformStatus', label: '货拉拉订单状态', width: 155, optional: true },
  { key: 'platformEmployee', label: '货拉拉下单员工', width: 150, optional: true },
  { key: 'mappedEmployee', label: '本系统关联员工', width: 150, optional: true },
  { key: 'employeeRelation', label: '员工关联状态', width: 130, optional: true },
  { key: 'orders', label: '已关联业务单号', width: 220, optional: true },
  { key: 'employee', label: '业务员', width: 130, optional: true },
  { key: 'department', label: '部门', width: 160, optional: true },
  { key: 'billItems', label: '账单费用明细', width: 240, optional: true },
  { key: 'payment', label: '付款状态', width: 100, optional: true },
  { key: 'paid', label: '已支付（元）', width: 145, numeric: true, optional: true },
  { key: 'unpaid', label: '未支付（元）', width: 145, numeric: true, optional: true },
  { key: 'refund', label: '退款（元）', width: 145, numeric: true, optional: true },
  { key: 'synced', label: '最近同步时间', width: 190, optional: true },
]
const columnOptions = columns
  .filter((c) => !c.optional)
  .map((c) => ({ ...c, locked: ['status', 'creator'].includes(c.key) }))
const visibility = reactive<Record<string, boolean>>(
  Object.fromEntries(columns.map((c) => [c.key, !c.optional])),
)
const displayed = computed(() => columns.filter((c) => !c.optional && visibility[c.key]))
function resetColumns() {
  for (const c of columns) visibility[c.key] = !c.optional
}
const platformOf = (r: CostRecord) => result.value.platformRecords[r.id]
function lines(r: CostRecord, key: string) {
  return key === 'receivers'
    ? receiversOf(r, platformOf(r))
    : ordersOf(r, platformOf(r)).length
      ? ordersOf(r, platformOf(r))
      : ['-']
}
function value(r: CostRecord, key: string, sources = result.value.platformRecords): string {
  const platform = sources[r.id],
    source = platform ? currentSource(platform.source) : null
  const vals: Record<string, unknown> = {
    route: routeText(routeOf(r, platform)),
    stopCount: routeOf(r, platform).receivers.length || '-',
    source: platform ? '货拉拉同步' : '手动录入',
    type: typeName(
      platform?.draft?.transportType ||
        r.data.ledger?.transportPurposeCode ||
        r.data.typeCode ||
        r.data.logistics?.legCode,
    ),
    date: source?.useTime.slice(0, 10) || r.data.costDate,
    orderedAt: source?.raw['下单时间']?.trim() || '-',
    platformNo: source?.orderNo || r.data.ledger?.platformOrderNo || '-',
    amount: money(amountOf(r, platform)),
    status: statusName(r.statusCode),
    creator: platform ? '系统同步' : displayRecordActor(r.createdBy),
    carrier: platform
      ? '货拉拉'
      : r.data.ledger?.carrierCode
        ? costLabel('COST_CARRIER', r.data.ledger.carrierCode)
        : r.data.logistics?.carrierName,
    vehicle: vehicleOf(platform),
    platformStatus: source?.status,
    platformEmployee: source?.facts?.sourceEmployeeName,
    mappedEmployee:
      importEmployees.value.find((e) => e.employeeCode === source?.facts?.mappedEmployeeCode)
        ?.employeeName || source?.facts?.mappedEmployeeCode,
    employeeRelation: source ? (source.facts?.mappedEmployeeCode ? '已关联' : '未关联') : '-',
    relation: ordersOf(r, platform).length ? '已关联' : '未关联',
    employee: [
      ...new Set((r.data.ledger?.sources ?? r.sources).map((s) => s.employeeName).filter(Boolean)),
    ].join('、'),
    department: [
      ...new Set(
        (r.data.ledger?.sources ?? r.sources).map((s) => s.departmentName).filter(Boolean),
      ),
    ].join('、'),
    billItems: source
      ? source.facts?.fees.map((item) => `${item.name}：${money(item.amount)}`).join('；')
      : r.data.ledger?.manualBillItems
          ?.map((item) => `${item.name}：${money(item.amount)}`)
          .join('；'),
    payment: source
      ? platformPaymentStatus(source)
      : costLabel('COST_PAYMENT_STATUS', r.data.paymentStatusCode),
    paid: money(source?.paidAmount),
    unpaid: money(source?.facts?.unpaidAmount),
    refund: money(source?.facts?.refundAmount),
    synced: platform?.source.lastSyncedAt
      ? displayRecordDateTime(platform.source.lastSyncedAt)
      : '-',
  }
  return vals[key] == null || vals[key] === '' ? '-' : String(vals[key])
}
function selectionChanged(rows: CostRecord[]) {
  selected.value = rows
}
async function load() {
  const request = ++serial
  loading.value = true
  error.value = ''
  try {
    const data = await getTransportRecords({
      ...applied,
      begin: (page.value - 1) * step.value,
      step: step.value,
    })
    if (request === serial) result.value = data
  } catch (e) {
    if (request === serial) {
      result.value = {
        page: { total: 0, begin: 0, step: step.value, items: [] },
        platformRecords: {},
      }
      error.value = errorMessage(e, '运输记录加载失败')
    }
  } finally {
    if (request === serial) loading.value = false
  }
}
function search() {
  applied = {
    ...filters.value,
    begin: 0,
    step: step.value,
    dateFrom: dates.value?.[0],
    dateTo: dates.value?.[1],
  }
  page.value = 1
  table.value?.clearSelection()
  void load()
}
function reset() {
  filters.value = {}
  dates.value = []
  search()
}
function changePage(n: number) {
  page.value = n
  void load()
}
function changeSize(n: number) {
  step.value = n
  page.value = 1
  void load()
}
const editorOpen = ref(false),
  editorKey = ref(0),
  active = ref<TransportDetail | null>(null),
  readonly = ref(true),
  initialSection = ref('')
function create() {
  active.value = null
  initialSection.value = ''
  readonly.value = false
  editorKey.value++
  editorOpen.value = true
}
async function open(r: CostRecord, mode: boolean, section = '') {
  initialSection.value = section
  try {
    active.value = await getTransport(r.id)
    readonly.value = mode
    editorKey.value++
    editorOpen.value = true
  } catch (e) {
    ElMessage.error(errorMessage(e, '运输记录加载失败'))
  }
}
const view = (r: CostRecord) => open(r, true),
  edit = (r: CostRecord) => open(r, false)
async function act(row: CostRecord, action: 'confirm' | 'revoke' | 'void' | 'delete') {
  try {
    const label = { confirm: '确认', revoke: '撤销', void: '作废', delete: '删除' }[action]
    const hint =
      action === 'confirm'
        ? `确认运输费用 ¥${money(amountOf(row, platformOf(row)))}，并按关联订单计入成本？`
        : `${label}该运输记录，请填写原因。`
    const answer = await ElMessageBox.prompt(hint, `${label}运输记录`, {
      inputType: 'textarea',
      inputPlaceholder: action === 'confirm' ? '确认说明（可选）' : `${label}原因`,
      inputValidator: (v) =>
        ((action === 'confirm' || !!v?.trim()) && (v?.length || 0) <= 500) ||
        '请填写不超过500字的原因',
      confirmButtonText: label,
      cancelButtonText: '取消',
    })
    if (action === 'confirm') await confirmTransport(row, answer.value || '')
    else await changeCostStatus('logistics', row, action, answer.value || '')
    ElMessage.success(`已${label}`)
    table.value?.clearSelection()
    await load()
    if (editorOpen.value && active.value?.record.id === row.id) {
      if (action === 'delete') editorOpen.value = false
      else await open(row, true)
    }
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(errorMessage(e, '操作失败'))
  }
}
function connection(tab: string, staffId?: string) {
  editorOpen.value = false
  void router.push({
    path: '/supply-chain/integration/huolala',
    query: { tab, ...(staffId ? { staffId } : {}) },
  })
}
function associateEmployee() {
  connection(
    'employees',
    active.value?.platform
      ? currentSource(active.value.platform.source).facts?.sourceStaffId || undefined
      : undefined,
  )
}
function syncOne() {
  if (!active.value?.platform) return
  if (syncing.value) {
    syncOpen.value = true
    return
  }
  const order = currentSource(active.value.platform.source)
  syncNo.value = order.orderNo
  syncDates.value = [order.useTime.slice(0, 10), order.useTime.slice(0, 10)]
  syncOpen.value = true
  syncMessage.value = ''
}
const localToday = () => new Date().toLocaleDateString('sv-SE')
const syncOpen = ref(false),
  syncDates = ref<string[]>([localToday(), localToday()]),
  syncNo = ref(''),
  syncMessage = ref(''),
  syncing = ref(false),
  importOpen = ref(false)
let syncRunId = '',
  syncPoll: ReturnType<typeof setTimeout> | undefined,
  syncEpoch = 0,
  pageActive = true,
  disposed = false,
  initialized = false
function openSync() {
  if (!syncing.value) {
    syncDates.value = [localToday(), localToday()]
    syncNo.value = ''
    syncMessage.value = ''
  }
  syncOpen.value = true
}
function stopSyncPoll() {
  clearTimeout(syncPoll)
  syncPoll = undefined
  syncEpoch++
}
function scheduleSyncPoll() {
  clearTimeout(syncPoll)
  if (pageActive && !disposed && syncRunId) syncPoll = setTimeout(() => void pollSync(), 5000)
}
async function finishSync(run: HuolalaRun) {
  if (run.status === 'RUNNING') {
    syncMessage.value = '货拉拉订单同步中，请稍候'
    scheduleSyncPoll()
    return
  }
  syncRunId = ''
  syncing.value = false
  syncMessage.value =
    run.status === 'SUCCEEDED'
      ? `同步完成，已读取${run.stages?.listSaved ?? run.fetched}张货拉拉订单`
      : run.message || '同步未全部完成，请在同步记录中查看原因'
  page.value = 1
  table.value?.clearSelection()
  await load()
}
async function pollSync() {
  const epoch = syncEpoch,
    id = syncRunId
  if (!pageActive || disposed || !id) return
  try {
    const runs = await huolalaApi.runs()
    if (epoch !== syncEpoch || disposed || !pageActive) return
    const run = runs.find((item) => item.id === id)
    if (run) await finishSync(run)
    else scheduleSyncPoll()
  } catch {
    if (epoch !== syncEpoch || disposed || !pageActive) return
    syncMessage.value = '暂未取得同步进度，正在重试；也可在同步记录中查看'
    scheduleSyncPoll()
  }
}
async function sync() {
  if (syncing.value) return
  syncing.value = true
  syncMessage.value = ''
  try {
    if (!syncDates.value?.[0] || !syncDates.value?.[1]) throw new Error('请选择运输日期')
    const run = await huolalaApi.sync(
      'ORDERS',
      syncDates.value[0],
      syncDates.value[1],
      syncNo.value || undefined,
    )
    if (disposed) return
    syncRunId = run.id
    if (pageActive) await finishSync(run)
  } catch (e) {
    if (disposed) return
    syncRunId = ''
    syncing.value = false
    syncMessage.value = errorMessage(e, '同步失败')
  }
}
const importCities = ref<{ code: string; name: string }[]>([]),
  importEmployees = ref<CostEmployee[]>([]),
  importReady = ref(false)
async function openImport() {
  importOpen.value = true
  importReady.value = false
  try {
    ;[importCities.value, importEmployees.value] = await Promise.all([
      getCostCities(),
      getCostEmployees('logistics'),
    ])
    importReady.value = true
  } catch (e) {
    ElMessage.error(errorMessage(e, '档案加载失败'))
  }
}
async function generated(id: string) {
  importOpen.value = false
  await load()
  await open({ id } as CostRecord, true)
}
const exportOpen = ref(false),
  exportIds = ref<string[]>([]),
  exportFields = ref<string[]>([]),
  exportCount = ref(0),
  exporting = ref(false),
  exportError = ref('')
const exportColumns = [
  { key: 'documentNo', label: '费用单号' },
  ...columns.map((c) => ({ key: c.key, label: c.label })),
  { key: 'confirmed', label: '已确认运输成本（元）' },
]
let exportQuery: TransportQuery = { begin: 0, step: 200 },
  exportSequence = 0
function openExport() {
  exportIds.value = selected.value.map((r) => r.id)
  exportCount.value = result.value.page.total
  exportQuery = { ...applied, begin: 0, step: 200 }
  exportFields.value = exportColumns.map((c) => c.key)
  exportError.value = ''
  exportOpen.value = true
}
async function doExport() {
  if (exporting.value) return
  exporting.value = true
  exportError.value = ''
  const version = ++exportSequence
  try {
    const chosen = selectedCostColumns(exportColumns, exportFields.value)
    const rows = exportIds.value.length
      ? await exportSelectedTransport(exportIds.value)
      : await collectCostExportRows<TransportDetail>({
          fetchPage: async (begin, step) => {
            const r = await getTransportRecords({ ...exportQuery, begin, step }, true)
            return {
              total: r.page.total,
              items: r.page.items.map((record) => ({
                record,
                platform: r.platformRecords[record.id] || null,
              })),
            }
          },
          key: (r) => r.record.id,
          current: () => version === exportSequence,
        })
    if (!rows || version !== exportSequence) return
    await exportCostRows(
      '物流运输记录',
      chosen.map((c) => c.label),
      rows.map(({ record: r, platform: p }) =>
        chosen.map((c) => {
          if (c.key === 'documentNo') return r.documentNo
          if (c.key === 'confirmed') return r.statusCode === 'CONFIRMED' ? r.data.amount : null
          if (c.key === 'receivers') return receiversOf(r, p).join('\n')
          if (c.key === 'route') return routeText(routeOf(r, p))
          if (c.key === 'stopCount') return routeOf(r, p).receivers.length || null
          if (c.key === 'orders') return ordersOf(r, p).join('\n')
          if (c.key === 'amount') {
            const amount = amountOf(r, p)
            return amount == null ? null : Number(amount)
          }
          return value(r, c.key, p ? { [r.id]: p } : {})
        }),
      ),
    )
    exportOpen.value = false
  } catch (e) {
    exportError.value = errorMessage(e, '导出失败')
  } finally {
    exporting.value = false
  }
}
onMounted(async () => {
  try {
    await loadCostDictionaries('logistics')
  } catch (e) {
    ElMessage.error(errorMessage(e, '字典加载失败'))
  }
  try {
    importEmployees.value = (await getCostEmployees('logistics')) || []
  } catch {
    /* 人员目录不可用不阻塞已保存的运输记录。 */
  }
  await load()
  initialized = true
  const id = route.query.sourceId || route.query.costId || route.query.id
  if (typeof id === 'string' && id) await open({ id } as CostRecord, true)
})
onActivated(() => {
  pageActive = true
  if (initialized) void load()
  if (syncRunId) void pollSync()
})
onDeactivated(() => {
  pageActive = false
  serial++
  stopSyncPoll()
})
onBeforeUnmount(() => {
  disposed = true
  stopSyncPoll()
  serial++
  exportSequence++
})
</script>
<style scoped lang="scss">
@use '@/assets/styles/list-filters';

// 双指横滑越过表格边界时，不能继续触发浏览器前进／后退并重访附件地址。
// 仅在当前运输页面生效；离开页面后恢复其他页面原有的导航手势。
:global(html:has(.transport-page)) {
  overscroll-behavior-x: contain;
}
.transport-list :deep(.el-table__body-wrapper .el-scrollbar__wrap) {
  overscroll-behavior-x: contain;
}
.transport-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}
.transport-list {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
  min-width: 0;
}
.list-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 20px;
}
.list-heading > div {
  display: flex;
  align-items: center;
  gap: 12px;
}
.list-heading strong {
  font-size: 17px;
}
.selection {
  color: var(--el-color-primary);
  font-size: 13px;
}
.document-link {
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-align: left;
}
.document-link :deep(span) {
  overflow: hidden;
  text-overflow: ellipsis;
}
.row-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.row-actions .el-button {
  margin: 0;
}
.table-line {
  white-space: normal;
  line-height: 1.8;
}
.money-cell {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  white-space: nowrap;
}
.list-table-footer {
  padding: 16px 20px;
}
.transport-page :deep(.el-table__cell) {
  padding: 13px 0;
}
.transport-list :deep(.el-table .cell) {
  padding-inline: 10px;
}
.transport-list :deep(.el-table__header .cell) {
  white-space: nowrap;
}
.transport-list :deep(.transport-actions) {
  gap: 4px;
  flex-wrap: nowrap;
}
@media (max-width: 750px) {
  .list-heading {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
