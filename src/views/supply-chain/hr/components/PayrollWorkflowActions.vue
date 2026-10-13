<template>
  <div class="payroll-workflow-actions">
    <div class="next-action">
      <div class="next-action-copy" aria-live="polite">
        <strong>{{ guidance.title }}</strong>
        <p>{{ guidance.hint }}</p>
        <p v-if="permissionHint" class="permission-hint">{{ permissionHint }}</p>
      </div>
      <div class="next-action-buttons">
        <el-button :disabled="busy" @click="$emit('close')">关闭</el-button>
        <el-button
          v-if="unlocked && canCalculate"
          :type="row.statusCode === 'REVIEW' ? 'primary' : 'default'"
          :disabled="busy"
          @click="$emit('adjust')"
        >
          当月核定
        </el-button>
        <el-button
          v-if="row.statusCode === 'REVIEW' && canCalculate"
          :loading="busy"
          @click="$emit('recalculate')"
          >重新核算</el-button
        >
        <el-button
          v-if="row.statusCode === 'READY' && canConfirm"
          type="primary"
          :disabled="busy || !monthEnded"
          @click="$emit('confirm')"
          >确认薪酬</el-button
        >
        <el-button
          v-if="row.statusCode === 'CONFIRMED' && canPay"
          type="primary"
          :disabled="busy"
          @click="$emit('paid')"
          >登记发放</el-button
        >
        <el-button v-if="row.statusCode === 'PAID'" @click="$emit('payments')">
          查看发放记录
        </el-button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import type { PayrollRecord } from '@/api/core/payroll'
import { payrollReviewGroups } from '@/utils/payroll-workflow'
const props = defineProps<{
  row: PayrollRecord
  currentMonth: string
  canCalculate: boolean
  canConfirm: boolean
  canPay: boolean
  busy: boolean
}>()
defineEmits<{
  close: []
  adjust: []
  recalculate: []
  confirm: []
  paid: []
  payments: []
}>()
const unlocked = computed(() => ['REVIEW', 'READY'].includes(props.row.statusCode))
const monthEnded = computed(() => props.row.month < props.currentMonth)
const guidance = computed(() => {
  switch (props.row.statusCode) {
    case 'REVIEW':
      return {
        title: `当前有 ${payrollReviewGroups(props.row.calculation.issues).length} 类问题待处理`,
        hint: '点击“当月核定”填写部门、绩效和一次说明，保存后自动重算。检查通过即可确认薪酬。已在来源页面处理的，可直接重新核算。',
      }
    case 'READY':
      return {
        title: '核算检查已通过 · 下一步：确认薪酬',
        hint: monthEnded.value
          ? '核对各项金额后点击“确认薪酬”，确认后锁定本月结果并进入“待发放”。'
          : '当前月份尚未结束，仅供预核算；月份结束后重新核算，再确认薪酬。',
      }
    case 'CONFIRMED':
      return {
        title: props.row.payments?.length
          ? '已部分登记发放 · 下一步：登记剩余发放'
          : '薪酬已确认 · 下一步：登记发放',
        hint: '实际付款后登记日期、金额和凭证；累计足额后进入“已发放”。此处只登记记录，不发起转账。',
      }
    case 'PAID':
      return {
        title: '本月薪酬流程已完成',
        hint: '可查看发放记录；后续差额通过“补差 / 冲回”计入其他月份。',
      }
    default:
      return { title: '请刷新确认当前薪酬状态', hint: '当前状态暂不支持流转操作。' }
  }
})
const permissionHint = computed(() => {
  if (props.row.statusCode === 'REVIEW' && !props.canCalculate)
    return '当前账号无核算权限，请由有权限的 HR 完成重新核算。'
  if (props.row.statusCode === 'READY' && !props.canConfirm)
    return '当前账号无确认权限，请交由薪酬确认人员处理。'
  if (props.row.statusCode === 'CONFIRMED' && !props.canPay)
    return '当前账号无发放登记权限，请交由发放登记人员处理。'
  return ''
})
</script>
<style scoped lang="scss">
.payroll-workflow-actions {
  text-align: left;
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 12px;
}
.next-action {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 12px;
}
.next-action-copy {
  flex: 1;
  min-width: 0;
  p {
    margin: 6px 0 0;
    color: var(--el-text-color-regular);
    font-size: 13px;
    line-height: 1.5;
  }
  .permission-hint {
    color: var(--el-color-warning-dark-2);
  }
}
.next-action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
.next-action-buttons .el-button {
  margin-left: 0;
}
@media (max-width: 760px) {
  .next-action {
    flex-direction: column;
    align-items: stretch;
  }
  :deep(.el-step__title) {
    font-size: 12px;
  }
}
</style>
