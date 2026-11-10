<template>
  <section class="carrier-panel">
    <el-form inline class="source-filters" @submit.prevent="search"
      ><el-form-item label="货拉拉订单号"
        ><el-input
          v-model="orderNo"
          placeholder="输入货拉拉订单号"
          clearable
          @keyup.enter="search" /></el-form-item
      ><el-form-item label="关联情况"
        ><el-select v-model="state" clearable placeholder="全部"
          ><el-option label="待关联" value="UNMATCHED" /><el-option
            label="已生成运输记录"
            value="GENERATED" /></el-select></el-form-item
      ><el-button type="primary" :loading="busy" @click="search">查询</el-button
      ><el-button @click="resetSearch">重置</el-button></el-form
    >
    <div class="source-toolbar">
      <strong
        >{{ differencesOnly ? '来源差异' : '货拉拉待关联' }}
        <span class="muted">本页 {{ rows.length }} 条</span></strong
      >
      <div>
        <el-button :disabled="busy" @click="downloadTemplate">下载导入模板</el-button
        ><el-upload accept=".xlsx" :show-file-list="false" :before-upload="upload" :disabled="busy"
          ><el-button type="primary" plain :loading="busy">导入 Excel 报表</el-button></el-upload
        ><el-button :disabled="busy" @click="load">刷新</el-button>
      </div>
    </div>
    <el-alert v-if="error" type="error" :title="error" :closable="false" /><el-alert
      v-if="notice"
      type="success"
      :title="notice"
      :closable="false"
    />
    <el-table v-if="issues.length" :data="issues" max-height="180" border
      ><el-table-column prop="line" label="Excel行" width="100" /><el-table-column
        prop="message"
        label="需修改内容"
    /></el-table>
    <el-table
      :data="rows"
      v-loading="busy"
      border
      max-height="560"
      row-key="id"
      empty-text="暂无符合条件的货拉拉来源订单"
    >
      <el-table-column label="货拉拉订单号" width="215" fixed="left"
        ><template #default="{ row }"
          ><el-button link type="primary" @click="rawRow = row as ImportRow">{{
            row.order.orderNo
          }}</el-button>
          <div class="muted">
            {{ row.sourceChannel === 'API' ? '接口同步' : 'Excel导入' }}
          </div></template
        ></el-table-column
      >
      <el-table-column label="用车时间" width="170"
        ><template #default="{ row }">{{
          current(row as ImportRow).useTime
        }}</template></el-table-column
      >
      <el-table-column label="下单员工" min-width="115"
        ><template #default="{ row }"
          >{{
            current(row as ImportRow).facts?.sourceEmployeeName ||
            current(row as ImportRow).raw['下单人(员工)'] ||
            '-'
          }}
          <div v-if="current(row as ImportRow).facts?.mappedEmployeeCode" class="muted">
            已关联员工
          </div></template
        ></el-table-column
      >
      <el-table-column label="收货方" min-width="210"
        ><template #default="{ row }"
          ><template v-if="current(row as ImportRow).facts?.stops?.length"
            ><div v-for="(s, i) in current(row as ImportRow).facts!.stops.slice(1)" :key="i">
              {{ s.name || s.contactName || s.address }}
            </div></template
          ><span v-else>{{ current(row as ImportRow).raw['收货人信息'] || '-' }}</span></template
        ></el-table-column
      >
      <el-table-column label="来源金额（元）" width="145" align="right"
        ><template #default="{ row }">{{
          displayMoney(
            current(row as ImportRow).facts?.billAmount ?? current(row as ImportRow).paidAmount,
          )
        }}</template></el-table-column
      >
      <el-table-column label="核对净费用（元）" width="155" align="right"
        ><template #default="{ row }"
          ><strong>{{ displayMoney(amount(row as ImportRow)) }}</strong></template
        ></el-table-column
      >
      <el-table-column label="平台状态" width="110"
        ><template #default="{ row }">{{
          current(row as ImportRow).status
        }}</template></el-table-column
      >
      <el-table-column label="关联情况" width="145"
        ><template #default="{ row }"
          ><el-tag :type="row.sourceDifference ? 'danger' : row.costId ? 'success' : 'warning'">{{
            row.sourceDifference ? '来源变化待核对' : row.costId ? '已生成运输记录' : '待关联'
          }}</el-tag>
          <div v-if="!row.costId && !canGenerate(row as ImportRow)" class="muted">
            账单待核对
          </div></template
        ></el-table-column
      >
      <el-table-column label="操作" width="220" fixed="right"
        ><template #default="{ row }"
          ><el-button v-if="row.costId" link type="primary" @click="emit('openCost', row.costId)"
            >查看费用</el-button
          ><el-button
            v-else
            link
            type="primary"
            :disabled="busy || !canGenerate(row as ImportRow) || referencesReady === false"
            @click="choose(row as ImportRow)"
            >推荐并关联单据</el-button
          ><el-button v-if="canManage" link type="primary" @click="verify(row as ImportRow)"
            >核对账单</el-button
          ><el-button
            v-if="row.sourceDifference && canManage"
            link
            type="primary"
            @click="accept(row as ImportRow)"
            >接受变更</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <div class="source-pagination">
      <span class="muted">每页100条</span
      ><el-button :disabled="busy || begin === 0" @click="page(-1)">上一页</el-button
      ><span>第 {{ begin / 100 + 1 }} 页</span
      ><el-button :disabled="busy || rows.length < 100" @click="page(1)">下一页</el-button>
    </div>
    <el-dialog
      :model-value="!!rawRow"
      title="货拉拉订单与账单"
      width="min(1100px,94vw)"
      append-to-body
      @close="rawRow = null"
    >
      <template v-if="rawRow"
        ><el-descriptions :column="3" border
          ><el-descriptions-item label="货拉拉订单号">{{
            rawRow.order.orderNo
          }}</el-descriptions-item
          ><el-descriptions-item label="平台状态">{{ current(rawRow).status }}</el-descriptions-item
          ><el-descriptions-item label="用车时间">{{
            current(rawRow).useTime
          }}</el-descriptions-item
          ><el-descriptions-item label="来源金额（元）">{{
            displayMoney(current(rawRow).facts?.billAmount ?? current(rawRow).paidAmount)
          }}</el-descriptions-item
          ><el-descriptions-item label="实付（元）">{{
            displayMoney(current(rawRow).paidAmount)
          }}</el-descriptions-item
          ><el-descriptions-item label="未付（元）">{{
            displayMoney(current(rawRow).facts?.unpaidAmount)
          }}</el-descriptions-item
          ><el-descriptions-item label="退款（元）">{{
            displayMoney(current(rawRow).facts?.refundAmount)
          }}</el-descriptions-item
          ><el-descriptions-item label="优惠券（元）">{{
            displayMoney(current(rawRow).facts?.couponAmount)
          }}</el-descriptions-item
          ><el-descriptions-item label="核对净费用（元）">{{
            displayMoney(amount(rawRow))
          }}</el-descriptions-item></el-descriptions
        >
        <el-alert
          v-if="current(rawRow).facts?.issue"
          :title="current(rawRow).facts!.issue!"
          type="warning"
          :closable="false"
        />
        <div v-if="rawRow.sourceDifference" class="difference-box">
          <span
            >原费用依据：{{
              displayMoney(rawRow.order.facts?.billAmount ?? rawRow.order.paidAmount)
            }}
            元</span
          ><span>最新平台账单：{{ displayMoney(current(rawRow).facts?.billAmount) }} 元</span>
        </div>
        <h3 v-if="current(rawRow).facts?.stops.length">收发货信息</h3>
        <el-table
          v-if="current(rawRow).facts?.stops.length"
          :data="current(rawRow).facts!.stops"
          border
          ><el-table-column label="节点" width="90"
            ><template #default="scope">{{
              scope.$index === 0 ? '发货方' : `收货方${scope.$index}`
            }}</template></el-table-column
          ><el-table-column prop="name" label="名称" min-width="160" /><el-table-column
            prop="contactName"
            label="联系人"
            width="100" /><el-table-column
            prop="contactPhone"
            label="联系电话"
            width="145" /><el-table-column prop="address" label="详细地址" min-width="240"
        /></el-table>
        <h3 v-if="current(rawRow).facts?.fees.length">账单构成</h3>
        <el-table
          v-if="current(rawRow).facts?.fees.length"
          :data="current(rawRow).facts!.fees"
          border
          ><el-table-column prop="name" label="费用项目" /><el-table-column
            label="金额（元）"
            align="right"
            ><template #default="{ row }">{{ displayMoney(row.amount) }}</template></el-table-column
          ></el-table
        >
        <el-descriptions v-if="rawRow.verification" :column="1" border class="verification-details"
          ><el-descriptions-item label="净费用核对依据">{{
            rawRow.verification.reason
          }}</el-descriptions-item></el-descriptions
        >
        <el-descriptions v-if="!current(rawRow).facts" :column="1" border
          ><el-descriptions-item
            v-for="(value, key) in current(rawRow).raw"
            :key="key"
            :label="String(key)"
            >{{ value || '-' }}</el-descriptions-item
          ></el-descriptions
        ></template
      >
      <template #footer><el-button @click="rawRow = null">关闭</el-button></template>
    </el-dialog>
    <el-dialog v-model="typeOpen" title="关联业务单据" width="min(520px,94vw)" append-to-body
      ><el-form label-position="top"
        ><el-form-item label="运输类型" required
          ><el-select v-model="transportType" placeholder="先选择运输类型"
            ><el-option
              v-for="t in transportTypes"
              :key="t.value"
              :label="t.label"
              :value="t.value" /></el-select></el-form-item></el-form
      ><template #footer
        ><el-button @click="typeOpen = false">取消</el-button
        ><el-button type="primary" :disabled="!transportType" @click="openPicker"
          >选择单据</el-button
        ></template
      ></el-dialog
    >
    <CostLedgerSourcePicker
      v-model="picker"
      :order-type-code="sourceType"
      :selected-keys="[]"
      :suggested-date="selected?.order.useTime.slice(0, 10)"
      :suggested-order-no="selected?.order.salesOrderNos?.[0]"
      :suggested-receiver="selected ? sourceReceiverHints(selected) : undefined"
      :suggested-employee-code="
        selected ? current(selected).facts?.mappedEmployeeCode || undefined : undefined
      "
      @selected="matched"
    />
    <el-dialog
      v-model="editorOpen"
      title="核对业务单据与运输费用"
      width="min(1380px,94vw)"
      append-to-body
      :close-on-click-modal="false"
      destroy-on-close
      ><el-alert v-if="saveError" type="error" :title="saveError" :closable="false" />
      <div class="bill-summary">
        <strong>货拉拉订单号：{{ selected?.order.orderNo }}</strong
        ><span>本单净费用：{{ displayMoney(selected ? amount(selected) : null) }} 元</span>
      </div>
      <el-table
        v-if="selected && current(selected).facts?.stops.length"
        :data="current(selected).facts!.stops"
        border
        class="platform-stops"
      >
        <el-table-column label="货拉拉节点" width="120"
          ><template #default="scope">{{
            scope.$index === 0 ? '发货方' : `收货方${scope.$index}`
          }}</template></el-table-column
        >
        <el-table-column prop="name" label="名称" min-width="180" /><el-table-column
          prop="contactName"
          label="联系人"
          width="110"
        /><el-table-column prop="contactPhone" label="联系电话" width="150" /><el-table-column
          prop="address"
          label="实际地址"
          min-width="240"
        />
      </el-table>
      <el-alert
        v-if="
          selected &&
          deliveryAddressesDiffer(
            selected,
            form.ledger?.receivingPoints.map((p) => p.address) || [],
          )
        "
        type="warning"
        title="货拉拉实际配送地址与业务单据收货地址不完全一致，请核对。"
        :closable="false"
      />
      <CostLedgerEditor
        ref="editor"
        v-model="form"
        logistics
        carrier-locked
        :cities="cities"
        :employees="employees"
      /><template #footer
        ><el-button :disabled="busy" @click="editorOpen = false">取消</el-button
        ><el-button type="primary" :loading="busy" @click="generate"
          >生成待确认运输记录</el-button
        ></template
      ></el-dialog
    >
    <el-dialog
      v-model="verificationOpen"
      title="核对最终净费用"
      width="min(600px,94vw)"
      append-to-body
      :close-on-click-modal="false"
      ><el-descriptions :column="1" border
        ><el-descriptions-item label="货拉拉订单号">{{
          verificationRow?.order.orderNo
        }}</el-descriptions-item
        ><el-descriptions-item label="来源金额（元）">{{
          displayMoney(verificationRow ? current(verificationRow).facts?.billAmount : null)
        }}</el-descriptions-item
        ><el-descriptions-item label="退款（元）">{{
          displayMoney(verificationRow ? current(verificationRow).facts?.refundAmount : null)
        }}</el-descriptions-item></el-descriptions
      ><el-form label-position="top" class="verification-form"
        ><el-form-item label="最终我方净费用（元）" required
          ><el-input
            v-model="verifiedAmount"
            inputmode="decimal"
            placeholder="请按核对后的最终净费用填写" /></el-form-item
        ><el-form-item label="核对依据" required
          ><el-input
            v-model="verificationReason"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit /></el-form-item></el-form
      ><el-alert
        v-if="verificationError"
        :title="verificationError"
        type="error"
        :closable="false"
      /><template #footer
        ><el-button @click="verificationOpen = false">取消</el-button
        ><el-button type="primary" :loading="busy" @click="saveVerification"
          >保存核对结果</el-button
        ></template
      ></el-dialog
    >
  </section>
