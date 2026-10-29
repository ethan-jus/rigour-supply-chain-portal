<template>
  <el-dialog
    v-model="visible"
    :title="titles[action]"
    width="min(650px, 95vw)"
    class="payroll-work-dialog business-detail-panel"
    :close-on-click-modal="false"
    :close-on-press-escape="!saving"
    :show-close="!saving"
  >
    <template v-if="row">
      <el-descriptions :column="2" border
        ><el-descriptions-item label="员工"
          >{{ row.employeeName }} · {{ row.employeeCode }}</el-descriptions-item
        ><el-descriptions-item label="薪酬月份">{{ row.month }}</el-descriptions-item
        ><el-descriptions-item label="本月核算金额"
          >¥{{ costMoney(row.calculation.netPay) }}</el-descriptions-item
        ><el-descriptions-item label="已登记发放"
          >¥{{ costMoney(payrollPaid(row)) }}</el-descriptions-item
        ><el-descriptions-item label="待发金额"
          >¥{{ costMoney(payrollRemaining(row)) }}</el-descriptions-item
        ></el-descriptions
      >
      <PayrollCommissionSummary
        v-if="action === 'confirm'"
        :calculation="row.calculation"
        review-hint
      />
      <el-alert :title="hints[action]" type="info" :closable="false" />
      <el-alert
        v-if="['confirm', 'paid'].includes(action) && row.paymentBlockReason"
        :title="row.paymentBlockReason"
        type="warning"
        :closable="false"
      />
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-form label-width="125px" :disabled="saving">
        <template v-if="action === 'paid'">
          <el-form-item label="实际发放日期" required
            ><el-date-picker
              v-model="paidDate"
              type="date"
              value-format="YYYY-MM-DD"
              :disabled-date="futureDate"
          /></el-form-item>
          <el-form-item label="本次发放（元）" required
            ><el-input-number v-model="amount" :min="0" :max="payrollRemaining(row)" :precision="2"
          /></el-form-item>
          <el-form-item label="凭证号 / 流水号" required
            ><el-input
              v-model="referenceNo"
              maxlength="128"
              placeholder="实际转账流水号或发放凭证编号"
          /></el-form-item>
        </template>
        <template v-if="action === 'correct'">
          <el-form-item label="计入月份" required
            ><el-date-picker
              v-model="targetMonth"
              type="month"
              value-format="YYYY-MM"
              :disabled-date="disableCorrectionMonth"
          /></el-form-item>
          <el-form-item label="补差金额（元）" required
            ><el-input-number
              v-model="amount"
              :precision="2"
              :min="-99999999999999.99"
              :max="99999999999999.99"
            /><span class="hint">正数补发，负数冲回</span></el-form-item
          >
        </template>
        <el-form-item
          :label="action === 'paid' ? '发放说明' : '操作原因'"
          :required="action !== 'confirm'"
          ><el-input v-model="reason" type="textarea" maxlength="500" show-word-limit
        /></el-form-item>
      </el-form>
    </template>
    <template #footer
      ><el-button :disabled="saving" @click="visible = false">取消</el-button
      ><el-button
        type="primary"
        :loading="saving"
        :disabled="['confirm', 'paid'].includes(action) && !!row?.paymentBlockReason"
        @click="save"
        >{{ titles[action] }}</el-button
      ></template
    >
  </el-dialog>
</template>
<script setup lang="ts">
import { displayAmount as costMoney } from '@/utils/business-display'
import { randomId } from '@/utils/random-id'
import { ref } from 'vue'
import PayrollCommissionSummary from './PayrollCommissionSummary.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  changePayrollStatus,
  createPayrollCorrection,
  getPayrollDetail,
  registerPayrollPayment,
  type PayrollRecord,
} from '@/api/core/payroll'
import { payrollPaid, payrollRemaining } from '@/utils/payroll-workflow'
import { errorMessage } from '@/api/core/error'

type Action = 'confirm' | 'paid' | 'reopen' | 'correct'
const emit = defineEmits<{ changed: [] }>()
const titles = {
  confirm: '确认薪酬',
  paid: '登记发放',
  reopen: '撤回确认',
  correct: '跨月补差 / 冲回',
}
const hints = {
  confirm: '确认前会再次核对来源；确认后锁定结果并进入“待发放”。已结束月份才能确认。',
  paid: '登记实际已发生的付款，本操作不会发起银行转账。可分次登记，累计达到核定实发金额后标记为已发放。',
  reopen: '仅未登记发放的工资可撤回。原快照和原因保留；撤回后需重新核算、确认。',
  correct:
    '保留原工资单，把差额计入后续未锁定月份。创建后请在目标月份重新核算；目标月份确认前可作废补差记录。',
}
const visible = ref(false),
  saving = ref(false),
  row = ref<PayrollRecord>(),
  action = ref<Action>('confirm'),
  error = ref(''),
  requestId = ref('')
