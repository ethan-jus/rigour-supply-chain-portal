<template>
  <div class="purchase-costs">
    <section class="panel">
      <el-form class="filters" label-position="top" @submit.prevent="search">
        <el-form-item label="采购单号"
          ><el-input v-model="filters.procurementNo" clearable @keyup.enter="search"
        /></el-form-item>
        <el-form-item label="供应商"
          ><el-input v-model="filters.supplierName" clearable @keyup.enter="search"
        /></el-form-item>
        <el-form-item label="运费状态"
          ><el-select v-model="filters.freightStatus" clearable
            ><el-option label="待确认" value="PENDING" /><el-option
              label="已确认"
              value="CONFIRMED" /></el-select
        ></el-form-item>
        <el-form-item label="采购日期"
          ><el-date-picker
            v-model="dates"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始日期"
            end-placeholder="截止日期"
        /></el-form-item>
      </el-form>
      <div class="actions">
        <el-button @click="reset">重置</el-button
        ><el-button type="primary" :loading="loading" @click="search">查询</el-button>
      </div>
    </section>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <section class="panel list-panel">
      <div class="toolbar">
        <strong
          >采购成本记录 <span>{{ result.total }} 条</span></strong
        >
        <div class="actions">
          <el-button
            v-if="can('erp:cost:purchase:export')"
            :loading="exporting"
            :disabled="loading || !!error"
            @click="openExport"
            >自定义导出</el-button
          ><el-button :loading="loading" @click="load">刷新</el-button>
        </div>
      </div>
      <div v-if="selectedRows.length" class="actions">
        <span>已勾选 {{ selectedRows.length }} 条</span
        ><el-button link :disabled="exporting" @click="clearSelection">取消勾选</el-button>
      </div>
      <el-table
        ref="exportTable"
        row-key="procurementNo"
        @selection-change="selectedRows = $event"
        :data="result.items"
        v-loading="loading"
        border
        empty-text="暂无符合条件的已确认采购单"
      >
        <el-table-column
          v-if="can('erp:cost:purchase:export')"
          type="selection"
          reserve-selection
          fixed="left"
          width="44"
          :selectable="() => !exporting"
        />
        <el-table-column prop="procurementNo" label="采购单号" width="220" fixed="left"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="view(row as ProcurementCostRecord)">{{
              row.procurementNo
            }}</el-button></template
          ></el-table-column
        >
        <el-table-column label="订货宝单号" width="190" show-overflow-tooltip
          ><template #default="{ row }">{{
            row.sourceSystemCode === 'DINGHUOBAO' ? row.sourceDocumentNo || '来源未提供' : '—'
          }}</template></el-table-column
        >
        <el-table-column prop="supplierName" label="供应商" min-width="220" show-overflow-tooltip />
        <el-table-column prop="purchaseDate" label="采购日期" width="130" />
        <el-table-column prop="warehouseName" label="收货仓库" min-width="160" />
        <el-table-column label="货款（元）" width="155" align="right"
          ><template #default="{ row }">{{
            money(row.goodsAmount, '-')
          }}</template></el-table-column
        >
        <el-table-column label="采购单约定运费（元）" width="180" align="right"
          ><template #default="{ row }">{{
            money(row.agreedFreightAmount, '-')
          }}</template></el-table-column
        >
        <el-table-column label="实际我方运费（元）" width="180" align="right"
          ><template #default="{ row }">{{
            money(row.actualFreightAmount)
          }}</template></el-table-column
        >
        <el-table-column label="运费状态" width="120"
          ><template #default="{ row }"
            ><el-tag
              :type="
                row.freightStatus === 'CONFIRMED'
                  ? 'success'
                  : row.freightStatus === 'VOID'
                    ? 'info'
                    : 'warning'
              "
              >{{
                row.freightStatus === 'CONFIRMED'
                  ? '已确认'
                  : row.freightStatus === 'VOID'
                    ? '已作废'
                    : '待确认'
              }}</el-tag
            ></template
          ></el-table-column
        >
        <el-table-column label="已明确成本（元）" width="180" align="right"
          ><template #default="{ row }"
            ><strong>{{ money(row.confirmedAmount, '-') }}</strong></template
          ></el-table-column
        >
        <el-table-column label="操作" fixed="right" width="290"
          ><template #default="{ row }">
            <el-button link type="primary" @click="view(row as ProcurementCostRecord)"
              >查看</el-button
            >
            <el-button
              v-if="row.freightStatus === 'PENDING' && can('erp:cost:purchase:write')"
              link
              type="primary"
              @click="review(row as ProcurementCostRecord, true)"
              >编辑</el-button
            >
            <el-button
              v-if="row.freightStatus === 'PENDING' && canConfirm"
              link
              type="primary"
              @click="review(row as ProcurementCostRecord)"
              >确认</el-button
            >
            <el-button
              v-if="row.freightRecordStatus === 'DRAFT' && can('erp:cost:purchase:void')"
              link
              type="danger"
              @click="freightAction(row as ProcurementCostRecord, 'void')"
              >作废</el-button
            >
            <el-button
              v-if="row.freightRecordStatus === 'CONFIRMED' && can('erp:cost:purchase:confirm')"
              link
              type="primary"
              @click="freightAction(row as ProcurementCostRecord, 'revoke')"
              >撤销</el-button
            >
            <el-button
              v-if="row.freightRecordStatus === 'VOID' && can('erp:cost:purchase:void')"
              link
              type="danger"
              @click="freightAction(row as ProcurementCostRecord, 'delete')"
              >删除</el-button
            >
          </template></el-table-column
        >
      </el-table>
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="step"
        :total="result.total"
        :page-sizes="[20, 50, 100]"
        layout="total,sizes,prev,pager,next"
        @current-change="load"
        @size-change="search"
      />
    </section>
    <el-dialog v-model="detailOpen" title="采购成本详情" width="min(1100px,94vw)" destroy-on-close>
      <template v-if="detail">
        <el-descriptions :column="3" border
          ><el-descriptions-item label="采购单号">{{ detail.procurementNo }}</el-descriptions-item
          ><el-descriptions-item
            v-if="detail.sourceSystemCode === 'DINGHUOBAO'"
            label="订货宝单号"
            >{{ detail.sourceDocumentNo || '来源未提供' }}</el-descriptions-item
          ><el-descriptions-item label="供应商">{{ detail.supplierName }}</el-descriptions-item
          ><el-descriptions-item label="收货仓库">{{ detail.warehouseName }}</el-descriptions-item
          ><el-descriptions-item
            :label="detail.sourceSystemCode === 'DINGHUOBAO' ? '折后货款（元）' : '采购货款（元）'"
            >{{ money(detail.goodsAmount, '-') }}</el-descriptions-item
          ><el-descriptions-item
            v-if="
              detail.sourceSystemCode === 'DINGHUOBAO' && detail.goodsSource?.linesAmount != null
            "
            label="折前商品金额（元）"
            >{{ money(detail.goodsSource.linesAmount, '-') }}</el-descriptions-item
          ><el-descriptions-item label="采购单约定运费（元）">{{
            money(detail.agreedFreightAmount, '-')
          }}</el-descriptions-item
          ><el-descriptions-item label="实际我方运费（元）">{{
            money(detail.actualFreightAmount)
          }}</el-descriptions-item></el-descriptions
        >
        <el-alert
          v-if="detail.goodsSource?.issue"
          :title="sourceIssueDescription(detail)"
          type="warning"
          :closable="false"
          class="source-warning"
        />
        <h3>采购商品</h3>
        <el-table :data="detail.lines" border
          ><el-table-column prop="productName" label="商品名称" min-width="200" /><el-table-column
            prop="variantCode"
            label="SKU编码"
            min-width="180"
          /><el-table-column label="单位" width="90"
            ><template #default="{ row }">{{
              costLabel('PRODUCT_UNIT', row.unitCode)
            }}</template></el-table-column
          ><el-table-column prop="quantity" label="数量" width="100" /><el-table-column
            label="单价（元）"
            align="right"
            ><template #default="{ row }">{{
              money(row.unitPrice, '-')
            }}</template></el-table-column
          ><el-table-column
            :label="detail.sourceSystemCode === 'DINGHUOBAO' ? '折前小计（元）' : '采购小计（元）'"
            align="right"
            ><template #default="{ row }">{{ money(row.amount, '-') }}</template></el-table-column
          ></el-table
        >
      </template>
      <template #footer
        ><el-button v-if="detail" @click="history(detail)">操作记录</el-button
        ><el-button @click="detailOpen = false">关闭</el-button></template
      >
    </el-dialog>
    <el-dialog
      v-model="reviewOpen"
      :title="draftMode ? '编辑采购实际运费' : '确认采购实际运费'"
      width="min(660px,94vw)"
      :close-on-click-modal="false"
      :show-close="!saving"
      :close-on-press-escape="!saving"
    >
      <el-alert v-if="saveError" :title="saveError" type="error" :closable="false" />
      <el-descriptions v-if="reviewing" :column="2" border class="freight-reference">
        <el-descriptions-item label="采购单号">{{ reviewing.procurementNo }}</el-descriptions-item>
        <el-descriptions-item label="供应商">{{ reviewing.supplierName }}</el-descriptions-item>
        <el-descriptions-item
          v-if="reviewing.sourceSystemCode === 'DINGHUOBAO'"
          label="订货宝单号"
          >{{ reviewing.sourceDocumentNo || '来源未提供' }}</el-descriptions-item
        >
        <el-descriptions-item label="采购单约定运费（元）">{{
          money(reviewing.agreedFreightAmount, '-')
        }}</el-descriptions-item>
        <el-descriptions-item label="运费承担方">{{
          costLabel('PURCHASE_FREIGHT_BEARER', reviewing.freightBearerCode)
        }}</el-descriptions-item>
      </el-descriptions>
      <el-descriptions v-if="previousConfirmation" :column="1" border class="previous-confirmation">
        <el-descriptions-item label="上次确认说明">{{
          previousConfirmation.data.reason || '-'
        }}</el-descriptions-item>
      </el-descriptions>
      <el-form label-position="top">
        <el-form-item label="实际我方运费（元）" required
          ><el-input-number
            v-model="confirmation.actualAmount"
            :min="0"
            :precision="2"
            :controls="false"
            aria-label="实际我方运费"
          /><span class="hint"
            >包邮、报价含运费或无我方额外支出时填 0，并写明依据。</span
          ></el-form-item
        >
        <el-form-item label="费用发生日期" required
          ><el-date-picker v-model="confirmation.costDate" type="date" value-format="YYYY-MM-DD"
        /></el-form-item>
        <el-form-item label="付款状态" required
          ><el-select v-model="confirmation.paymentStatusCode"
            ><el-option label="未知" value="UNKNOWN" /><el-option
              label="未付款"
              value="UNPAID" /><el-option label="已付款" value="PAID" /></el-select
        ></el-form-item>
        <el-form-item label="确认或更正说明" required
          ><el-input
            v-model="confirmation.reason"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            placeholder="填写实际金额的确认依据；更正时说明原因"
        /></el-form-item>
      </el-form>
      <template #footer
        ><el-button :disabled="saving" @click="reviewOpen = false">取消</el-button
        ><el-button type="primary" :loading="saving" @click="confirmFreight">{{
          draftMode ? '保存' : '确认并计入采购成本'
        }}</el-button></template
      >
    </el-dialog>
    <el-dialog v-model="historyOpen" title="采购运费操作记录" width="min(1100px,94vw)"
      ><el-table :data="audits" border
        ><el-table-column label="时间" width="190"
          ><template #default="{ row }">{{
            displayRecordDateTime(row.occurredTime)
          }}</template></el-table-column
        ><el-table-column label="操作" width="140"
          ><template #default="{ row }">{{ auditLabel(row.action) }}</template></el-table-column
        ><el-table-column label="操作人" width="150"
          ><template #default="{ row }">{{
            displayRecordActor(row.actorId)
          }}</template></el-table-column
        ><el-table-column label="运费单号" width="220"
          ><template #default="{ row }">{{
            row.snapshot?.documentNo || '—'
          }}</template></el-table-column
        >
        <el-table-column label="金额（元）" width="150" align="right"
          ><template #default="{ row }">{{
            money(row.snapshot?.data.amount)
          }}</template></el-table-column
        >
        <el-table-column prop="reason" label="说明" /></el-table
    ></el-dialog>
    <el-dialog
      v-model="legacyOpen"
      title="历史采购成本原单"
      width="min(1000px,94vw)"
      destroy-on-close
    >
      <template v-if="legacy"
        ><el-descriptions :column="2" border
          ><el-descriptions-item
            v-for="field in costSnapshotFields(legacy)"
            :key="field.label"
            :label="field.label"
            >{{ field.value }}</el-descriptions-item
          ></el-descriptions
        >
        <CostAttachments category="purchases" :row="legacy" :editable="false" />
      </template>
    </el-dialog>
  </div>
  <CostExportDialog
    v-model="exportOpen"
    v-model:fields="exportFields"
    :columns="exportColumns"
    :scope="
      exportIds.length ? `已勾选的 ${exportIds.length} 条记录` : `全部筛选结果（${exportTotal} 条）`
    "
    :busy="exporting"
    :error="exportError"
    :empty="!exportIds.length && !exportTotal"
    @confirm="exportRows"
  />
