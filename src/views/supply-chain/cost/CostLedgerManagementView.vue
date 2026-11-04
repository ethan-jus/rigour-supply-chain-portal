<template>
  <div class="ledger-workspace">
    <section class="filter-panel">
      <el-form class="filters" label-position="top" @submit.prevent="search">
        <el-form-item label="费用单号"
          ><el-input v-model="filters.documentNo" clearable @keyup.enter="search"
        /></el-form-item>
        <template v-if="logistics">
          <el-form-item label="关联单据类型"
            ><el-select v-model="filters.orderTypeCode" clearable
              ><el-option
                v-for="t in sourceTypes"
                :key="t.value"
                :label="t.label"
                :value="t.value" /></el-select
          ></el-form-item>
          <el-form-item label="关联单据编号"
            ><el-input v-model="filters.sourceDocumentNo" clearable @keyup.enter="search"
          /></el-form-item>
          <el-form-item label="运输用途"
            ><CostDictSelect v-model="filters.typeCode" code="COST_TRANSPORT_PURPOSE" clearable
          /></el-form-item>
          <el-form-item label="物流公司"
            ><CostDictSelect v-model="filters.carrierCode" code="COST_CARRIER" clearable
          /></el-form-item>
        </template>
        <template v-else
          ><el-form-item label="仓库"
            ><CostLedgerPartySelect
              v-model="warehouseFilter"
              :logistics="false"
              kind="WAREHOUSE" /></el-form-item
          ><el-form-item label="费用项目"
            ><CostDictSelect
              v-model="filters.ledgerFeeType"
              code="COST_WAREHOUSE_FEE_TYPE"
              clearable /></el-form-item
        ></template>
        <el-form-item :label="logistics ? '运输日期' : '登记日期'"
          ><el-date-picker
            v-model="dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始日期"
            end-placeholder="截止日期"
        /></el-form-item>
        <el-form-item label="费用归属月份"
          ><el-date-picker
            v-model="filters.costMonth"
            type="month"
            value-format="YYYY-MM"
            clearable
        /></el-form-item>
        <el-form-item label="单据状态"
          ><CostDictSelect v-model="filters.statusCode" code="COST_STATUS" clearable
        /></el-form-item>
        <el-form-item label="付款状态"
          ><CostDictSelect v-model="filters.paymentStatusCode" code="COST_PAYMENT_STATUS" clearable
        /></el-form-item>
        <template v-if="moreFilters"
          ><el-form-item v-if="logistics" label="运单号"
            ><el-input v-model="filters.trackingNo" clearable /></el-form-item
          ><el-form-item label="费用归属城市"
            ><CostCitySelect
              v-model="cityFilter"
              :action="permission + ':read'"
              clearable
              @loaded="cities = $event" /></el-form-item
          ><el-form-item label="费用负责人"
            ><el-select v-model="filters.ownerEmployeeCode" clearable filterable
              ><el-option
                v-for="e in employees"
                :key="e.employeeCode"
                :label="e.employeeName"
                :value="e.employeeCode" /></el-select></el-form-item
        ></template>
      </el-form>
      <div class="filter-actions">
        <el-button link @click="moreFilters = !moreFilters">{{
          moreFilters ? '收起条件' : '更多条件'
        }}</el-button>
        <div>
          <el-button @click="reset">重置</el-button
          ><el-button type="primary" :loading="loading" @click="search">查询</el-button>
        </div>
      </div>
    </section>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <section class="list-panel">
      <div class="list-toolbar">
        <div>
          <strong>{{ title }}</strong
          ><span class="count">{{ listReady ? result.total : '—' }} 条</span>
        </div>
        <div>
          <el-button
            v-if="can(permission + ':export')"
            :loading="exporting"
            :disabled="loading || !listReady"
            @click="exportRows"
            >导出</el-button
          ><el-button
            v-if="can(permission + ':write')"
            type="primary"
            :disabled="loading || saving"
            @click="edit()"
            >新增{{ logistics ? '运输记录' : '仓储费用' }}</el-button
          >
        </div>
      </div>
      <div class="metrics" aria-label="筛选结果汇总" :aria-busy="loading">
        <div class="metric primary">
          <span>{{ logistics ? '已确认我方费用' : '本期已确认归属费用' }}</span
          ><strong>{{ summaryMoney(result.confirmedAmount) }}</strong>
        </div>
        <div class="metric green">
          <span>{{ logistics ? '待确认我方费用' : '本期待确认归属费用' }}</span
          ><strong>{{ summaryMoney(pendingAmount) }}</strong>
        </div>
        <div class="metric amber">
          <span>待补金额记录</span
          ><strong>{{ summaryCount(result.missingAmountCount, '条') }}</strong>
        </div>
        <div class="metric">
          <span>{{ logistics ? '第三方承担运输' : '涉及仓库' }}</span
          ><strong>{{
            summaryCount(
              logistics ? result.thirdPartyCount : result.warehouseCount,
              logistics ? '单' : '个',
            )
          }}</strong>
        </div>
      </div>
      <el-table
        v-loading="loading"
        :data="result.items"
        border
        row-key="id"
        class="ledger-table"
        :empty-text="error ? '费用列表暂不可用，请重试' : '暂无符合条件的记录'"
        max-height="max(280px, calc(100vh - 470px))"
      >
        <el-table-column label="费用单号" fixed="left" width="235"
          ><template #default="{ row }"
            ><el-button link type="primary" class="code-link" @click="view(row as CostRecord)">{{
              row.documentNo
            }}</el-button>
            <div v-if="row.data.ledger?.sourceSync?.differencePending" class="source-warning">
              来源变化待核实
            </div>
            <div
              v-else-if="row.data.ledger?.sourceSync && !row.data.ledger.sourceSync.manuallyChanged"
              class="muted"
            >
              采购约定待核实
            </div></template
          ></el-table-column
        >
        <template v-if="logistics"
          ><el-table-column label="运输用途" width="135"
            ><template #default="{ row }">{{
              purpose(row as CostRecord)
            }}</template></el-table-column
          ><el-table-column label="运输日期" width="130"
            ><template #default="{ row }"
              ><span class="nowrap">{{ row.data.costDate }}</span></template
            ></el-table-column
          ><el-table-column label="发货方" min-width="240" show-overflow-tooltip
            ><template #default="{ row }">{{
              senderName(row as CostRecord)
            }}</template></el-table-column
          >
          <el-table-column label="收货方" min-width="270"
            ><template #default="{ row }"
              ><div class="recipient-names">
                <div v-for="(name, i) in receiverNames(row as CostRecord)" :key="i">{{ name }}</div>
              </div></template
            ></el-table-column
          >
          <el-table-column label="物流公司" width="150"
            ><template #default="{ row }">{{
              carrier(row as CostRecord)
            }}</template></el-table-column
          ><el-table-column label="运单号" min-width="210" show-overflow-tooltip
            ><template #default="{ row }"
              ><span class="nowrap">{{
                row.data.ledger?.trackingNo || row.data.logistics?.trackingNo || '—'
              }}</span></template
            ></el-table-column
          ><el-table-column label="关联单据" min-width="240"
            ><template #default="{ row }"
              ><div v-for="code in sourceCodes(row as CostRecord)" :key="code" class="nowrap">
                {{ code }}
              </div></template
            ></el-table-column
          >
        </template>
        <template v-else
          ><el-table-column label="仓库" min-width="230" show-overflow-tooltip
            ><template #default="{ row }">{{
              row.warehouseName ||
              row.data.warehouseLedger?.warehouseCode ||
              row.data.rental?.premisesName ||
              '—'
            }}</template></el-table-column
          ><el-table-column label="服务期间" min-width="240"
            ><template #default="{ row }">{{
              servicePeriod(row as CostRecord)
            }}</template></el-table-column
          ><el-table-column label="费用项目" min-width="200"
            ><template #default="{ row }"
              ><div v-for="name in warehouseFeeNames(row as CostRecord)" :key="name">
                {{ name }}
              </div></template
            ></el-table-column
          ><el-table-column label="登记日期" width="130"
            ><template #default="{ row }">{{ row.data.costDate }}</template></el-table-column
          ></template
        >
        <el-table-column
          :label="logistics ? '本单我方费用（元）' : '本单费用总额（元）'"
          width="195"
          align="right"
          ><template #default="{ row }"
            ><strong>{{ costMoney(row.data.amount) }}</strong></template
          ></el-table-column
        >
        <el-table-column v-if="!logistics" label="筛选期归属费用（元）" width="205" align="right"
          ><template #default="{ row }">{{
            costMoney(row.periodAmount === undefined ? row.data.amount : row.periodAmount)
          }}</template></el-table-column
        >
        <el-table-column label="单据状态" width="125"
          ><template #default="{ row }"
            ><el-tag
              :type="
                row.statusCode === 'CONFIRMED'
                  ? 'success'
                  : row.statusCode === 'VOID'
                    ? 'info'
                    : 'warning'
              "
              >{{ costLabel('COST_STATUS', row.statusCode) }}</el-tag
            ></template
          ></el-table-column
        ><el-table-column label="创建人" width="150"
          ><template #default="{ row }">{{
            displayRecordActor(row.createdBy)
          }}</template></el-table-column
        >
        <el-table-column label="操作" fixed="right" width="285"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="view(row as CostRecord)">查看</el-button
            ><el-button
              v-if="row.statusCode !== 'VOID' && can(permission + ':write')"
              link
              type="primary"
              @click="edit(row as CostRecord)"
              >编辑</el-button
            ><el-button
              v-if="row.statusCode === 'DRAFT' && can(permission + ':confirm')"
              link
              type="primary"
              @click="act(row as CostRecord, 'confirm')"
              >确认</el-button
            ><el-button
              v-if="row.statusCode !== 'VOID' && can(permission + ':void')"
              link
              type="danger"
              @click="act(row as CostRecord, 'void')"
              >作废</el-button
            ><el-button link @click="history(row as CostRecord)">记录</el-button></template
          ></el-table-column
        >
      </el-table>
      <div class="pagination">
        <span class="muted">{{
          logistics
            ? '运输单金额按筛选结果去重合计；订单承担金额在详情分摊中查看。'
            : '归属费用按所选月份统计，押金不计入费用。'
        }}</span
        ><el-pagination
          v-model:current-page="page"
          v-model:page-size="step"
          :page-sizes="[20, 50, 100]"
          :total="result.total"
          layout="total, sizes, prev, pager, next"
          @change="load"
        />
      </div>
    </section>
    <el-dialog
      v-model="editorOpen"
      :title="`${editing ? '编辑' : '新增'}${logistics ? '物流运输记录' : '仓储费用'}`"
      width="min(1460px, 96vw)"
      top="3vh"
      class="cost-ledger-dialog"
      :close-on-click-modal="false"
      :before-close="beforeClose"
      destroy-on-close
    >
      <el-alert v-if="saveError" :title="saveError" type="error" :closable="false" />
      <el-alert
        v-if="editing && !editing.data.ledger && !editing.data.warehouseLedger"
        title="请补齐历史记录缺少的收发、费用归属信息；原始内容仍保留在操作记录中。"
        type="info"
        :closable="false"
      />
      <CostLedgerEditor
        v-model="form"
        :logistics="logistics"
        :cities="cities"
        :employees="employees"
        :warehouse-name="editing?.warehouseName"
        :confirmed="editing?.statusCode === 'CONFIRMED'"
      />
      <section class="attachment-panel">
        <template v-if="editing?.statusCode === 'CONFIRMED'">
          <p class="hint">已确认费用的附件仅可查看。</p>
          <CostAttachments :category="category" :row="editing" :editable="false" />
        </template>
        <CostAttachmentEditor
          v-else
          v-model="files"
          title="相关附件"
          :category="category"
          :row="editing"
          :disabled="saving"
          @busy="uploadBusy = $event"
        />
      </section>
      <template #footer
        ><div class="editor-footer">
          <span
            >{{ logistics ? '我方费用合计' : '本单费用总额' }}
            <strong>{{ costMoney(editorTotal) }}</strong></span
          >
          <div>
            <el-button :disabled="saving" @click="requestClose">取消</el-button
            ><el-button type="primary" :loading="saving" :disabled="uploadBusy" @click="save"
              >保存</el-button
            >
          </div>
        </div></template
      >
    </el-dialog>
    <el-dialog
      v-model="detailOpen"
      :title="logistics ? '物流运输记录详情' : '仓储费用详情'"
      width="min(1400px, 96vw)"
      top="3vh"
      class="cost-ledger-dialog"
      destroy-on-close
      ><CostLedgerDetail v-if="detail" :row="detail" :category="category" /><template #footer
        ><el-button @click="detailOpen = false">关闭</el-button></template
      ></el-dialog
    >
    <el-dialog v-model="historyOpen" title="操作记录" width="min(1100px, 94vw)"
      ><el-alert
        v-if="historyError"
        :title="historyError"
        type="error"
        :closable="false"
      /><el-table :data="audits" border
        ><el-table-column label="操作时间" width="200"
          ><template #default="{ row }">{{
            displayRecordDateTime(row.occurredTime)
          }}</template></el-table-column
        ><el-table-column label="操作"
          ><template #default="{ row }">{{ auditLabel(row.action) }}</template></el-table-column
        ><el-table-column label="操作人"
          ><template #default="{ row }">{{
            displayRecordActor(row.actorId)
          }}</template></el-table-column
        ><el-table-column prop="reason" label="原因" min-width="230" /><el-table-column
          label="快照"
          width="100"
          ><template #default="{ row }"
            ><el-button
              v-if="row.snapshot"
              link
              type="primary"
              @click="showSnapshot(row.snapshot as CostRecord)"
              >查看</el-button
            ></template
          ></el-table-column
        ></el-table
      ></el-dialog
    >
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getCosts,
  getCost,
  getCostCities,
  getCostEmployees,
  getCostHistory,
  changeCostStatus,
  type CostCategory,
  type CostQuery,
  type CostPage,
  type CostRecord,
  type CostEmployee,
  type CostAudit,
  type CostCommand,
} from '@/api/core/cost'
import { getLedgerParties, getLedgerExport } from '@/api/core/cost-ledger'
import { errorMessage } from '@/api/core/error'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { displayRecordActor, displayRecordDateTime } from '@/utils/business-display'
import {
  createLedgerCommand,
  receiverNames,
  partyName,
  newParty,
  newLogisticsFee,
  newWarehouseFee,
  previewWarehouseFee,
  totalFees,
  moneyCents,
} from './cost-ledger'
import { costLabel, costOptions, costMoney, loadCostDictionaries } from './cost-dictionaries'
import { auditLabel } from './cost-audit'
import { exportCostRows } from './cost-export'
import { CostAttachmentSaveSession, type CostAttachmentDraft } from './cost-attachment-draft'
import CostDictSelect from './CostDictSelect.vue'
import CostCitySelect from './CostCitySelect.vue'
import CostLedgerPartySelect from './CostLedgerPartySelect.vue'
import CostLedgerEditor from './CostLedgerEditor.vue'
import CostLedgerDetail from './CostLedgerDetail.vue'
import CostAttachmentEditor from './CostAttachmentEditor.vue'
import CostAttachments from './CostAttachments.vue'
const route = useRoute(),
  { can } = useSupplyPermissions()
