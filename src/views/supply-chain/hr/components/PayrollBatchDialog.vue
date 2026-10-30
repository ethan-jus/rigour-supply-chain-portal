<template>
  <el-dialog
    v-model="visible"
    :title="title"
    width="min(900px, 95vw)"
    :close-on-click-modal="false"
    :close-on-press-escape="!running"
    :show-close="!running"
  >
    <p>
      {{
        action === 'confirm'
          ? '请核对所选员工及金额。确认时再次校验来源和工资版本，确认后锁定结果。'
          : '仅重新计算未确认工资。已确认或已发放的记录自动跳过。'
      }}
    </p>
    <p class="field-hint">每人独立处理；部分人员失败不影响其他人。批量确认不会登记发放。</p>
    <el-input
      v-if="action === 'confirm' && !started"
      v-model="reason"
      placeholder="核对说明（选填）"
      maxlength="500"
    />
    <el-progress
      v-if="started"
      :percentage="progress"
      :status="running ? undefined : failed ? 'warning' : 'success'"
    />
    <p aria-live="polite">
      共 {{ items.length }} 人 ·
      {{
        started
          ? `成功 ${succeeded} 人 · 失败 ${failed} 人 · 跳过 ${skipped} 人 · 未执行 ${stopped} 人`
          : `可处理 ${eligible} 人 · 跳过 ${skipped} 人`
      }}
    </p>
    <el-table :data="items" row-key="record.id" border max-height="420">
      <el-table-column label="员工" width="140"
        ><template #default="{ row }"
          >{{ row.record.employeeName }}
          <div class="field-hint">{{ row.record.month }}</div></template
        ></el-table-column
      >
      <el-table-column label="本月核算金额" width="140" align="right"
        ><template #default="{ row }">{{
          payrollMoney(row.record.calculation.netPay)
        }}</template></el-table-column
      >
      <el-table-column label="结果" width="95"
        ><template #default="{ row }"
          ><el-tag
            :type="
              row.status === 'FAILED' ? 'danger' : row.status === 'SUCCESS' ? 'success' : 'info'
            "
            >{{ labels[row.status as PayrollBatchItem['status']] }}</el-tag
          ></template
        ></el-table-column
      >
      <el-table-column prop="message" label="处理说明" min-width="260" />
    </el-table>
    <template #footer>
      <el-button v-if="running" :disabled="stopping" @click="stopping = true">{{
        stopping ? '正在结束当前员工的处理' : '停止后续处理'
      }}</el-button>
      <el-button v-else @click="visible = false">{{ started ? '完成' : '取消' }}</el-button>
      <el-button v-if="!started" type="primary" :disabled="!eligible" @click="execute"
        >{{ title }} {{ eligible }} 人</el-button
      >
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { PayrollRecord } from '@/api/core/payroll'
import type { PayrollBatchItem } from '@/api/core/payroll/models/PayrollBatchItem'
import { payrollBatchSkipReason, runPayrollBatch } from '@/utils/payroll-batch'
import { payrollMoney } from '@/utils/payroll-workflow'
const emit = defineEmits<{ changed: []; busy: [value: boolean] }>()
const visible = ref(false),
  running = ref(false),
  started = ref(false),
  stopping = ref(false)
const action = ref<'confirm' | 'recalculate'>('confirm'),
  reason = ref('')
const items = ref<PayrollBatchItem[]>([])
const title = computed(() => (action.value === 'confirm' ? '批量确认工资' : '批量重算工资'))
const labels = {
  WAITING: '待执行',
  RUNNING: '处理中',
  SUCCESS: '成功',
  FAILED: '失败',
  SKIPPED: '跳过',
  STOPPED: '未执行',
}
const count = (status: PayrollBatchItem['status']) =>
  items.value.filter((r) => r.status === status).length
const eligible = computed(() => count('WAITING')),
  succeeded = computed(() => count('SUCCESS')),
  failed = computed(() => count('FAILED')),
  skipped = computed(() => count('SKIPPED')),
  stopped = computed(() => count('STOPPED'))
const progress = computed(() =>
  items.value.length
    ? Math.round(
        ((items.value.length - count('WAITING') - count('RUNNING')) * 100) / items.value.length,
      )
    : 0,
)
function open(rows: PayrollRecord[], kind: 'confirm' | 'recalculate') {
  if (running.value) return
  action.value = kind
  reason.value = ''
  started.value = false
  stopping.value = false
  const month = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date())
  items.value = [...new Map(rows.map((r) => [r.id, r])).values()].map((record) => {
    const message = payrollBatchSkipReason(record, kind, month)
    return { record, status: message ? 'SKIPPED' : 'WAITING', message: message || '等待处理' }
  })
  visible.value = true
}
async function execute() {
  if (running.value || started.value || !eligible.value) return
  running.value = true
  started.value = true
  emit('busy', true)
  try {
    await runPayrollBatch(
      items.value,
      action.value,
      reason.value.trim() || 'HR批量核对确认',
      () => !stopping.value,
    )
  } finally {
    running.value = false
    emit('busy', false)
    emit('changed')
  }
}
onBeforeRouteLeave(() => {
  if (!running.value) return true
  ElMessage.warning('正在处理工资，请先停止后续处理并等待当前员工完成')
  return false
})
onBeforeUnmount(() => {
  stopping.value = true
})
defineExpose({ open })
</script>
<style scoped>
.field-hint {
  color: var(--el-text-color-regular);
  font-size: var(--app-font-size-base);
}
.el-input,
.el-progress {
  margin: 12px 0;
}
</style>