</template>
<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getProcurementCosts,
  getProcurementCost,
  getProcurementCostHistory,
  confirmProcurementFreight,
  saveProcurementFreightDraft,
  type ProcurementCostRecord,
  type ProcurementFreightConfirmation,
} from '@/api/core/procurement-costs'
import { getCost, changeCostStatus, type CostAudit, type CostRecord } from '@/api/core/cost'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import { errorMessage } from '@/api/core/error'
import { randomId } from '@/utils/random-id'
import { displayRecordActor, displayRecordDateTime } from '@/utils/business-display'
import { costLabel, costMoney, loadCostDictionaries } from './cost-dictionaries'
import { auditLabel, costSnapshotFields } from './cost-audit'
import { exportCostRows } from './cost-export'
import CostExportDialog from './CostExportDialog.vue'
import { collectCostExportRows, selectedCostColumns } from './custom-cost-export'
import type { TableInstance } from 'element-plus'
import CostAttachments from './CostAttachments.vue'
const route = useRoute()
const { can } = useSupplyPermissions()
const canConfirm = computed(
  () => can('erp:cost:purchase:write') && can('erp:cost:purchase:confirm'),
)
const filters = ref({ procurementNo: '', supplierName: '', freightStatus: '' }),
  dates = ref<string[]>([]),
  page = ref(1),
  step = ref(20)