const logistics = computed(() => route.path.endsWith('/logistics'))
const category = computed<CostCategory>(() => (logistics.value ? 'logistics' : 'warehouse-rentals'))
const permission = computed(() => (logistics.value ? 'order:logistics-cost' : 'erp:cost:rental'))
const title = computed(() => (logistics.value ? '物流运输记录' : '仓储费用'))
const empty = (): CostPage => ({ total: 0, begin: 0, step: 20, items: [] })
const result = ref<CostPage>(empty()),
  listReady = ref(false),
  filters = ref<Partial<CostQuery>>({}),
  dateRange = ref<string[]>([]),
  warehouseFilter = ref<string | null>(null)
const cityFilter = computed({
  get: () => filters.value.cityCode || '',
  set: (value: string) => {
    filters.value.cityCode = value
  },
})
const page = ref(1),
  step = ref(20),
  loading = ref(false),
  exporting = ref(false),
  error = ref(''),
  moreFilters = ref(false)
const cities = ref<{ code: string; name: string }[]>([]),
  employees = ref<CostEmployee[]>([])
const editorOpen = ref(false),
  editing = ref<CostRecord | null>(null),
  form = ref(createLedgerCommand(true)),
  saving = ref(false),
  saveError = ref(''),
  files = ref<CostAttachmentDraft[]>([]),
  uploadBusy = ref(false)