</template>
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessageBox } from 'element-plus'
import { apiClient } from '@/api/core/client'
import type { CostCommand, CostEmployee, CostRecord } from '@/api/core/cost'
import { errorMessage } from '@/api/core/error'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import CostLedgerSourcePicker, { type PickedLedgerSource } from './CostLedgerSourcePicker.vue'
import CostLedgerEditor from './CostLedgerEditor.vue'
import { createLedgerCommand } from './cost-ledger'
import { costMoney } from './cost-dictionaries'
import { lalamoveTemplate, parseLalamoveWorkbook } from './lalamove-import'
import { transportTypes } from './cost-transport-types'
import {
  currentSource as current,
  sourceReceiverHints,
  deliveryAddressesDiffer,
  verifiedSourceAmount as amount,
  canGenerateSource as canGenerate,
  type Amount,
  type ImportRow,
} from './huolala-source'
const props = defineProps<{
  cities: { code: string; name: string }[]
  employees: CostEmployee[]
  referencesReady?: boolean
  differencesOnly?: boolean
}>()
const emit = defineEmits<{ generated: []; openCost: [id: string] }>()
const { can } = useSupplyPermissions(),
  canManage = computed(() => can('order:logistics-cost:manage-imports'))
const displayMoney = (value: Amount | undefined) =>
  value == null || !Number.isFinite(Number(value)) ? '-' : costMoney(Number(value))
