<template>
  <el-dialog
    :model-value="modelValue"
    :title="payment ? `回款详情 · ${payment.paymentNo}` : '回款详情'"
    width="min(1280px, 96vw)"
    top="4vh"
    destroy-on-close
    class="payment-detail-dialog"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-loading="loading" class="payment-detail">
      <el-alert
        v-if="loadError"
        :title="loadError"
        type="warning"
        :closable="false"
        class="payment-detail__alert"
      />
      <template v-if="payment">
        <div class="payment-detail__summary">
          <div class="summary-card summary-card--amount">
            <span class="summary-card__label">收款金额</span>
            <strong class="summary-amount">{{ moneyText(payment.paidAmount) }}</strong>
          </div>
          <div class="summary-card">
            <span class="summary-card__label">收款状态</span>
            <span
              class="status-badge"
              :class="`status-badge--${paymentRecordStatusTag(payment.paymentStatusCode)}`"
            >
              <span class="status-badge__dot"></span>
              {{ paymentRecordStatusLabel(payment.paymentStatusCode) }}
            </span>
          </div>
          <div class="summary-card">
            <span class="summary-card__label">收款时间</span>
            <strong class="summary-text">{{ displayDateTime(payment.paymentTime) }}</strong>
          </div>
          <div class="summary-card">
            <span class="summary-card__label">审核记录</span>
            <strong class="summary-text">
              {{ payment.checkedBy ? `${payment.checkedBy} · ${displayDateTime(payment.checkedAt)}` : '未审核' }}
            </strong>
          </div>
        </div>

        <div class="payment-detail__columns">
          <div class="payment-detail__column payment-detail__column--info">
            <h3 class="payment-detail__section">收款信息</h3>
            <el-descriptions :column="2" border>
              <el-descriptions-item label="收款编码">
                <strong>{{ payment.paymentNo }}</strong>
              </el-descriptions-item>
              <el-descriptions-item label="关联订单号">{{ payment.orderNo || '-' }}</el-descriptions-item>
              <el-descriptions-item label="交易单号">{{ payment.transactionNo || '-' }}</el-descriptions-item>
              <el-descriptions-item label="订单金额">{{ moneyText(payment.orderAmount) }}</el-descriptions-item>
              <el-descriptions-item label="客户名称">{{ payment.customerName || '-' }}</el-descriptions-item>
              <el-descriptions-item label="归属地区">
                {{ payment.regionName || payment.regionCode || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="业务员">
                {{ payment.ownerEmployeeName || payment.ownerEmployeeCode || '-' }}
              </el-descriptions-item>
              <el-descriptions-item label="部门">{{ payment.departmentName || '-' }}</el-descriptions-item>
            </el-descriptions>

            <h3 class="payment-detail__section">来源与同步审计</h3>
            <el-descriptions :column="2" border>
              <el-descriptions-item label="来源记录ID">{{ payment.sourceRecordId || '-' }}</el-descriptions-item>
              <el-descriptions-item label="创建时间">{{ displayDateTime(payment.createdTime) }}</el-descriptions-item>
              <el-descriptions-item label="创建人">{{ payment.createdBy || '-' }}</el-descriptions-item>
              <el-descriptions-item label="修改时间">{{ displayDateTime(payment.updatedTime) }}</el-descriptions-item>
              <el-descriptions-item label="修改人">{{ payment.updatedBy || '-' }}</el-descriptions-item>
              <el-descriptions-item label="同步时间">{{ displayDateTime(payment.syncedAt) }}</el-descriptions-item>
              <el-descriptions-item label="同步人">{{ payment.syncedBy || '-' }}</el-descriptions-item>
              <el-descriptions-item label="备注">{{ detail?.remark || '-' }}</el-descriptions-item>
            </el-descriptions>
          </div>

          <div class="payment-detail__column payment-detail__column--attachments">
            <h3 class="payment-detail__section">付款凭证</h3>
            <FundAttachmentThumbnails :attachments="attachmentItems" size="large" empty-text="暂无凭证" />
          </div>
        </div>
      </template>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import FundAttachmentThumbnails from '@/components/supply/FundAttachmentThumbnails.vue'
import { displayDateTime } from '@/utils/business-date'
import { moneyText, paymentRecordStatusLabel, paymentRecordStatusTag } from '@/utils/order-register-status'
import type { OrderRegisterPaymentItem } from '@/api/core/order-register'
import { getSalesPayment, type FundDocumentAttachment, type SalesPaymentDetail } from '@/api/core/order-sales'

const props = defineProps<{
  modelValue: boolean
  payment: OrderRegisterPaymentItem | null
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const loading = ref(false)
const loadError = ref('')
const detail = ref<SalesPaymentDetail | null>(null)

const attachmentItems = computed<Array<FundDocumentAttachment | string>>(() => {
  const detailItems: FundDocumentAttachment[] = (
    detail.value?.attachments?.length
      ? detail.value.attachments
      : (detail.value?.voucherKeys ?? []).map((key) => ({ objectKey: key, fileName: null, url: null }))
  ).filter((item) => item.objectKey)
  const rowViews = props.payment?.attachmentViews ?? []
  const rowKeys = props.payment?.attachments ?? []
  if (detailItems.some((item) => item.url)) return detailItems
  if (rowViews.some((item) => item.url)) return rowViews
  if (detailItems.length) return detailItems
  if (rowViews.length) return rowViews
  return rowKeys
})

watch(
  () => [props.modelValue, props.payment?.id] as const,
  async ([visible, paymentId]) => {
    if (!visible || !paymentId) return
    loading.value = true
    loadError.value = ''
    detail.value = null
    try {
      detail.value = await getSalesPayment(paymentId)
    } catch (reason) {
      if (!props.payment?.attachmentViews?.length) {
        loadError.value = errorMessage(reason, '回款补充信息加载失败，凭证以列表签发结果为准。')
      }
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

function errorMessage(reason: unknown, fallback: string) {
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String((reason as { message?: unknown }).message || fallback)
  }
  return fallback
}
</script>

<style scoped>
.payment-detail {
  min-height: 200px;
}

.payment-detail__alert {
  margin-bottom: 14px;
}

.payment-detail__summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.summary-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 14px 16px;
  background: var(--el-fill-color-light);
  border-radius: 10px;
}

.summary-card--amount {
  background: var(--el-color-primary-light-9);
}

.summary-card__label {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.summary-amount {
  color: var(--el-color-primary);
  font-size: 24px;
  line-height: 1.2;
}

.summary-text {
  color: var(--el-text-color-primary);
  font-size: 15px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 9px 22px;
  border-radius: 8px;
  color: #fff;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 1px;
  line-height: 1.2;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.status-badge__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
}

.status-badge--success {
  background: var(--el-color-success);
}

.status-badge--warning {
  background: var(--el-color-warning);
}

.status-badge--danger {
  background: var(--el-color-danger);
}

.status-badge--info {
  background: var(--el-color-info);
}

.status-badge--primary {
  background: var(--el-color-primary);
}

.payment-detail__columns {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: stretch;
}

.payment-detail__column--info {
  flex: 1 1 560px;
  min-width: 460px;
}

.payment-detail__column--attachments {
  flex: 1 1 560px;
  min-width: 460px;
  padding: 14px 16px 16px;
  background: var(--el-fill-color-lighter);
  border-radius: 10px;
}

.payment-detail__section {
  margin: 0 0 12px;
  padding-left: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  border-left: 3px solid var(--el-color-primary);
}

.payment-detail__section:not(:first-child) {
  margin-top: 22px;
}

.payment-detail__column :deep(.el-descriptions__label) {
  font-size: 14px;
}

.payment-detail__column :deep(.el-descriptions__content) {
  font-size: 14px;
}

.payment-detail__column :deep(.el-descriptions__cell) {
  padding: 10px 12px;
}
</style>

<style>
.payment-detail-dialog .el-dialog__body {
  max-height: 78vh;
  overflow-y: auto;
}
</style>