const detail = ref<CostRecord | null>(null),
  detailOpen = ref(false),
  historyOpen = ref(false),
  audits = ref<CostAudit[]>([]),
  historyError = ref('')
let generation = 0,
  interaction = 0,
  initialSignature = '',
  saveSession = new CostAttachmentSaveSession()
const pendingAmount = computed(
  () =>
    result.value.pendingAmount ??
    (result.value.registeredAmount != null && result.value.confirmedAmount != null
      ? result.value.registeredAmount - result.value.confirmedAmount
      : null),
)
const summaryMoney = (value: number | null | undefined) =>
  listReady.value && !loading.value && value != null ? `¥${costMoney(value)}` : '—'
const summaryCount = (value: number | null | undefined, unit: string) =>
  listReady.value && !loading.value && value != null ? `${value} ${unit}` : '—'
const sourceTypes = [
  { value: 'PURCHASE_ORDER', label: '采购单' },
  { value: 'TRANSFER_ORDER', label: '调拨单' },
  { value: 'SALES_ORDER', label: '销售单' },
  { value: 'OTHER_OUT', label: '其他出库单' },
]
const editorTotal = computed(() =>
  form.value.ledger
    ? form.value.ledger.feeItems.some((f) => f.ourAmount == null)
      ? null
      : Number(form.value.ledger.feeItems.reduce((n, f) => n + moneyCents(f.ourAmount!), 0n)) / 100
    : form.value.warehouseLedger
      ? totalFees(form.value.warehouseLedger.feeItems)
      : null,
)
const senderName = (row: CostRecord) =>
  row.data.ledger
    ? partyName(row.data.ledger.sender)
    : row.data.logistics?.senderName || row.sources[0]?.senderName || '—'
