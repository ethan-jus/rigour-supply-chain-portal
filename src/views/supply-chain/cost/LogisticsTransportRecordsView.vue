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
            ><el-option label="待完善" value="INCOMPLETE" /><el-option
              label="已完善"
              value="COMPLETE" /><el-option label="已作废" value="VOID"
          /></el-select>
        </div>
        <div class="list-filter-field list-filter-field--select">
          <el-select
            v-model="filters.sourceSystem"
            clearable
            placeholder="数据来源"
            aria-label="数据来源"
            ><el-option label="货拉拉同步" value="HUOLALA" /><el-option
              label="订货宝同步"
              value="DHB" /><el-option label="手动录入" value="MANUAL_ENTRY"
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
            v-model="filters.businessOrderNo"
            clearable
            placeholder="业务单号"
            aria-label="业务单号"
          />
        </div>
        <div class="list-filter-field list-filter-field--employee">
          <el-select-v2
            v-model="filters.orderPlacerEmployeeCode"
            clearable
            filterable
            :options="employeeOptions"
            :loading="employeeDirectoryLoading"
            :no-data-text="employeeDirectoryError || '暂无员工'"
            placeholder="下单人"
            aria-label="下单人"
            @visible-change="retryEmployeeDirectory"
          />
        </div>
        <div class="list-filter-field list-filter-field--employee">
          <el-select-v2
            v-model="filters.orderPlacerDepartment"
            clearable
            filterable
            :options="departmentOptions"
            :loading="employeeDirectoryLoading"
            :no-data-text="employeeDirectoryError || '暂无所属部门'"
            placeholder="下单人所属部门"
            aria-label="下单人所属部门"
            @visible-change="retryEmployeeDirectory"
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
      </template>
    </OrderRegisterFilterCard>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <section class="transport-list">
      <div class="list-heading">
        <div>
          <strong>物流运输记录</strong><el-tag round type="info">{{ result.page.total }} 条</el-tag
          ><span v-if="selected.length" class="selection">已选 {{ selected.length }} 条</span>
          <span
            v-if="result.page.registeredAmount != null"
            class="freight-summary"
            title="统计当前筛选下所有未作废记录的已录运费，含所有分页"
          >
            <span
              >筛选运费合计
              <b>{{
                result.page.total > 0 && result.page.missingAmountCount === result.page.total
                  ? '—'
                  : money(result.page.registeredAmount)
              }}</b>
              元</span
            >
            <small v-if="result.page.missingAmountCount"
              >{{ result.page.missingAmountCount }} 笔待补运费</small
            >
          </span>
        </div>
        <div class="list-toolbar">
          <el-button v-if="can('integration:huolala:sync')" @click="openSync"
            >同步货拉拉订单</el-button
          ><el-button v-if="can('order:logistics-cost:write')" type="primary" @click="create"
            >新增运输记录</el-button
          >
        </div>
      </div>
      <div class="transport-table-viewport">
        <el-table
          ref="table"
          v-loading="loading"
          :data="result.page.items"
          row-key="id"
          border
          scrollbar-always-on
          height="100%"
          empty-text="暂无运输记录"
          @selection-change="selectionChanged"
        >
          <el-table-column type="selection" width="48" :reserve-selection="true" fixed="left" />
          <el-table-column label="费用单号" min-width="230" fixed="left"
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
                  v-for="text in businessOrderLines(row as CostRecord)"
                  :key="text"
                  class="table-line"
                >
                  {{ text }}
                </div></template
              ><el-tag
                v-else-if="col.key === 'status'"
                :type="
                  row.businessStatusCode === 'COMPLETE'
                    ? 'success'
                    : row.statusCode === 'VOID'
                      ? 'info'
                      : 'warning'
                "
                >{{ statusName(row.statusCode, row.businessStatusCode) }}</el-tag
              ><span
                v-else-if="col.key === 'amount' && (row as CostRecord).data.amount == null"
                class="unfilled-amount"
                >待补金额</span
              ><span v-else :class="{ 'money-cell': col.numeric }">{{
                value(row as CostRecord, col.key)
              }}</span></template
            >
          </el-table-column>
          <el-table-column label="操作" fixed="right" width="160"
            ><template #default="{ row }"
              ><TransportRecordActions
                :record="row as CostRecord"
                @view="view(row as CostRecord)"
                @edit="edit(row as CostRecord)"
                @action="(action) => act(row as CostRecord, action)" /></template
          ></el-table-column>
        </el-table>
      </div>
      <ListTableFooter>
        <template #actions>
          <el-button v-if="can('order:logistics-cost:write')" @click="feeImportOpen = true"
            >批量补录运费</el-button
          >
          <el-button
            v-if="
              can('order:logistics-cost:void') && selected.some((r) => r.statusCode === 'ACTIVE')
            "
            :loading="batchVoiding"
            :disabled="loading || batchVoiding"
            @click="voidSelected"
            >作废选中记录</el-button
          >
          <TableColumnSettings
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
            ><SupplyActionLabel code="order:logistics-cost:export" fallback="自定义导出" /></el-button
          ><el-dropdown
            v-if="can('integration:huolala:read') || can('order:logistics-cost:manage-imports')"
            ><el-button
              >其他操作<el-icon><ArrowDown /></el-icon></el-button
            ><template #dropdown
              ><el-dropdown-menu
                ><el-dropdown-item
                  v-if="can('integration:huolala:read')"
                  @click="connection('connection')"
                  >货拉拉接入</el-dropdown-item
                ><el-dropdown-item
                  v-if="can('integration:huolala:read')"
                  @click="connection('employees')"
                  >货拉拉员工关联</el-dropdown-item
                ><el-dropdown-item
                  v-if="can('integration:huolala:read')"
                  @click="connection('runs')"
                  >货拉拉同步记录</el-dropdown-item
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
      @associate-employee="associateEmployee"
      :initial-section="initialSection"
    />
    <CostExportDialog
      v-model="exportOpen"
      v-model:fields="exportFields"
      :columns="exportColumns"
      :sections="exportSections"
      :scope="
        exportIds.length
          ? `已选 ${exportIds.length} 条运输记录`
          : `全部筛选结果（${exportCount} 条）`
      "
      :busy="exporting"
      :error="exportError"
      @confirm="doExport"
    />
    <el-dialog
      v-model="syncOpen"
      title="同步货拉拉订单"
      width="min(520px, 94vw)"
      :close-on-click-modal="false"
    >
      <el-form label-position="top">
        <HuolalaSyncDates
          v-if="!syncNo.trim()"
          v-model:from="syncFrom"
          v-model:to="syncTo"
          label="用车日期"
          :disabled="syncing"
        />
        <el-form-item label="指定货拉拉订单号">
          <el-input
            v-model="syncNo"
            :disabled="syncing"
            placeholder="可选，填写后只同步此单"
          />
        </el-form-item>
      </el-form>
      <el-alert v-if="syncError" :title="syncError" type="error" :closable="false" />
      <el-alert v-else-if="syncMessage" :title="syncMessage" type="info" :closable="false" />
      <template #footer>
        <el-button @click="syncOpen = false">关闭</el-button>
        <el-button type="primary" :loading="syncing" @click="sync">开始同步</el-button>
      </template>
    </el-dialog>
    <TransportFeeImportDialog v-if="feeImportOpen" v-model="feeImportOpen" @saved="load" />
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
import SupplyActionLabel from '@/components/supply/SupplyActionLabel.vue'
import {
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  onActivated,
  onDeactivated,
  reactive,
  ref,
  watch,
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
  exportSelectedTransport,
  type TransportDetail,
  type TransportPage,
  type TransportQuery,
} from '@/api/core/transport-records'
import { huolalaApi, type HuolalaRun } from '@/api/core/huolala'
import { errorMessage } from '@/api/core/error'
import { businessDate } from '@/utils/business-date'
import { displayRecordActor, displayRecordDateTime } from '@/utils/business-display'
import HuolalaSyncDates from '../huolala/HuolalaSyncDates.vue'
import {
  money,
  ordersOf,
  receiversOf,
  routeOf,
  routeText,
  vehicleOf,
  transportTimeOf,
  statusName,
  transportTypes,
  typeName,
} from './transport-records'
import { currentSource, platformPaymentStatus } from './huolala-source'
import { costLabel, costOptions, loadCostDictionaryCodes } from './cost-dictionaries'
import CostExportDialog from './CostExportDialog.vue'
import TransportRecordEditor from './TransportRecordEditor.vue'
import TransportRecordActions from './TransportRecordActions.vue'
import TransportRouteSummary from './TransportRouteSummary.vue'
import CostCarrierOrdersPanel from './CostCarrierOrdersPanel.vue'
import TransportFeeImportDialog from './TransportFeeImportDialog.vue'
const feeImportOpen = ref(false)
import { exportCostRows } from './cost-export'
import { collectCostExportRows, selectedCostColumns } from './custom-cost-export'
import { savedTransportAllocations } from './transport-allocation'
import { frozenTransportSources } from './transport-records'
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
  { key: 'platformNo', label: '快递单号', width: 200 },
  { key: 'carrier', label: '物流公司', width: 120 },
  { key: 'orderedAt', label: '下单／发货时间', width: 190 },
  { key: 'platformEmployee', label: '下单人', width: 130 },
  { key: 'platformEmployeeDepartment', label: '下单人所属部门', width: 160 },
  { key: 'amount', label: '运输费用（元）', width: 150, numeric: true },
  { key: 'status', label: '单据状态', width: 104 },
  { key: 'route', label: '行驶路段', width: 280 },
  { key: 'stopCount', label: '收货点数', width: 96 },
  { key: 'type', label: '运输类型', width: 140 },
  { key: 'orders', label: '业务单号', width: 220 },
  { key: 'relation', label: '订单关联状态', width: 130 },
  { key: 'vehicle', label: '车型', width: 110 },
  { key: 'creator', label: '创建人', width: 110 },
  { key: 'date', label: '运输日期', width: 106, optional: true },
  { key: 'receivers', label: '收货方', width: 150, optional: true },
  { key: 'source', label: '数据来源', width: 96, optional: true },
  { key: 'platformStatus', label: '运输状态', width: 155, optional: true },
  { key: 'mappedEmployee', label: '本公司员工', width: 150, optional: true },
  { key: 'employeeRelation', label: '员工关联状态', width: 130, optional: true },
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
function businessOrderLines(r: CostRecord) {
  const orderNos = [...new Set(ordersOf(r, platformOf(r)).filter(Boolean))]
  return orderNos.length ? orderNos : ['-']
}
function value(
  r: CostRecord,
  key: string,
  sources = result.value.platformRecords,
  shipments = result.value.shipmentRecords || {},
): string {
  const platform = sources[r.id],
    source = platform ? currentSource(platform.source) : null
  if (key === 'platformEmployee' || key === 'platformEmployeeDepartment') {
    const department = key === 'platformEmployeeDepartment'
    if (source) {
      return (
        (department
          ? source.facts?.mappedDepartmentName?.trim()
          : source.facts?.sourceEmployeeName?.trim() || source.raw['下单人(员工)']?.trim()) || '-'
      )
    }
    const ledgerSources = r.data.ledger?.sources
    const sales = ledgerSources?.length
      ? ledgerSources.filter((s) => s.orderTypeCode === 'SALES_ORDER' || s.orderTypeCode === 'DELIVERY')
      : r.sources.filter((s) => s.sourceType === 'SALES_ORDER' || s.sourceType === 'DELIVERY')
    const names = sales.map((s) => (department ? s.departmentName : s.employeeName)?.trim())
    return [...new Set(names.filter(Boolean))].join('、') || '-'
  }
  const vals: Record<string, unknown> = {
    route: routeText(routeOf(r, platform)),
    stopCount: routeOf(r, platform).receivers.length || '-',
    source: platform ? '货拉拉同步' : shipments[r.id]?.length ? '订货宝同步' : '手动录入',
    type: typeName(
      platform?.draft?.transportType ||
        r.data.ledger?.transportPurposeCode ||
        r.data.typeCode ||
        r.data.logistics?.legCode,
    ),
    date: source?.useTime.slice(0, 10) || r.data.costDate,
    orderedAt: transportTimeOf(r, platform, shipments[r.id]),
    platformNo:
      source?.orderNo ||
      shipments[r.id]?.flatMap((s) => s.latest.trackingNumbers).join('、') ||
      r.data.ledger?.platformOrderNo ||
      '-',
    amount: money(r.data.amount),
    status: statusName(r.statusCode, r.businessStatusCode),
    creator: platform ? '系统同步' : displayRecordActor(r.createdBy),
    carrier: platform
      ? '货拉拉'
      : r.data.ledger?.carrierCode
        ? costLabel('COST_CARRIER', r.data.ledger.carrierCode)
        : shipments[r.id]?.[0]?.latest.carrierName || r.data.logistics?.carrierName,
    vehicle: vehicleOf(platform),
    platformStatus: source?.status,
    mappedEmployee:
      importEmployees.value.find((e) => e.employeeCode === source?.facts?.mappedEmployeeCode)
        ?.employeeName || source?.facts?.mappedEmployeeCode,
    employeeRelation: source ? (source.facts?.mappedEmployeeCode ? '已关联' : '未关联') : '-',
    relation: ordersOf(r, platform).some((no) => no?.trim()) ? '已关联' : '未关联',
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
    if (request === serial) {
      result.value = data
      await nextTick()
      // 查询、分页和同步刷新后从首条展示；保留横向阅读位置和首尾固定列。
      if (request === serial) table.value?.setScrollTop(0)
    }
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
    readonly.value = mode || active.value.record.statusCode === 'VOID'
    editorKey.value++
    editorOpen.value = true
  } catch (e) {
    ElMessage.error(errorMessage(e, '运输记录加载失败'))
  }
}
const view = (r: CostRecord) => open(r, true),
  edit = (r: CostRecord) => open(r, false)