const result = ref({ total: 0, begin: 0, step: 20, items: [] as ProcurementCostRecord[] }),
  loading = ref(false),
  error = ref('')
const applied = ref<Record<string, string | undefined>>({})
const exporting = ref(false)
const legacy = ref<CostRecord | null>(null),
  legacyOpen = ref(false)
const detail = ref<ProcurementCostRecord | null>(null),
  detailOpen = ref(false),
  reviewing = ref<ProcurementCostRecord | null>(null),
  reviewOpen = ref(false),
  saving = ref(false),
  saveError = ref('')
const historyOpen = ref(false),
  audits = ref<CostAudit[]>([])
const previousConfirmation = ref<CostRecord | null>(null)
const freshConfirmation = (): ProcurementFreightConfirmation => ({
  requestId: randomId(),
  orderRevision: 0,
  freightRevision: null,
  freightRecordId: null,
  costDate: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }),
  actualAmount: null,
  paymentStatusCode: 'UNKNOWN',
  reason: '',
})
const confirmation = ref(freshConfirmation())
const money = (value: number | null | undefined, missing = '-') =>
  value == null ? missing : costMoney(value)
const sourceIssueDescription = (row: ProcurementCostRecord) =>
  row.goodsSource?.issue === 'AMOUNT_MISMATCH'
    ? `采购单货款 ${money(row.goodsSource.orderAmount, '-')} 元与商品合计 ${money(row.goodsSource.linesAmount, '-')} 元不一致，请检查采购订单。`
    : '采购单缺少有效货款或商品明细，请完善采购订单。'