const carrier = (row: CostRecord) =>
  row.data.ledger
    ? row.data.ledger.deliveryModeCode === 'SELF'
      ? '自营'
      : row.data.ledger.carrierCode
        ? costLabel('COST_CARRIER', row.data.ledger.carrierCode)
        : '待补承运方'
    : row.data.logistics?.carrierName || '—'
const purpose = (row: CostRecord) =>
  costLabel(
    row.data.ledger ? 'COST_TRANSPORT_PURPOSE' : 'COST_LOGISTICS_LEG',
    row.data.ledger?.transportPurposeCode || row.data.logistics?.legCode,
  )
const sourceCodes = (row: CostRecord) =>
  row.data.ledger
    ? row.data.ledger.sources.map((s) => s.orderCode || '无关联单据')
    : row.sources.length
      ? row.sources.map((s) => s.documentNo)
      : [row.data.logistics?.externalDocumentNo || '—']
const warehouseFeeNames = (row: CostRecord) =>
  row.data.warehouseLedger
    ? [
        ...new Set(
          row.data.warehouseLedger.feeItems.map((f) =>
            costLabel('COST_WAREHOUSE_FEE_TYPE', f.feeTypeCode),
          ),
        ),
      ]
    : ['租金']
function servicePeriod(row: CostRecord) {
  const fees = row.data.warehouseLedger?.feeItems
  if (!fees)
    return row.data.rental?.leaseFrom
      ? `${row.data.rental.leaseFrom} 至 ${row.data.rental.leaseTo}`
      : '—'
  const dates = fees
    .flatMap((f) => [f.serviceFrom || f.attributionDate, f.serviceTo || f.attributionDate])
    .filter((v): v is string => !!v)
    .sort()
  return dates.length ? `${dates[0]} 至 ${dates[dates.length - 1]}` : '—'
}
function query(begin = (page.value - 1) * step.value, size = step.value): CostQuery {
  return {
    ...filters.value,
    begin,
    step: size,
    dateFrom: dateRange.value?.[0],
    dateTo: dateRange.value?.[1],
    warehouseCode: warehouseFilter.value || undefined,
  }
}
async function load() {
  const current = ++generation
  loading.value = true
  listReady.value = false
  error.value = ''
  try {
    const data = await getCosts(category.value, query())
    if (current === generation) {
      result.value = data
      listReady.value = true
    }
  } catch (e) {
    if (current === generation) {
      result.value = empty()
      error.value = errorMessage(e, '费用列表加载失败')
    }
  } finally {
    if (current === generation) loading.value = false
  }
}
function search() {
  page.value = 1
  void load()
}
function reset() {
  filters.value = {}
  dateRange.value = []
  warehouseFilter.value = null
  search()
}
let initialization = 0
async function init() {
  const current = ++initialization
  let listStarted = false
  ++generation
  ++interaction
  listReady.value = false
  loading.value = true
  const selectedCategory = category.value
  const selectedPermission = permission.value
  editorOpen.value = false
  detailOpen.value = false
  historyOpen.value = false
  result.value = empty()
  filters.value = {}
  page.value = 1
  dateRange.value = []
  warehouseFilter.value = null
  try {
    await loadCostDictionaries(selectedCategory)
    if (current !== initialization) return
    const [catalog, people] = await Promise.all([
      getCostCities(selectedPermission + ':read'),
      getCostEmployees(selectedCategory),
    ])
    if (current !== initialization) return
    cities.value = catalog
    employees.value = people
    listStarted = true
    await load()
    if (current !== initialization) return
    const id = route.query.sourceId || route.query.costId || route.query.id
    if (typeof id === 'string') await view({ id } as CostRecord)
  } catch (e) {
    if (current === initialization) error.value = errorMessage(e, '费用目录加载失败')
  } finally {
    if (current === initialization && !listStarted) loading.value = false
  }
}
watch(category, () => void init(), { immediate: true })
watch(
  () => route.query.sourceId,
  (id) => {
    if (typeof id === 'string') void view({ id } as CostRecord)
  },
)
async function view(row: CostRecord) {
  const current = ++interaction,
    selectedCategory = category.value
  try {
    const value = await getCost(selectedCategory, row.id)
    if (current !== interaction || selectedCategory !== category.value) return
    detail.value = value
    detailOpen.value = true
  } catch (e) {
    if (current === interaction) ElMessage.error(errorMessage(e, '详情加载失败'))
  }
}
async function edit(row?: CostRecord) {
  const token = ++interaction,
    selectedCategory = category.value,
    isLogistics = logistics.value
  try {
    const current = row ? await getCost(selectedCategory, row.id) : null
    if (token !== interaction || selectedCategory !== category.value) return
    const draft =
      current?.data.ledger || current?.data.warehouseLedger
        ? structuredClone(current.data)
        : createLedgerCommand(isLogistics)
    if (current) {
      draft.requestId = current.data.requestId
      draft.revision = current.revision
      draft.reason = ''
      if (!current.data.ledger && !current.data.warehouseLedger)
        await convertLegacy(current, draft, isLogistics)
    } else if (cities.value.length === 1) {
      draft.cityCode = cities.value[0]!.code
      draft.cityName = cities.value[0]!.name
      if (draft.ledger) draft.ledger.receivingPoints[0]!.cityCode = draft.cityCode
    }
    if (token !== interaction || selectedCategory !== category.value) return
    editing.value = current
    files.value = []
    saveError.value = ''
    saveSession = new CostAttachmentSaveSession()
    form.value = draft
    if (draft.warehouseLedger) draft.warehouseLedger.feeItems.forEach(previewWarehouseFee)
    initialSignature = JSON.stringify(form.value)
    editorOpen.value = true
  } catch (e) {
    if (token === interaction) ElMessage.error(errorMessage(e, '编辑信息加载失败'))
  }
}
async function convertLegacy(row: CostRecord, draft: CostCommand, isLogistics: boolean) {
  const old = row.data
  Object.assign(draft, {
    cityCode: old.cityCode,
    cityName: old.cityName,
    costDate: old.costDate,
    paymentStatusCode: old.paymentStatusCode,
    departmentId: old.departmentId,
    ownerEmployeeCode: old.ownerEmployeeCode,
    remark: old.remark,
  })
  if (isLogistics) {
    const p = draft.ledger!,
      l = old.logistics
    p.transportPurposeCode = l?.legCode || 'OTHER'
    p.costMonth = old.costMonth || old.costDate.slice(0, 7)
    p.trackingNo = l?.trackingNo || ''
    p.carrierCode =
      costOptions('COST_CARRIER').find((o) => o.label === l?.carrierName)?.value || null
    p.sender = {
      ...newParty(old.cityCode),
      partyTypeCode: 'OTHER',
      manualName: l?.senderName || row.sources[0]?.senderName || '',
      address: l?.originAddress || row.sources[0]?.originAddress || '',
    }
    p.receivingPoints = receiverNames(row).map((name) => ({
      ...newParty(old.cityCode),
      partyTypeCode: 'OTHER',
      manualName: name === '—' ? '' : name,
      address: l?.destinationAddress || '',
    }))
    const fee = newLogisticsFee()
    fee.feeAmount = old.amount
    fee.ourAmount = old.amount
    p.feeItems = [fee]
    p.sources = row.sources.map((s) => ({
      orderTypeCode:
        (
          {
            PURCHASE: 'PURCHASE_ORDER',
            TRANSFER: 'TRANSFER_ORDER',
            DELIVERY: 'SALES_ORDER',
          } as Record<string, string>
        )[s.sourceType] || s.sourceType,
      orderCode: s.documentNo,
      linkRoleCode: 'COST',
      allocations: [],
    }))
    if (!p.sources.length)
      p.sources.push({
        orderTypeCode: 'NONE',
        orderCode: null,
        linkRoleCode: 'COST',
        allocations: [],
        noSourceReason: old.logistics?.noSourceReason || '',
      })
    if (p.sources.length === 1)
      p.sources[0]!.allocations.push({
        feeKey: fee.feeKey,
        receivingPointCode: p.receivingPoints[0]!.pointCode,
        cityCode: old.cityCode,
        basis: null,
        amount: fee.ourAmount,
      })
  } else {
    const w = draft.warehouseLedger!,
      rental = old.rental
    if (rental?.warehouseId) {
      const refs = await getLedgerParties(false, 'WAREHOUSE', { id: String(rental.warehouseId) })
      w.warehouseCode = refs[0]?.code || null
    }
    w.contractNo = rental?.contractNo || ''
    w.depositAmount = rental?.deposit ?? null
    const fee = newWarehouseFee(old.costDate)
    fee.feeAmount = old.amount
    fee.attributionDate = old.costMonth ? `${old.costMonth}-01` : old.costDate
    w.feeItems = [fee]
    previewWarehouseFee(fee)
  }
}
function validateForm() {
  if (!form.value.cityCode && form.value.ledger?.receivingPoints[0]?.cityCode)
    form.value.cityCode = form.value.ledger.receivingPoints[0].cityCode
  form.value.cityName =
    cities.value.find((c) => c.code === form.value.cityCode)?.name || form.value.cityName
  if (!form.value.cityCode || !form.value.cityName) throw new Error('请选择费用归属城市')
  if (!form.value.costDate) throw new Error('请选择日期')
  if (!form.value.paymentStatusCode) throw new Error('请选择付款状态')
  if (form.value.warehouseLedger) form.value.warehouseLedger.feeItems.forEach(previewWarehouseFee)
  if (editing.value?.statusCode === 'CONFIRMED' && !form.value.reason.trim())
    throw new Error('请填写修改已确认费用的原因')
  form.value.amount = editorTotal.value
}
async function save() {
  if (saving.value || uploadBusy.value) return
  saveError.value = ''
  saving.value = true
  try {
    validateForm()
    const saved = await saveSession.save(
      category.value,
      editing.value?.id || null,
      form.value,
      files.value,
      (row) => {
        editing.value = row
        form.value.revision = row.revision
      },
    )
    initialSignature = JSON.stringify(form.value)
    editorOpen.value = false
    ElMessage.success(
      saved.statusCode === 'CONFIRMED' ? '费用已更新，保持已确认状态' : '费用已保存，待确认',
    )
    await load()
    if (detail.value?.id === saved.id) detail.value = saved
  } catch (e) {
    saveError.value = errorMessage(e, '费用保存失败，请核对填写内容')
  } finally {
    saving.value = false
  }
}
async function act(row: CostRecord, action: 'confirm' | 'void') {
  const current = ++interaction,
    selectedCategory = category.value
  try {
    let reason = ''
    if (action === 'void') {
      const input = await ElMessageBox.prompt(
        '请填写作废原因，原始记录和附件将保留。',
        '作废费用',
        { inputValidator: (value) => !!value?.trim() || '请填写作废原因' },
      )
      reason = input.value.trim()
    } else
      await ElMessageBox.confirm(
        '确认后计入正式费用统计，请核对费用承担方、收货信息和分摊金额。',
        '确认费用',
        { type: 'warning' },
      )
    if (current !== interaction || selectedCategory !== category.value) return
    await changeCostStatus(selectedCategory, row, action, reason)
    if (current !== interaction || selectedCategory !== category.value) return
    ElMessage.success(action === 'confirm' ? '费用已确认' : '费用已作废')
    await load()
  } catch (e) {
    if (current === interaction && e !== 'cancel' && e !== 'close')
      ElMessage.error(errorMessage(e, '操作失败，请刷新后重试'))
  }
}
function showSnapshot(row: CostRecord) {
  ++interaction
  detail.value = row
  detailOpen.value = true
}
async function history(row: CostRecord) {
  const current = ++interaction,
    selectedCategory = category.value
  audits.value = []
  historyError.value = ''
  historyOpen.value = true
  try {
    const values = await getCostHistory(selectedCategory, row.id)
    if (current === interaction && selectedCategory === category.value) audits.value = values
  } catch (e) {
    if (current === interaction) historyError.value = errorMessage(e, '操作记录加载失败')
  }
}
async function allowClose() {
  if (saving.value || uploadBusy.value) return false
  if (
    editorOpen.value &&
    (JSON.stringify(form.value) !== initialSignature ||
      files.value.some((f) => f.status !== 'uploaded'))
  ) {
    try {
      await ElMessageBox.confirm('当前内容或附件尚未全部保存，确认关闭？', '关闭编辑', {
        type: 'warning',
      })
      return true
    } catch {
      return false
    }
  }
  return true
}
async function beforeClose(done: () => void) {
  if (await allowClose()) done()
}
async function requestClose() {
  if (await allowClose()) editorOpen.value = false
}
onBeforeRouteLeave(allowClose)
onBeforeRouteUpdate(allowClose)
onBeforeUnmount(() => {
  ++initialization
  ++generation
  ++interaction
})
async function exportRows() {
  exporting.value = true
  const isLogistics = logistics.value,
    exportTitle = title.value,
    conditions = query(0, 200)
  try {
    const rows: CostRecord[] = [],
      ids = new Set<string>()
    let expected: number | null = null
    for (let begin = 0; ; begin += 200) {
      const data = await getLedgerExport(isLogistics, { ...conditions, begin })
      if (expected == null) expected = data.total
      if (expected !== data.total) throw new Error('导出期间数据已变化，请重新导出')
      for (const row of data.items) {
        if (ids.has(row.id)) throw new Error('导出期间数据已变化，请重新导出')
        ids.add(row.id)
        rows.push(row)
      }
      if (rows.length > expected) throw new Error('导出期间数据已变化，请重新导出')
      if (rows.length === expected) break
      if (!data.items.length || rows.length >= 20000)
        throw new Error('导出结果过多或已变化，请缩小筛选范围')
    }
    const headers = isLogistics
      ? [
          '费用单号',
          '运输用途',
          '运输日期',
          '发货方',
          '收货方',
          '物流公司',
          '运单号',
          '关联单据',
          '本单我方费用（元）',
          '单据状态',
          '创建人',
        ]
      : [
          '费用单号',
          '仓库',
          '服务期间',
          '费用项目',
          '本单费用总额（元）',
          '筛选期归属费用（元）',
          '单据状态',
          '创建人',
        ]
    await exportCostRows(
      exportTitle,
      headers,
      rows.map((r) =>
        isLogistics
          ? [
              r.documentNo,
              purpose(r),
              r.data.costDate,
              senderName(r),
              receiverNames(r).join('\n'),
              carrier(r),
              r.data.ledger?.trackingNo || r.data.logistics?.trackingNo || '',
              sourceCodes(r).join('\n'),
              r.data.amount,
              costLabel('COST_STATUS', r.statusCode),
              displayRecordActor(r.createdBy),
            ]
          : [
              r.documentNo,
              r.warehouseName,
              servicePeriod(r),
              warehouseFeeNames(r).join('\n'),
              r.data.amount,
              r.periodAmount === undefined ? r.data.amount : r.periodAmount,
              costLabel('COST_STATUS', r.statusCode),
              displayRecordActor(r.createdBy),
            ],
      ),
    )
  } catch (e) {
    ElMessage.error(errorMessage(e, '导出失败'))
  } finally {
    exporting.value = false
  }
}
</script>
<style scoped>
.ledger-workspace {
  padding: 16px;
  background: #f5f7fb;
  min-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.filter-panel,
.list-panel {
  background: #fff;
  border: 1px solid #dce4ee;
  border-radius: 9px;
  overflow: hidden;
}
.filter-panel {
  padding: 20px 22px;
}
.filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 24px;
}
.filters :deep(.el-form-item) {
  margin-bottom: 14px;
}
.filters :deep(.el-select),
.filters :deep(.el-date-editor) {
  width: 100%;
}
.filter-actions,
.list-toolbar,
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.list-toolbar {
  padding: 18px 22px;
  border-bottom: 1px solid #e1e7f0;
}
.list-toolbar strong {
  font-size: 17px;
}
.count {
  color: #2862ec;
  background: #eef4ff;
  padding: 3px 10px;
  margin-left: 12px;
  border-radius: 20px;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  padding: 20px 22px;
}
.metric {
  border: 1px solid #dce3ed;
  border-top: 4px solid #8396af;
  background: #f7f9fc;
  border-radius: 8px;
  padding: 16px 19px;
  min-width: 0;
}
.metric span {
  display: block;
  color: #6d7f99;
}
.metric strong {
  display: block;
  font-size: 27px;
  line-height: 1.4;
  margin-top: 10px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.metric.primary {
  border-top-color: #2862ec;
  background: #f4f7ff;
}
.metric.primary strong {
  color: #2862ec;
}
.metric.green {
  border-top-color: #078263;
  background: #f2f8f5;
}
.metric.green strong {
  color: #078263;
}
.metric.amber {
  border-top-color: #b66c19;
}
.pagination {
  padding: 17px 22px;
}
.source-warning {
  color: var(--el-color-warning);
  font-size: 13px;
}
.muted {
  font-size: 13px;
  color: #718198;
}
.recipient-names {
  display: grid;
  gap: 5px;
}
.recipient-names > div {
  white-space: normal;
  overflow-wrap: anywhere;
}
.nowrap,
.code-link {
  white-space: nowrap;
  word-break: keep-all;
}
.ledger-table :deep(.cell) {
  word-break: normal;
}
.ledger-table :deep(.el-table__cell) {
  padding: 12px 0;
}
.editor-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.editor-footer strong {
  color: #2862ec;
  font-size: 23px;
  margin-left: 12px;
}
.attachment-panel {
  background: white;
  border: 1px solid #dce4ee;
  border-radius: 8px;
  padding: 22px;
}
:deep(.cost-ledger-dialog .el-dialog__body) {
  max-height: calc(94vh - 150px);
  overflow: auto;
  background: #f5f7fb;
  padding: 20px;
}
:deep(.cost-ledger-dialog .el-dialog__footer) {
  border-top: 1px solid #dce4ee;
}
@media (max-width: 1100px) {
  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 650px) {
  .filters,
  .metrics {
    grid-template-columns: 1fr;
  }
  .ledger-workspace {
    padding: 10px;
  }
  .pagination,
  .list-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