const paidDate = ref(''),
  amount = ref<number | undefined>(),
  referenceNo = ref(''),
  reason = ref(''),
  targetMonth = ref('')
const futureDate = (date: Date) => date.getTime() > Date.now()
const disableCorrectionMonth = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` <=
  (row.value?.month ?? '')
function blockReason(value: PayrollRecord, kind: Action): string {
  if (kind !== 'confirm' && kind !== 'paid') return ''
  if (kind === 'confirm' && value.statusCode !== 'READY')
    return '工资状态已变化，请刷新列表后再确认。'
  if (kind === 'paid' && value.statusCode !== 'CONFIRMED')
    return '当前工资状态不支持登记发放，请刷新列表后重试。'
  if (value.paymentBlockReason) return value.paymentBlockReason
  const currentMonth = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date())
  return kind === 'confirm' && value.month >= currentMonth
    ? '该薪酬月份尚未结束，仅可预核算；请在月份结束并重新核算后确认工资。'
    : ''
}
async function open(value: PayrollRecord, kind: Action) {
  if (saving.value) return
  action.value = kind
  row.value = undefined
  visible.value = false
  error.value = ''
  saving.value = true
  try {
    row.value = await getPayrollDetail(value.id)
    const blocked = blockReason(row.value, kind)
    if (blocked) {
      await ElMessageBox.alert(blocked, kind === 'confirm' ? '暂不能确认工资' : '暂不能登记发放', {
        confirmButtonText: '知道了',
        type: 'warning',
      }).catch(() => undefined)
      return
    }
    visible.value = true
    requestId.value = randomId()
    paidDate.value = new Date().toLocaleDateString('sv-SE')
    referenceNo.value = ''
    reason.value = ''
    targetMonth.value = ''
    amount.value = kind === 'paid' ? payrollRemaining(row.value) : undefined
  } catch (e) {
    visible.value = true
    error.value = errorMessage(e, '读取当前工资单失败')
  } finally {
    saving.value = false
  }
}
async function save() {
  if (!row.value || saving.value) return
  error.value = ''
  const blocked = blockReason(row.value, action.value)
  if (blocked) {
    error.value = blocked
    return
  }
  if (action.value !== 'confirm' && !reason.value.trim()) {
    error.value = '请填写操作原因或发放说明'
    return
  }
  if (
    action.value === 'paid' &&
    (!paidDate.value || !referenceNo.value.trim() || amount.value == null)
  ) {
    error.value = '请填写日期、金额和凭证号'
    return
  }
  if (
    action.value === 'correct' &&
    (!targetMonth.value || targetMonth.value <= row.value.month || !amount.value)
  ) {
    error.value = '请选择原工资之后的月份，并填写非零差额'
    return
  }
  saving.value = true
  try {
    let completedMessage = '操作完成'
    if (action.value === 'paid') {
      const result = await registerPayrollPayment(row.value, {
        requestId: requestId.value,
        paidDate: paidDate.value,
        amount: amount.value!,
        referenceNo: referenceNo.value.trim(),
        reason: reason.value.trim(),
      })
      completedMessage =
        result.statusCode === 'PAID'
          ? '已足额登记，进入已发放'
          : '本次发放已登记，剩余金额可继续登记'
    } else if (action.value === 'correct')
      await createPayrollCorrection(row.value, {
        requestId: requestId.value,
        targetMonth: targetMonth.value,
        amount: amount.value!,
        reason: reason.value.trim(),
      })
    else await changePayrollStatus(row.value, action.value, reason.value.trim())
    if (action.value === 'confirm') completedMessage = '薪酬已确认，进入待发放'
    if (action.value === 'reopen') completedMessage = '已撤回确认，回到待处理，请重新核算'
    if (action.value === 'correct') completedMessage = '差额已登记，请到目标月份核算'
    ElMessage.success(completedMessage)
    visible.value = false
    emit('changed')
  } catch (e) {
    error.value = errorMessage(e, '操作失败；状态变化时请关闭并重新打开')
  } finally {
    saving.value = false
  }
}
defineExpose({ open })
</script>
<style scoped>
.el-alert,
.el-descriptions {
  margin-bottom: 16px;
}
.hint {
  color: var(--el-text-color-regular);
  margin-left: 8px;
}
</style>