let serial = 0,
  interaction = 0
async function load() {
  const current = ++serial
  loading.value = true
  error.value = ''
  try {
    const data = await getProcurementCosts({
      begin: (page.value - 1) * step.value,
      step: step.value,
      ...applied.value,
    })
    if (current === serial) result.value = data
  } catch (e) {
    if (current === serial) {
      result.value = { total: 0, begin: 0, step: step.value, items: [] }
      error.value = errorMessage(e, '采购成本加载失败')
    }
  } finally {
    if (current === serial) loading.value = false
  }
}
function search() {
  clearSelection()
  exportOpen.value = false
  applied.value = {
    procurementNo: filters.value.procurementNo.trim() || undefined,
    supplierName: filters.value.supplierName.trim() || undefined,
    freightStatus: filters.value.freightStatus || undefined,
    dateFrom: dates.value?.[0],
    dateTo: dates.value?.[1],
  }
  page.value = 1
  void load()
}
function reset() {
  filters.value = { procurementNo: '', supplierName: '', freightStatus: '' }
  dates.value = []
  search()
}
async function view(row: ProcurementCostRecord) {
  const token = ++interaction
  try {
    const data = await getProcurementCost(row.procurementNo)
    if (token === interaction) {
      detail.value = data
      detailOpen.value = true
    }
  } catch (e) {
    if (token === interaction) ElMessage.error(errorMessage(e, '详情加载失败'))
  }
}
const draftMode = ref(false)
async function review(row: ProcurementCostRecord, draft = false) {
  draftMode.value = draft
  const token = ++interaction
  try {
    const data = await getProcurementCost(row.procurementNo)
    const previous = data.freightRecordId ? await getCost('purchases', data.freightRecordId) : null
    if (token !== interaction) return
    if (
      data.freightStatus !== 'PENDING' ||
      (previous && (previous.statusCode !== 'DRAFT' || previous.revision !== data.freightRevision))
    )
      throw new Error('只有待确认运费可编辑或确认，已确认运费请先撤销')
    reviewing.value = data
    previousConfirmation.value = previous
    const fresh = freshConfirmation()
    confirmation.value = {
      ...fresh,
      orderRevision: data.orderRevision,
      freightRevision: data.freightRevision,
      freightRecordId: data.freightRecordId,
      actualAmount: previous?.data.amount ?? data.actualFreightAmount,
      costDate: previous?.data.costDate || fresh.costDate,
      paymentStatusCode: previous?.data.paymentStatusCode || 'UNKNOWN',
    }
    saveError.value = ''
    reviewOpen.value = true
  } catch (e) {
    if (token === interaction) ElMessage.error(errorMessage(e, '采购成本加载失败'))
  }
}
async function confirmFreight() {
  if (
    saving.value ||
    !reviewing.value ||
    !(draftMode.value ? can('erp:cost:purchase:write') : canConfirm.value)
  )
    return
  saveError.value = ''
  if (
    confirmation.value.actualAmount == null ||
    !confirmation.value.costDate ||
    !confirmation.value.reason.trim() ||
    !confirmation.value.paymentStatusCode
  ) {
    saveError.value = '请填写实际我方运费、费用发生日期和确认说明'
    return
  }
  const token = interaction
  saving.value = true
  try {
    await (draftMode.value ? saveProcurementFreightDraft : confirmProcurementFreight)(
      reviewing.value.procurementNo,
      confirmation.value,
    )
    if (token !== interaction) return
    reviewOpen.value = false
    ElMessage.success(draftMode.value ? '实际运费已保存，待确认' : '实际运费已确认并计入采购成本')
    await load()
  } catch (e) {
    if (token === interaction) saveError.value = errorMessage(e, '运费确认失败')
  } finally {
    saving.value = false
  }
}
async function history(row: ProcurementCostRecord) {
  const token = ++interaction
  try {
    const data = await getProcurementCostHistory(row.procurementNo)
    if (token === interaction) {
      // 首次确认同一事务先建档再确认；业务记录只展示确认，完整底层审计仍由接口保留。
      const key = (audit: CostAudit) =>
        audit.snapshot?.id && audit.snapshot.data.requestId
          ? JSON.stringify([
              audit.snapshot.id,
              audit.snapshot.data.requestId,
              audit.actorId,
              audit.reason,
            ])
          : null
      const confirmed = new Set(
        data
          .filter((audit) => audit.action === 'CONFIRM')
          .map(key)
          .filter(Boolean),
      )
      audits.value = data.filter(
        (audit) => audit.action !== 'CREATE' || !key(audit) || !confirmed.has(key(audit)),
      )
      historyOpen.value = true
    }
  } catch (e) {
    if (token === interaction) ElMessage.error(errorMessage(e, '记录加载失败'))
  }
}
async function freightAction(row: ProcurementCostRecord, action: 'void' | 'revoke' | 'delete') {
  if (!row.freightRecordId) return
  const token = ++interaction
  try {
    const answer = await ElMessageBox.prompt(
      {
        void: '作废后仅可查看或删除，请填写原因。',
        revoke: '撤销后回到待确认，实际运费不再计入已确认成本，请填写原因。',
        delete: '删除已作废的实际运费，采购原单及历史记录保留，请填写原因。',
      }[action],
      { void: '作废采购运费', revoke: '撤销采购运费确认', delete: '删除采购运费' }[action],
      { inputValidator: (value) => !!value?.trim() || '请填写操作原因' },
    )
    if (token !== interaction) return
    const cost = await getCost('purchases', row.freightRecordId)
    if (token !== interaction) return
    if (cost.revision !== row.freightRevision) throw new Error('实际运费已变化，请刷新后重新作废')
    await changeCostStatus('purchases', cost, action, answer.value.trim())
    if (token !== interaction) return
    await load()
  } catch (e) {
    if (token === interaction && e !== 'cancel' && e !== 'close')
      ElMessage.error(errorMessage(e, '作废失败'))
  }
}
const exportOpen = ref(false),
  exportFields = ref<string[]>([]),
  exportIds = ref<string[]>([]),
  exportError = ref(''),
  exportTotal = ref(0),
  selectedRows = ref<ProcurementCostRecord[]>([]),
  exportTable = ref<TableInstance>()
