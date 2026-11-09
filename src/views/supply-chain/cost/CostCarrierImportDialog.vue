<template>
  <el-dialog
    v-model="visible"
    title="货拉拉报表导入与销售单关联"
    width="min(1440px,96vw)"
    :close-on-click-modal="false"
    @open="load"
  >
    <div class="import-toolbar">
      <el-button :disabled="busy" @click="downloadTemplate">下载导入模板</el-button>
      <el-upload accept=".xlsx" :show-file-list="false" :before-upload="upload" :disabled="busy"
        ><el-button type="primary" :loading="busy">上传 Excel 报表</el-button></el-upload
      >
      <el-button :disabled="busy" @click="load">刷新待关联记录</el-button>
    </div>
    <el-alert v-if="error" type="error" :title="error" :closable="false" />
    <el-alert v-if="notice" type="success" :title="notice" :closable="false" />
    <el-table v-if="issues.length" :data="issues" max-height="180" border
      ><el-table-column prop="line" label="Excel 行" width="110" /><el-table-column
        prop="message"
        label="需修改内容"
    /></el-table>
    <el-table
      :data="rows"
      v-loading="busy"
      border
      max-height="480"
      empty-text="上传货拉拉原始报表或按模板填写的报表"
    >
      <el-table-column label="货拉拉订单号" min-width="235"
        ><template #default="{ row }">{{ row.order.orderNo }}</template></el-table-column
      >
      <el-table-column label="用车时间" min-width="180"
        ><template #default="{ row }">{{ row.order.useTime }}</template></el-table-column
      >
      <el-table-column label="原单状态" width="110"
        ><template #default="{ row }">{{ row.order.status }}</template></el-table-column
      >
      <el-table-column label="实付金额（元）" width="135" align="right"
        ><template #default="{ row }">{{
          costMoney(row.order.paidAmount)
        }}</template></el-table-column
      >
      <el-table-column label="收货人信息" min-width="230"
        ><template #default="{ row }"
          ><template v-if="row.order.raw['起始路线'] || row.order.raw['终点城市']"
            >{{ row.order.raw['起始路线'] || '-' }} → {{ row.order.raw['终点城市'] || '-'
            }}<br /></template
          >{{ row.order.raw['收货人信息'] || '-' }}</template
        ></el-table-column
      >
      <el-table-column label="货拉拉下单人" width="140"
        ><template #default="{ row }">{{
          row.order.raw['下单人(员工)'] || '-'
        }}</template></el-table-column
      >
      <el-table-column label="关联状态" width="150"
        ><template #default="{ row }"
          ><el-tag
            :type="row.costId ? 'success' : canGenerate(row as ImportRow) ? 'warning' : 'info'"
            >{{
              row.costId
                ? '已生成运输记录'
                : canGenerate(row as ImportRow)
                  ? '待关联销售单'
                  : '不可生成运输记录'
            }}</el-tag
          ></template
        ></el-table-column
      >
      <el-table-column label="操作" width="220" fixed="right"
        ><template #default="{ row }"
          ><el-button
            link
            type="primary"
            :disabled="busy || !!row.costId || !canGenerate(row as ImportRow)"
            @click="choose(row as ImportRow)"
            >{{
              row.costId ? '已生成' : canGenerate(row as ImportRow) ? '关联销售单' : '不可生成'
            }}</el-button
          ><el-button link type="primary" @click="rawRow = row as ImportRow"
            >原报表信息</el-button
          ></template
        ></el-table-column
      >
    </el-table>
    <div class="import-toolbar">
      <el-button :disabled="busy || begin === 0" @click="page(-1)">上一页</el-button
      ><el-button :disabled="busy || rows.length < 100" @click="page(1)">下一页</el-button>
    </div>
    <el-dialog
      :model-value="!!rawRow"
      title="货拉拉原报表信息"
      width="min(900px,94vw)"
      append-to-body
      @close="rawRow = null"
    >
      <p>报表：{{ rawRow?.fileName }}</p>
      <el-descriptions :column="1" border>
        <el-descriptions-item
          v-for="(value, key) in rawRow?.order.raw"
          :key="key"
          :label="String(key)"
          >{{ value || '-' }}</el-descriptions-item
        >
      </el-descriptions>
    </el-dialog>
    <CostLedgerSourcePicker
      v-model="picker"
      order-type-code="SALES_ORDER"
      :selected-keys="[]"
      :suggested-date="selected?.order.useTime.slice(0, 10)"
      :suggested-order-no="selected?.order.salesOrderNos?.[0]"
      :suggested-receiver="selected?.order.raw['收货人信息']"
      @selected="matched"
    />
    <el-dialog
      v-model="editorOpen"
      title="核对关联销售单与运输费用"
      width="min(1380px,94vw)"
      append-to-body
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-alert v-if="saveError" type="error" :title="saveError" :closable="false" />
      <div class="bill-summary">
        <strong>货拉拉订单号：{{ selected?.order.orderNo }}</strong
        ><span
          >原报表实付金额：{{
            costMoney(selected ? Number(selected.order.paidAmount) : null)
          }}
          元</span
        >
      </div>
      <CostLedgerEditor
        ref="editor"
        v-model="form"
        logistics
        carrier-locked
        :cities="cities"
        :employees="employees"
      />
      <template #footer
        ><el-button :disabled="busy" @click="editorOpen = false">取消</el-button
        ><el-button type="primary" :loading="busy" @click="generate"
          >生成待确认运输记录</el-button
        ></template
      >
    </el-dialog>
    <template #footer
      ><el-button :disabled="busy" @click="visible = false">关闭</el-button></template
    >
  </el-dialog>