const endpoint = '/orders/logistics-costs/imports',
  options = { stayOnUnauthorized: true }
const rows = ref<ImportRow[]>([]),
  issues = ref<{ line: number; message: string }[]>([]),
  busy = ref(false),
  error = ref(''),
  notice = ref(''),
  begin = ref(0),
  orderNo = ref(''),
  state = ref('')
const rawRow = ref<ImportRow | null>(null),
  picker = ref(false),
  selected = ref<ImportRow | null>(null),
  editorOpen = ref(false),
  form = ref<CostCommand>(createLedgerCommand(true)),
  editor = ref<{ picked: (rows: PickedLedgerSource[]) => void }>(),
  saveError = ref(''),
  typeOpen = ref(false),
  transportType = ref('')
const sourceType = computed(
  () =>
    ({ DELIVERY: 'SALES_ORDER', TRANSFER: 'TRANSFER_ORDER', OTHER: 'OTHER_OUT' })[
      transportType.value
    ] || 'SALES_ORDER',
)
const verificationOpen = ref(false),
  verificationRow = ref<ImportRow>(),
  verifiedAmount = ref(''),
  verificationReason = ref(''),
  verificationError = ref('')
let disposed = false,
  request = 0
onBeforeUnmount(() => {
  disposed = true
  ++request
})
function openPicker() {
  if (!transportType.value) return
  typeOpen.value = false
  picker.value = true
}
function resetSearch() {
  orderNo.value = ''
  state.value = ''
  void search()
}
async function load() {
  const version = ++request
  busy.value = true
  error.value = ''
  try {
    const result = await apiClient.get<ImportRow[]>(`${endpoint}/sources`, {
      ...options,
      params: {
        begin: begin.value,
        orderNo: orderNo.value || undefined,
        state: state.value || undefined,
        differencesOnly: !!props.differencesOnly,
      },
    })
    if (!disposed && version === request) rows.value = result
  } catch (e) {
    if (!disposed && version === request) error.value = errorMessage(e, '来源订单加载失败')
  } finally {
    if (!disposed && version === request) busy.value = false
  }
}
function search() {
  begin.value = 0
  void load()
}
function page(step: number) {
  begin.value = Math.max(0, begin.value + step * 100)
  void load()
}
async function downloadTemplate() {
  try {
    await lalamoveTemplate()
  } catch (e) {
    error.value = errorMessage(e, '模板下载失败')
  }
}
async function upload(file: File) {
  if (busy.value) return false
  busy.value = true
  error.value = ''
  notice.value = ''
  issues.value = []
  let accepted = 0
  try {
    if (!file.name.toLowerCase().endsWith('.xlsx') || file.size > 10 * 1024 * 1024)
      throw new Error('请上传不超过10MB的xlsx文件')
    const buffer = await file.arrayBuffer(),
      hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))]
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('')
    const excel = await import('exceljs'),
      { Workbook } = excel.default || excel,
      book = new Workbook()
    try {
      await book.xlsx.load(buffer)
    } catch {
      throw new Error('报表无法读取，请另存为.xlsx后重试')
    }
    const preview = await parseLalamoveWorkbook(book)
    issues.value = preview.errors
    if (preview.errors.length) throw new Error(`有${preview.errors.length}行需要修改，本次未导入`)
    for (let i = 0; i < preview.rows.length; i += 200) {
      const added = await apiClient.post<ImportRow[]>(
        endpoint,
        { fileName: file.name, fileHash: hash, rows: preview.rows.slice(i, i + 200) },
        options,
      )
      accepted += added.length
    }
    notice.value = `已读取${preview.rows.length}条，${accepted}条可查看；同一货拉拉单号不会重复生成费用。`
    begin.value = 0
  } catch (e) {
    error.value =
      (accepted ? `前面批次已有${accepted}条可查看。` : '') + errorMessage(e, '报表导入失败')
  } finally {
    busy.value = false
  }
  if (!error.value) await load()
  return false
}
function choose(row: ImportRow) {
  selected.value = row
  transportType.value = ''
  typeOpen.value = true
}
async function matched(sources: PickedLedgerSource[]) {
  if (!selected.value || !sources.length || props.referencesReady === false) return
  if (new Set(sources.map((s) => s.senderCode).filter(Boolean)).size > 1) {
    error.value = '所选单据发货仓库不同，请先核对实际运输'
    return
  }
  form.value = createLedgerCommand(true)
  const bill = selected.value.order,
    p = form.value.ledger!,
    city = props.cities.find((c) => c.code === sources[0]!.cityCode),
    total = amount(selected.value)
  form.value.cityCode = city?.code || sources[0]!.cityCode
  form.value.cityName = city?.name || ''
  form.value.costDate = bill.useTime.slice(0, 10)
  const employee = props.employees.find((e) => e.employeeCode === bill.facts?.mappedEmployeeCode)
  if (employee) form.value.ownerEmployeeCode = employee.employeeCode
  p.transportPurposeCode = transportType.value
  p.carrierCode = 'HLL'
  p.platformOrderNo = bill.orderNo
  p.trackingNo = bill.raw['运单号'] || ''
  p.costMonth = form.value.costDate.slice(0, 7)
  p.feeItems[0]!.feeAmount = Number(total)
  p.feeItems[0]!.ourAmount = Number(total)
  p.feeItems[0]!.allocationMethodCode = 'EQUAL'
  if (Number(total) === 0)
    p.feeItems[0]!.zeroCostReason =
      selected.value.verification?.reason || '货拉拉来源金额为0，已核对'
  saveError.value = ''
  editorOpen.value = true
  await nextTick()
  editor.value?.picked(sources)
}
async function generate() {
  if (!selected.value || busy.value) return
  busy.value = true
  saveError.value = ''
  try {
    await apiClient.post<CostRecord>(
      `${endpoint}/${selected.value.id}/generate`,
      { revision: selected.value.revision, command: form.value },
      options,
    )
    editorOpen.value = false
    emit('generated')
    await load()
  } catch (e) {
    saveError.value = errorMessage(e, '生成运输记录失败')
  } finally {
    busy.value = false
  }
}
function verify(row: ImportRow) {
  verificationRow.value = row
  verifiedAmount.value = row.verification?.amount == null ? '' : String(row.verification.amount)
  verificationReason.value = ''
  verificationError.value = ''
  verificationOpen.value = true
}
async function saveVerification() {
  if (
    !verificationRow.value ||
    !/^\d{1,12}(\.\d{1,2})?$/.test(verifiedAmount.value) ||
    !verificationReason.value.trim()
  ) {
    verificationError.value = '请填写非负净费用（最多两位小数）和核对依据'
    return
  }
  busy.value = true
  try {
    await apiClient.post(
      `${endpoint}/${verificationRow.value.id}/verify-bill`,
      {
        revision: verificationRow.value.revision,
        amount: verifiedAmount.value,
        reason: verificationReason.value.trim(),
      },
      options,
    )
    verificationOpen.value = false
    await load()
  } catch (e) {
    verificationError.value = errorMessage(e, '账单核对失败')
  } finally {
    busy.value = false
  }
}
async function accept(row: ImportRow) {
  try {
    const reason = await ElMessageBox.prompt(
      '请先撤销并核对对应费用，再接受平台账单变化。',
      '接受来源变更',
      {
        inputPlaceholder: '填写变更核对依据',
        inputValidator: (v) => !!v?.trim() || '请填写核对依据',
      },
    )
    busy.value = true
    await apiClient.post(
      `${endpoint}/${row.id}/accept-source`,
      { revision: row.revision, reason: reason.value.trim() },
      options,
    )
    await load()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') error.value = errorMessage(e, '来源变更尚不能接受')
  } finally {
    busy.value = false
  }
}
onMounted(() => void load())
watch(() => props.differencesOnly, search)
</script>
<style scoped>
.carrier-panel {
  background: var(--el-bg-color, #fff);
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  padding: 20px;
  min-width: 0;
}
.source-filters :deep(.el-input) {
  width: 240px;
}
.source-filters :deep(.el-select) {
  width: 180px;
}
.source-toolbar,
.source-toolbar > div,
.source-pagination,
.bill-summary,
.difference-box {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.source-toolbar {
  justify-content: space-between;
  margin: 4px 0 16px;
}
.source-pagination {
  justify-content: flex-end;
  margin-top: 16px;
}
.bill-summary,
.difference-box {
  padding: 14px 16px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  margin-bottom: 16px;
}
.muted {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
}
.verification-form,
.verification-details {
  margin-top: 20px;
}
.carrier-panel :deep(.el-alert) {
  margin-bottom: 14px;
}
.carrier-panel :deep(.el-table .cell) {
  word-break: normal;
}
.carrier-panel h3 {
  font-size: 15px;
  margin: 20px 0 12px;
}
.source-toolbar :deep(.el-upload) {
  display: inline-flex;
}
@media (max-width: 900px) {
  .carrier-panel {
    padding: 14px;
  }
  .source-toolbar > div {
    gap: 8px;
  }
}
</style>