const exportColumns = [
  '采购单号',
  '订货宝单号',
  '供应商',
  '采购日期',
  '收货仓库',
  '货款（元）',
  '采购单约定运费（元）',
  '实际我方运费（元）',
  '运费状态',
  '已明确成本（元）',
].map((label, index) => ({ key: String(index), label }))
let exportQuery: Record<string, string | undefined> = {},
  exportVersion = 0
function clearSelection() {
  exportTable.value?.clearSelection()
  selectedRows.value = []
}
function openExport() {
  if (loading.value || error.value || !can('erp:cost:purchase:export')) return
  exportQuery = { ...applied.value }
  exportVersion = serial
  exportIds.value = [...new Set(selectedRows.value.map((row) => row.procurementNo))]
  exportTotal.value = result.value.total
  exportFields.value = exportColumns.map((column) => column.key)
  exportError.value = ''
  exportOpen.value = true
}
async function exportRows() {
  if (exporting.value || !can('erp:cost:purchase:export')) return
  const version = exportVersion,
    query = { ...exportQuery }
  exporting.value = true
  exportError.value = ''
  try {
    const columns = selectedCostColumns(exportColumns, exportFields.value)
    const rows = await collectCostExportRows({
      fetchPage: (begin, step) => getProcurementCosts({ ...query, begin, step }),
      key: (row) => row.procurementNo,
      selected: [...exportIds.value],
      current: () => serial === version,
    })
    if (!rows) return
    const value = (amount: number | null) => (amount == null ? '-' : amount)
    await exportCostRows(
      '采购成本记录',
      columns.map((c) => c.label),
      rows.map((row) => {
        const values = [
          row.procurementNo,
          row.sourceSystemCode === 'DINGHUOBAO' ? row.sourceDocumentNo || '来源未提供' : '—',
          row.supplierName,
          row.purchaseDate,
          row.warehouseName,
          value(row.goodsAmount),
          value(row.agreedFreightAmount),
          value(row.actualFreightAmount),
          row.freightStatus === 'CONFIRMED'
            ? '已确认'
            : row.freightStatus === 'VOID'
              ? '已作废'
              : '待确认',
          value(row.confirmedAmount),
        ]
        return columns.map((c) => values[Number(c.key)])
      }),
    )
    if (serial === version) exportOpen.value = false
  } catch (e) {
    if (serial === version) exportError.value = errorMessage(e, '导出失败')
  } finally {
    exporting.value = false
  }
}