async function act(row: CostRecord, action: 'void' | 'delete') {
  try {
    const label = { void: '作废', delete: '删除' }[action]
    const answer = await ElMessageBox.prompt(
      `${label}该运输记录，请填写原因。`,
      `${label}运输记录`,
      {
        inputType: 'textarea',
        inputPlaceholder: `${label}原因`,
        inputValidator: (v) =>
          (!!v?.trim() && (v?.length || 0) <= 500) || '请填写不超过500字的原因',
        confirmButtonText: label,
        cancelButtonText: '取消',
      },
    )
    await changeCostStatus('logistics', row, action, answer.value || '')
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
const batchVoiding = ref(false)
async function voidSelected() {
  if (batchVoiding.value) return
  const targets = selected.value.filter((r) => r.statusCode === 'ACTIVE')
  if (!targets.length) return
  batchVoiding.value = true
  let done = 0
  const failed: string[] = []
  try {
    const answer = await ElMessageBox.prompt(
      `作废选中的 ${targets.length} 笔运输记录，请填写原因。`,
      '作废运输记录',
      {
        inputType: 'textarea',
        inputPlaceholder: '作废原因',
        inputValidator: (v) =>
          (!!v?.trim() && (v?.length || 0) <= 500) || '请填写不超过500字的原因',
        confirmButtonText: '作废',
        cancelButtonText: '取消',
      },
    )
    for (const row of targets) {
      try {
        await changeCostStatus('logistics', row, 'void', answer.value || '')
        done++
      } catch (e) {
        failed.push(`${row.documentNo}：${errorMessage(e, '未完成')}`)
      }
    }
    table.value?.clearSelection()
    await load()
    if (failed.length)
      ElMessageBox.alert(
        `已作废 ${done} 笔，${failed.length} 笔未完成。${failed.slice(0, 5).join('；')}`,
        '处理结果',
      )
    else ElMessage.success(`已作废 ${done} 笔运输记录`)
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error(errorMessage(e, '操作未完成，请刷新核对'))
  } finally {
    batchVoiding.value = false
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
const syncOpen = ref(false),
  syncFrom = ref<string | null>(null),
  syncTo = ref<string | null>(null),
  syncNo = ref(''),
  syncMessage = ref(''),
  syncError = ref(''),
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
    const today = businessDate(new Date())
    syncFrom.value = today
    syncTo.value = today
    syncNo.value = ''
    syncMessage.value = ''
    syncError.value = ''
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
  // 同步完成时更新当前查看的原单；编辑中的草稿不能被后台回填替换。
  if (editorOpen.value && readonly.value && active.value) {
    const id = active.value.record.id,
      key = editorKey.value
    try {
      const detail = await getTransport(id)
      if (
        editorOpen.value &&
        readonly.value &&
        editorKey.value === key &&
        active.value?.record.id === id
      ) {
        active.value = detail
        editorKey.value++
      }
    } catch (e) {
      ElMessage.warning(errorMessage(e, '列表已更新，当前详情刷新失败，请重新打开'))
    }
  }
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
  syncError.value = ''
  try {
    const orderNo = syncNo.value.trim() || undefined
    const from = orderNo ? undefined : syncFrom.value || undefined
    const to = orderNo ? undefined : syncTo.value || undefined
    if (!orderNo) {
      if (!from || !to) throw new Error('请选择开始日期和结束日期')
      if (to < from) throw new Error('结束日期不能早于开始日期')
    }
    const run = await huolalaApi.sync('ORDERS', from, to, orderNo)
    if (disposed) return
    syncRunId = run.id
    if (pageActive) await finishSync(run)
  } catch (e) {
    if (disposed) return
    syncRunId = ''
    syncing.value = false
    syncError.value = errorMessage(e, '同步失败')
  }
}
const importCities = ref<{ code: string; name: string }[]>([]),
  importEmployees = ref<CostEmployee[]>([]),
  importReady = ref(false)
const employeeDirectoryLoading = ref(false)
const employeeDirectoryError = ref('')
const employeeOptions = computed(() => {
  const counts = new Map<string, number>()
  for (const { employeeName } of importEmployees.value)
    counts.set(employeeName, (counts.get(employeeName) ?? 0) + 1)
  return importEmployees.value.map(({ employeeName, employeeCode, departmentName }) => ({
    value: employeeCode,
    label: [
      employeeName,
      departmentName,
      (counts.get(employeeName) ?? 0) > 1 ? employeeCode : '',
    ].filter(Boolean).join(' · '),
  }))
})
const departmentOptions = computed(() => {
  const departments = importEmployees.value.flatMap((employee) => {
    const name = employee.departmentName?.trim()
    return name ? [name] : []
  })
  return [...new Set(departments)]
    .sort((left, right) => left.localeCompare(right, 'zh-CN'))
    .map((name) => ({ label: name, value: name }))
})
async function loadEmployeeDirectory() {
  employeeDirectoryLoading.value = true
  employeeDirectoryError.value = ''
  try {
    const employees = await getCostEmployees('logistics')
    if (!disposed) importEmployees.value = employees || []
  } catch {
    if (!disposed) employeeDirectoryError.value = '员工档案加载失败，请重新打开下拉框重试'
  } finally {
    if (!disposed) employeeDirectoryLoading.value = false
  }
}
function retryEmployeeDirectory(open: boolean) {
  if (open && employeeDirectoryError.value && !employeeDirectoryLoading.value)
    void loadEmployeeDirectory()
}
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
  exportError = ref(''),
  exportPlatformOnly = ref(false)
const exportSummaryKeys = new Set([
  'documentNo',
  'platformNo',
  'carrier',
  'orderedAt',
  'route',
  'stopCount',
  'type',
  'amount',
  'status',
])
const exportBusinessKeys = new Set([
  ...exportSummaryKeys,
  'vehicle',
  'creator',
  'relation',
  'orders',
  'platformEmployee',
  'platformEmployeeDepartment',
  'employee',
  'department',
  'billItems',
  'payment',
  'source',
])
const platformExportKeys = new Set([
  'platformStatus',
  'paid',
  'unpaid',
  'refund',
])
const exportColumns = computed(() => [
  { key: 'documentNo', label: '费用单号' },
  ...columns
    .filter(
      (c) =>
        exportBusinessKeys.has(c.key) ||
        (exportPlatformOnly.value && platformExportKeys.has(c.key)),
    )
    .map((c) => ({ key: c.key, label: c.label })),
  { key: 'confirmed', label: '计入运输成本（元）' },
  { key: 'orderAllocations', label: '订单分摊费用（元）' },
])
const exportSections = computed(() => [
  { label: '运输摘要', keys: [...exportSummaryKeys, 'vehicle'] },
  {
    label: '业务明细',
    keys: exportColumns.value
      .map((c) => c.key)
      .filter(
        (key) => !exportSummaryKeys.has(key) && key !== 'vehicle' && !platformExportKeys.has(key),
      ),
  },
  { label: '运输资料', keys: [...platformExportKeys] },
])
let exportQuery: TransportQuery = { begin: 0, step: 200 },
  exportSequence = 0
function openExport() {
  exportIds.value = selected.value.map((r) => r.id)
  exportCount.value = result.value.page.total
  exportQuery = { ...applied, begin: 0, step: 200 }
  // 仅明确全部为货拉拉的范围提供专属字段；混合范围使用通用业务字段。
  exportPlatformOnly.value = selected.value.length
    ? selected.value.every((r) => !!result.value.platformRecords[r.id])
    : applied.sourceSystem === 'HUOLALA' ||
      (result.value.page.items.length === result.value.page.total &&
        result.value.page.items.every((r) => !!result.value.platformRecords[r.id]))
  exportFields.value = exportColumns.value
    .filter(
      (c) => exportSummaryKeys.has(c.key) || (exportPlatformOnly.value && c.key === 'vehicle'),
    )
    .map((c) => c.key)
  exportError.value = ''
  exportOpen.value = true
}
async function doExport() {
  if (exporting.value) return
  exporting.value = true
  exportError.value = ''
  const version = ++exportSequence
  try {
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
                shipments: r.shipmentRecords?.[record.id] || [],
              })),
            }
          },
          key: (r) => r.record.id,
          current: () => version === exportSequence,
        })
    if (!rows || version !== exportSequence) return
    const platformOnly = rows.length > 0 && rows.every((r) => !!r.platform)
    const chosen = selectedCostColumns(exportColumns.value, exportFields.value).filter(
      (c) => platformOnly || !platformExportKeys.has(c.key),
    )
    if (!chosen.length) throw new Error('请选择适用于当前运输记录的导出字段')
    if (!platformOnly && chosen.some((column) => column.key === 'payment'))
      await loadCostDictionaryCodes(['COST_PAYMENT_STATUS'], false, 'inline')
    if (version !== exportSequence) return
    await exportCostRows(
      '物流运输记录',
      chosen.map((c) => c.label),
      rows.map((detail) => {
        const { record: r, platform: p } = detail
        return chosen.map((c) => {
          if (c.key === 'documentNo') return r.documentNo
          if (c.key === 'confirmed') return r.statusCode === 'ACTIVE' ? r.data.amount : null
          if (c.key === 'receivers') return receiversOf(r, p).join('\n')
          if (c.key === 'route') return routeText(routeOf(r, p))
          if (c.key === 'stopCount') return routeOf(r, p).receivers.length || null
          if (c.key === 'orders') return ordersOf(r, p).join('\n')
          if (c.key === 'orderAllocations')
            return savedTransportAllocations(detail, frozenTransportSources(r))
              .map((s) => `${s.code}：${money(s.amount)}`)
              .join('\n')
          if (c.key === 'amount') {
            const amount = r.data.amount
            return amount == null ? null : Number(amount)
          }
          return value(r, c.key, p ? { [r.id]: p } : {}, { [r.id]: detail.shipments || [] })
        })
      }),
    )
    exportOpen.value = false
  } catch (e) {
    exportError.value = errorMessage(e, '导出失败')
  } finally {
    exporting.value = false
  }
}
let openedTransportLink = ''
function openTransportLink() {
  if (route.path !== '/supply-chain/cost/logistics') {
    openedTransportLink = ''
    return
  }
  const id = route.query.sourceId || route.query.costId || route.query.id
  const importFreight = route.query.action === 'import-freight'
  if (!importFreight && (typeof id !== 'string' || !id)) {
    openedTransportLink = ''
    return
  }
  const key = route.fullPath
  if (!initialized || !pageActive || key === openedTransportLink) return
  openedTransportLink = key
  if (importFreight) {
    if (can('order:logistics-cost:write')) feeImportOpen.value = true
    return
  }
  if (typeof id !== 'string') return
  const target = route.query.section
  const focus = target === 'fees' || target === 'orders' || target === 'evidence' ? target : ''
  const editable = route.query.edit === '1' && can('order:logistics-cost:write')
  void open({ id } as CostRecord, !editable, focus)
}
watch(() => route.fullPath, openTransportLink)
onMounted(async () => {
  const status = route.query.statusCode
  if (status === 'INCOMPLETE' || status === 'COMPLETE' || status === 'VOID') {
    filters.value.statusCode = status
    applied = { ...applied, statusCode: status }
  }
  const initialLoad = load()
  void loadCostDictionaryCodes(['COST_CARRIER'], false, 'inline')
  void loadEmployeeDirectory()
  openTransportLink()
  await initialLoad
  initialized = true
})
onActivated(() => {
  pageActive = true
  if (initialized) {
    void load()
    openTransportLink()
  }
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
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.transport-page > .order-register-filter,
.transport-page > .el-alert {
  flex: 0 0 auto;
}
.transport-list {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
  min-width: 0;
  min-height: 0;
}
.transport-table-viewport {
  flex: 1 1 auto;
  min-height: 148px;
  min-width: 0;
}
.list-heading {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px 16px;
  padding: 18px 20px;
}
.list-heading > div {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}
.list-heading strong {
  font-size: 17px;
}
.freight-summary {
  display: inline-flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.freight-summary b {
  color: var(--el-text-color-primary);
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}
.freight-summary small {
  color: var(--el-color-warning-dark-2);
  font-size: inherit;
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
.unfilled-amount {
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}
.list-table-footer {
  flex: 0 0 auto;
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
