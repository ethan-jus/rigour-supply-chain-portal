<template>
  <el-dialog
    v-model="visible"
    title="批量补录运费"
    width="min(1100px, 96vw)"
    top="5vh"
    :close-on-click-modal="false"
    :close-on-press-escape="!busy"
    :show-close="!busy"
  >
    <p class="import-description">
      按快递单号匹配已有运输记录，仅补录尚未填写的运费。已填写运费、重复或匹配不明确的记录，请逐笔核对。
    </p>
    <div class="import-controls">
      <el-select
        v-model="carrier"
        clearable
        placeholder="物流公司（可选）"
        aria-label="导入物流公司"
        :disabled="busy"
        @change="invalidate"
      >
        <el-option
          v-for="c in costOptions('COST_CARRIER')"
          :key="c.value"
          :value="c.value"
          :label="c.label"
        />
      </el-select>
      <label class="file-picker"
        >选择 Excel 文件<input type="file" accept=".xlsx" :disabled="busy" @change="choose"
      /></label>
      <span>{{ file?.name || '未选择文件' }}</span>
      <el-button :disabled="busy" @click="template">下载模板</el-button>
      <el-button :disabled="!file || busy" :loading="checking" @click="check">{{
        result ? '重新匹配' : '核对文件'
      }}</el-button>
    </div>
    <p class="import-help">
      必填：快递单号、运费（元）。零元运费须填写备注。一次最多500条，文件不超过10MB；完整原文件独立归档，每笔运输的费用凭证仅包含本笔明细。
    </p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <div v-if="result" class="import-summary">
      共 {{ result.items.length }} 条，可补录 {{ ready.length }} 条，已补录 {{ imported }} 条
    </div>
    <el-table
      v-if="result"
      :key="generation"
      :data="result.items"
      row-key="line"
      border
      max-height="420"
      @selection-change="selection = $event"
    >
      <el-table-column
        type="selection"
        width="45"
        :selectable="(r: TransportFeeImportItem) => r.state === 'READY' && !busy"
      />
      <el-table-column prop="line" label="行号" width="70" />
      <el-table-column prop="trackingNo" label="快递单号" min-width="180" show-overflow-tooltip />
      <el-table-column label="运费（元）" width="120" align="right"
        ><template #default="{ row }">{{ money(row.amount) }}</template></el-table-column
      >
      <el-table-column prop="documentNo" label="费用单号" min-width="220" show-overflow-tooltip />
      <el-table-column prop="message" label="处理结果" min-width="280" />
    </el-table>
    <template #footer>
      <el-button :disabled="busy" @click="visible = false">关闭</el-button>
      <el-button
        type="primary"
        :loading="saving"
        :disabled="!selection.length || busy"
        @click="save"
        >补录选中运费（{{ selection.length }}）</el-button
      >
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  applyTransportFees,
  previewTransportFees,
  type TransportFeeImportPreview,
  type TransportFeeImportItem,
} from '@/api/core/transport-records'
import { errorMessage } from '@/api/core/error'
import { costOptions } from './cost-dictionaries'
import { money } from './transport-records'
const visible = defineModel<boolean>({ required: true })
const emit = defineEmits<{ saved: [] }>()
const file = ref<File | null>(null),
  carrier = ref<string>(),
  result = ref<TransportFeeImportPreview | null>(null)
const selection = ref<TransportFeeImportItem[]>([]),
  error = ref(''),
  checking = ref(false),
  saving = ref(false),
  generation = ref(0)
const busy = computed(() => checking.value || saving.value)
const ready = computed(() => result.value?.items.filter((i) => i.state === 'READY') || [])
const imported = computed(
  () => result.value?.items.filter((i) => i.state === 'IMPORTED').length || 0,
)
function invalidate() {
  result.value = null
  selection.value = []
  error.value = ''
  generation.value++
}
function choose(event: Event) {
  const picked = (event.target as HTMLInputElement).files?.[0]
  invalidate()
  file.value = null
  if (!picked) return
  if (!/\.xlsx$/i.test(picked.name) || picked.size === 0 || picked.size > 10 * 1024 * 1024) {
    error.value = '请选择不超过10MB的非空xlsx文件'
    return
  }
  file.value = picked
}
async function check() {
  if (!file.value || busy.value) return
  checking.value = true
  error.value = ''
  selection.value = []
  try {
    result.value = await previewTransportFees(file.value, carrier.value)
    generation.value++
  } catch (e) {
    result.value = null
    error.value = errorMessage(e, '文件核对失败，请重试')
  } finally {
    checking.value = false
  }
}
async function save() {
  if (!file.value || !result.value || !selection.value.length || busy.value) return
  saving.value = true
  error.value = ''
  let changed = false
  const targets = selection.value.slice()
  try {
    // 分批反馈结果，避免大批导入长时间没有响应；服务端仍逐笔校验版本和原金额。
    for (let begin = 0; begin < targets.length; begin += 20) {
      const applied = await applyTransportFees(
        file.value,
        result.value.fileHash,
        carrier.value,
        targets.slice(begin, begin + 20),
      )
      const updated = new Map(applied.items.map((i) => [i.line, i]))
      result.value.items = result.value.items.map((i) => updated.get(i.line) || i)
      changed ||= applied.items.some((i) => i.state === 'IMPORTED')
      generation.value++
    }
    selection.value = []
    ElMessage.success(`已补录 ${imported.value} 条运费，请核对处理结果`)
  } catch (e) {
    error.value = errorMessage(e, '本次处理未完成，请重新匹配核对；已有运费不会重复写入')
  } finally {
    if (changed) emit('saved')
    saving.value = false
  }
}
async function template() {
  const ExcelJS = await import('exceljs')
  const book = new ExcelJS.Workbook()
  const sheet = book.addWorksheet('运费补录')
  sheet.columns = [
    { header: '快递单号', key: 'no', width: 32 },
    { header: '运费（元）', key: 'fee', width: 20 },
    { header: '备注', key: 'remark', width: 48 },
  ]
  sheet.getColumn(1).numFmt = '@'
  sheet.getColumn(2).numFmt = '0.00'
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.getRow(1).font = { bold: true }
  const help = book.addWorksheet('填写说明')
  help.getColumn(1).width = 100
  ;[
    '请在“运费补录”工作表填写，保留第一行表头。',
    '快递单号须为完整文本，避免长单号精度丢失。',
    '运费须为非负金额、最多两位小数；零元须在备注说明原因。',
    '只补录已有运输记录的缺失运费，不新增运输，不覆盖已有金额。',
    '同一运输多个快递单号，请合并为一笔总运费，避免重复计算。',
  ].forEach((text) => help.addRow([text]))
  const buffer = await book.xlsx.writeBuffer()
  const url = URL.createObjectURL(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = '运输运费补录模板.xlsx'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>
<style scoped>
.import-description,
.import-help {
  color: #667085;
  line-height: 1.7;
  margin: 0 0 16px;
}
.import-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}
.import-controls .el-select {
  width: 180px;
}
.file-picker {
  cursor: pointer;
  padding: 7px 14px;
  border: 1px solid #d0d5dd;
  border-radius: 4px;
}
.file-picker input {
  display: block;
  width: 220px;
  margin-top: 4px;
}
.import-summary {
  padding: 12px 0;
  font-weight: 600;
}
</style>