watch(
  () => route.query.sourceId || route.query.costId || route.query.id,
  async (id, _old, cleanup) => {
    let active = true
    cleanup(() => {
      active = false
    })
    if (typeof id !== 'string') return
    try {
      const row = await getCost('purchases', id)
      if (!active) return
      const code =
        row.procurementReference?.orderCode ||
        (row.data.typeCode === 'PROCUREMENT_FREIGHT' ? row.sources[0]?.documentNo : null)
      if (code) {
        const data = await getProcurementCost(code)
        if (active) {
          detail.value = data
          detailOpen.value = true
        }
      } else {
        legacy.value = row
        legacyOpen.value = true
      }
    } catch (e) {
      if (active) ElMessage.error(errorMessage(e, '原单不存在或当前无访问权限'))
    }
  },
  { immediate: true },
)
onMounted(() => {
  void loadCostDictionaries('purchases').catch(() => {})
  void load()
})
onBeforeUnmount(() => {
  ++serial
  ++interaction
})
</script>
<style scoped>
.previous-confirmation {
  margin-bottom: 16px;
}
.purchase-costs {
  display: grid;
  gap: 18px;
  padding: 20px;
  background: var(--el-fill-color-light);
  min-width: 0;
}
.panel {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 20px;
  min-width: 0;
}
.freight-reference,
.source-warning {
  margin-bottom: 16px;
}
.filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0 20px;
}
.filters :deep(.el-select),
.filters :deep(.el-date-editor) {
  width: 100%;
}
.actions,
.toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}
.toolbar {
  justify-content: space-between;
  margin-bottom: 15px;
}
.toolbar span,
.hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 400;
}
.hint {
  line-height: 1.7;
}
.list-panel :deep(.el-pagination) {
  justify-content: flex-end;
  margin-top: 20px;
}
.purchase-costs :deep(.el-input-number) {
  width: 100%;
}
.purchase-costs :deep(.el-form-item .hint) {
  display: block;
  width: 100%;
  margin-top: 5px;
}
@media (max-width: 1100px) {
  .filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 650px) {
  .filters {
    grid-template-columns: 1fr;
  }
  .purchase-costs {
    padding: 12px;
  }
}
</style>
