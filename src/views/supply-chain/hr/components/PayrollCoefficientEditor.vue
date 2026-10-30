<template>
  <div class="interval-actions">
    <el-button :disabled="!steps.length" @click="copyIntervals">复制整组区间</el-button>
    <el-button
      v-if="!props.disabled"
      :disabled="editingDisabled || !hasCopiedPayrollIntervalGroup"
      :title="hasCopiedPayrollIntervalGroup ? '替换当前指标的全部区间' : '请先复制整组区间'"
      @click="pasteIntervals"
    >
      粘贴整组区间
    </el-button>
    <span class="field-hint">整组粘贴替换全部区间，单行粘贴仅覆盖目标行；保存规则后生效。</span>
  </div>
  <el-table :data="steps" border>
    <el-table-column label="完成率下界（%）" min-width="155">
      <template #default="{ row }">
        <el-input-number
          :model-value="percent(row.lower)"
          :min="0"
          :precision="2"
          :controls="false"
          @update:model-value="row.lower = rate($event)"
        />
        <el-checkbox v-model="row.lowerInclusive">包含下界</el-checkbox>
      </template>
    </el-table-column>
    <el-table-column label="完成率上界（空为无上限）" min-width="180">
      <template #default="{ row }">
        <el-input-number
          :model-value="percent(row.upper)"
          :min="0"
          :precision="2"
          :controls="false"
          @update:model-value="row.upper = rate($event)"
        />
        <el-checkbox v-model="row.upperInclusive">包含上界</el-checkbox>
      </template>
    </el-table-column>
    <el-table-column label="区间内计分方式" min-width="190">
      <template #default="{ row }"
        ><el-select v-model="row.mode"
          ><el-option
            v-for="option in coefficientModeOptions"
            :key="option.value"
            v-bind="option" /></el-select
      ></template>
    </el-table-column>
    <el-table-column label="倍数 / 固定系数" min-width="160">
      <template #default="{ row }"
        ><el-input-number v-model="row.coefficient" :min="0" :precision="4" :controls="false" />
        <div class="field-hint">
          {{ row.mode === 'LINEAR' ? '填写与完成率相乘的倍数' : '填写本区间直接采用的系数' }}
        </div>
      </template>
    </el-table-column>
    <el-table-column label="操作" width="130">
      <template #default="{ row, $index }">
        <div class="interval-row-actions">
          <el-button
            link
            type="primary"
            :disabled="false"
            @click="copyRow(row as PayrollMetricStep)"
            >复制本行</el-button
          >
          <el-button
            v-if="!props.disabled"
            link
            type="primary"
            :disabled="editingDisabled || !hasCopiedPayrollInterval"
            :title="hasCopiedPayrollInterval ? '仅覆盖本行的区间配置' : '请先复制单个区间'"
            @click="pasteRow(row as PayrollMetricStep)"
            >粘贴到本行</el-button
          >
          <el-button v-if="!props.disabled" link type="danger" @click="steps.splice($index, 1)"
            >移除</el-button
          >
        </div>
      </template>
    </el-table-column>
  </el-table>
  <el-button
    @click="
      steps.push({
        lower: null,
        upper: null,
        lowerInclusive: false,
        upperInclusive: true,
        mode: 'FIXED',
        coefficient: null,
      })
    "
    >增加区间</el-button
  >
  <p v-if="props.legacy" class="field-hint">
    历史综合完成率模式按原版本的唯一匹配区间计算，原核算依据保留。
  </p>
  <p v-else class="field-hint">
    按实际完成率匹配区间；匹配多条时，分别计算并取最高计分结果。未匹配任何区间时提示待核对。
  </p>
  <p class="field-hint">
    完成率 × 倍数：计分结果＝实际完成率 × 填写的倍数，例如80% × 1.2＝0.96。
    直接采用固定系数：计分结果＝填写的固定系数，例如填写1.2，结果就是1.2（120%）。示例均以完成率匹配相应区间为前提。
  </p>
  <p class="field-hint">复制后可切换指标或角色使用；刷新页面后需重新复制。</p>
</template>
<script setup lang="ts">
import { computed, inject } from 'vue'
import { coefficientModeOptions, payrollRatePercent } from '@/utils/payroll-rule-options'
import { ElMessage, formContextKey } from 'element-plus'
import 'element-plus/theme-chalk/el-message.css'
import type { PayrollMetricStep } from '@/api/core/payroll-scheme/models/PayrollMetricStep'
import {
  copyPayrollIntervalGroup,
  readCopiedPayrollIntervalGroup,
  copyPayrollInterval,
  readCopiedPayrollInterval,
  hasCopiedPayrollIntervalGroup,
  hasCopiedPayrollInterval,
} from '@/utils/payroll-coefficient-clipboard'
const props = defineProps<{ disabled?: boolean; legacy?: boolean }>()
const steps = defineModel<PayrollMetricStep[]>({ required: true })
const form = inject(formContextKey, undefined)
const editingDisabled = computed(() => props.disabled || form?.disabled || false)
function copyIntervals() {
  if (!steps.value.length) return
  copyPayrollIntervalGroup(steps.value)
  ElMessage.success(`整组区间已复制（${steps.value.length}个），可切换指标或角色后粘贴。`)
}
function pasteIntervals() {
  if (editingDisabled.value) return
  const copied = readCopiedPayrollIntervalGroup()
  if (!copied) return
  steps.value = copied
  ElMessage.success(`整组区间已粘贴（${copied.length}个），保存规则后生效。`)
}
function copyRow(row: PayrollMetricStep) {
  copyPayrollInterval(row)
  ElMessage.success('本行区间已复制，可新增区间后点击“粘贴到本行”。')
}
function pasteRow(target: PayrollMetricStep) {
  if (editingDisabled.value) return
  const copied = readCopiedPayrollInterval()
  if (!copied || !steps.value.includes(target)) return
  steps.value = steps.value.map((row) => (row === target ? copied : row))
  ElMessage.success('本行区间已粘贴，仅覆盖当前行，保存规则后生效。')
}
const percent = (value: number | null) => payrollRatePercent(value) ?? undefined
const rate = (value: number | undefined | null) => (value == null ? null : value / 100)
</script>
<style scoped>
.interval-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.interval-row-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.interval-row-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}
</style>