</template>
<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { apiClient } from '@/api/core/client'
import type { CostCommand, CostEmployee, CostRecord } from '@/api/core/cost'
import { errorMessage } from '@/api/core/error'
import CostLedgerSourcePicker, { type PickedLedgerSource } from './CostLedgerSourcePicker.vue'
import CostLedgerEditor from './CostLedgerEditor.vue'
import { createLedgerCommand } from './cost-ledger'
import { costMoney } from './cost-dictionaries'
import { lalamoveTemplate, parseLalamoveWorkbook, type LalamoveOrder } from './lalamove-import'
type ImportRow = {
  id: string
  fileName: string
  revision: number
  state: string
  costId: string | null
  order: LalamoveOrder
}
const visible = defineModel<boolean>({ required: true })
const props = defineProps<{ cities: { code: string; name: string }[]; employees: CostEmployee[] }>()
const emit = defineEmits<{ generated: [] }>()
const endpoint = '/orders/logistics-costs/imports',
  options = { stayOnUnauthorized: true }
const rows = ref<ImportRow[]>([]),
  issues = ref<{ line: number; message: string }[]>([]),
  busy = ref(false),
  error = ref(''),
  notice = ref(''),
  begin = ref(0)
const rawRow = ref<ImportRow | null>(null)
const picker = ref(false),
  selected = ref<ImportRow | null>(null),
  editorOpen = ref(false),
  form = ref<CostCommand>(createLedgerCommand(true)),
  editor = ref<{ picked: (rows: PickedLedgerSource[]) => void }>(),
  saveError = ref('')
let disposed = false
onBeforeUnmount(() => (disposed = true))
async function load() {
  busy.value = true
  error.value = ''
  try {
    const data = await apiClient.get<ImportRow[]>(endpoint, {
      ...options,
      params: { begin: begin.value },
    })
    if (!disposed) rows.value = data
  } catch (e) {
    if (!disposed) error.value = errorMessage(e, '待关联记录加载失败')
  } finally {
    if (!disposed) busy.value = false
  }
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
    const excel = await import('exceljs')
    const { Workbook } = excel.default || excel
    const book = new Workbook()
    try {
      await book.xlsx.load(buffer)
    } catch {
      throw new Error('报表无法读取，请用 Excel 或 WPS 另存为 .xlsx 后重试，或下载模板重新填写')
    }
    const preview = await parseLalamoveWorkbook(book)
    issues.value = preview.errors
    if (preview.errors.length)
      throw new Error(`有${preview.errors.length}行需要修改，本次未导入，请修正后重新上传`)
    for (let i = 0; i < preview.rows.length; i += 200) {
      const added = await apiClient.post<ImportRow[]>(
        endpoint,
        { fileName: file.name, fileHash: hash, rows: preview.rows.slice(i, i + 200) },
        options,
      )
      accepted += added.length
    }
    notice.value = `已读取${preview.rows.length}条，${accepted}条可查看；重复订单保留首次记录。请选择销售单后生成运输记录。`
    begin.value = 0
  } catch (e) {
    error.value =
      (accepted ? `前面批次已有${accepted}条可查看，重新上传会自动去重。` : '') +
      errorMessage(e, '报表导入失败')
  } finally {
    busy.value = false
  }
  if (!error.value) await load()
  return false
}
function page(step: number) {
  begin.value = Math.max(0, begin.value + step * 100)
  void load()
}
function canGenerate(row: ImportRow) {
  return ['已完成', '司机完成', '已支付'].includes(row.order.status)
}
function choose(row: ImportRow) {
  if (!canGenerate(row as ImportRow)) return
  selected.value = row
  picker.value = true
}
async function matched(sources: PickedLedgerSource[]) {
  if (!selected.value || !sources.length) return
  if (new Set(sources.map((s) => s.senderCode).filter(Boolean)).size > 1) {
    error.value = '所选销售单发货仓库不同，请按实际运输分开登记'
    return
  }
  form.value = createLedgerCommand(true)
  const bill = selected.value.order,
    p = form.value.ledger!,
    city = props.cities.find((c) => c.code === sources[0]!.cityCode)
  form.value.cityCode = city?.code || sources[0]!.cityCode
  form.value.cityName = city?.name || ''
  form.value.costDate = bill.useTime.slice(0, 10)
  p.transportPurposeCode = 'DELIVERY'
  p.carrierCode = 'HLL'
  p.trackingNo = bill.orderNo
  p.costMonth = form.value.costDate.slice(0, 7)
  p.feeItems[0]!.feeAmount = Number(bill.paidAmount)
  p.feeItems[0]!.ourAmount = Number(bill.paidAmount)
  p.feeItems[0]!.allocationMethodCode = 'EQUAL'
  if (Number(bill.paidAmount) === 0) p.feeItems[0]!.zeroCostReason = '货拉拉原报表实付金额为0'
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
</script>
<style scoped>
.import-toolbar,
.bill-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin: 0 0 16px;
}
.bill-summary {
  padding: 16px;
  background: #f5f7fb;
}
.import-toolbar:last-child {
  margin: 16px 0 0;
}
</style>
