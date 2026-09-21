<template>
  <el-dialog v-model="visible" title="核对回款" width="680px" :close-on-click-modal="false">
    <template v-if="payment">
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="订单号">{{ payment.orderNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="客户名称">{{ payment.customerName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="订单金额">{{ moneyText(payment.orderAmount) }}</el-descriptions-item>
        <el-descriptions-item label="回款金额">{{ moneyText(payment.paidAmount) }}</el-descriptions-item>
        <el-descriptions-item label="收款时间">{{ displayDateTime(payment.paymentTime) }}</el-descriptions-item>
        <el-descriptions-item label="收款状态">
          <span class="status-cell">
            <i
              class="status-dot"
              :class="`status-dot--${paymentRecordStatusTag(payment.paymentStatusCode)}`"
            />
            {{ paymentRecordStatusLabel(payment.paymentStatusCode) }}
          </span>
        </el-descriptions-item>
      </el-descriptions>

      <div class="payment-check__section">回款凭据</div>
      <FundAttachmentThumbnails
        :attachments="payment.attachmentViews?.length ? payment.attachmentViews : payment.attachments"
        size="large"
        empty-text="未上传回款凭据"
      />

      <el-alert
        class="payment-check__hint"
        type="info"
        :closable="false"
        title="请与银行流水核对一致后填写交易单号并点击审核通过；交易单号用于付款凭证验重（重复会被拒绝）与财务对账。"
      />

      <el-form label-width="96px" class="payment-check__form" @submit.prevent>
        <el-form-item label="交易单号" required>
          <el-input
            v-model="transactionNo"
            maxlength="128"
            clearable
            placeholder="银行流水号 / 支付渠道流水号"
            @keyup.enter="submit"
          />
        </el-form-item>
      </el-form>
      <p v-if="checkError" class="payment-check__error">{{ checkError }}</p>
    </template>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">审核通过</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import FundAttachmentThumbnails from '@/components/supply/FundAttachmentThumbnails.vue'
import { displayDateTime } from '@/utils/business-date'
import {
  moneyText,
  paymentRecordStatusLabel,
  paymentRecordStatusTag,
} from '@/utils/order-register-status'
import { checkOrderRegisterPayment, type OrderRegisterPaymentItem } from '@/api/core/order-register'

const props = defineProps<{
  modelValue: boolean
  payment: OrderRegisterPaymentItem | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  checked: [payment: OrderRegisterPaymentItem]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
})

const transactionNo = ref('')
const checkError = ref('')
const submitting = ref(false)

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    transactionNo.value = ''
    checkError.value = ''
  },
  { immediate: true },
)

function errorMessage(reason: unknown, fallback: string) {
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String((reason as { message?: unknown }).message || fallback)
  }
  return fallback
}

async function submit() {
  const current = props.payment
  if (!current || submitting.value) return
  const value = transactionNo.value.trim()
  if (!value) {
    checkError.value = '请填写交易单号后再点击审核通过'
    return
  }
  submitting.value = true
  checkError.value = ''
  try {
    const updated = await checkOrderRegisterPayment(current.id, { transactionNo: value })
    emit('checked', updated)
    visible.value = false
    ElMessage.success('回款已核对')
  } catch (reason) {
    checkError.value = errorMessage(reason, '核对失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.payment-check__section {
  margin: 14px 0 8px;
  font-weight: 600;
}

.payment-check__hint {
  margin: 12px 0;
}

.payment-check__form {
  margin-top: 4px;
}

.payment-check__error {
  margin: 0;
  padding: 8px 12px;
  border: 1px solid #fecaca;
  border-radius: 6px;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 13px;
}

.status-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.status-dot {
  width: 6px;
  height: 6px;
  flex: none;
  border-radius: 50%;
}

.status-dot--success {
  background: #059669;
}

.status-dot--primary {
  background: #2563eb;
}

.status-dot--warning {
  background: #d97706;
}

.status-dot--danger {
  background: #dc2626;
}

.status-dot--info {
  background: #94a3b8;
}
</style>
