<template>
  <el-drawer
    :model-value="modelValue"
    :title="detail ? `订单详情 · ${detail.orderNo}` : '订单详情'"
    size="min(920px, 94vw)"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-loading="loading" class="order-register-detail">
      <el-alert
        v-if="loadError"
        :title="loadError"
        type="error"
        :closable="false"
        class="order-register-detail__alert"
      />
      <template v-if="detail">
        <el-descriptions :column="3" border size="small" title="订单信息">
          <el-descriptions-item label="订单号">
            <strong class="order-no-text">{{ detail.orderNo }}</strong>
          </el-descriptions-item>
          <el-descriptions-item label="来源">{{ sourceSystemLabel(detail.sourceSystemCode) }}</el-descriptions-item>
          <el-descriptions-item label="来源单号">{{ detail.sourceOrderNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="客户">
            {{ detail.customerNameSnapshot || '客户待补齐' }}
          </el-descriptions-item>
          <el-descriptions-item label="客户编码">{{ detail.customerCodeSnapshot || '-' }}</el-descriptions-item>
          <el-descriptions-item label="归属地区">{{ regionLabel(detail.regionCode, detail.regionName) }}</el-descriptions-item>
          <el-descriptions-item label="所属业务员">
            {{ detail.ownerEmployeeNameSnapshot || detail.ownerEmployeeCode || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="下单时间">{{ displayDateTime(detail.orderDate) }}</el-descriptions-item>
          <el-descriptions-item label="发货时间">{{ displayDateTime(detail.shipmentTime) }}</el-descriptions-item>
          <el-descriptions-item label="订单状态">{{ orderStatusLabel(detail.orderStatusCode) }}</el-descriptions-item>
          <el-descriptions-item label="收款状态">{{ orderPaymentStatusLabel(detail.paymentStatusCode) }}</el-descriptions-item>
          <el-descriptions-item label="订货金额">{{ moneyText(detail.originalAmount) }}</el-descriptions-item>
          <el-descriptions-item label="订单金额">{{ moneyText(detail.payableAmount) }}</el-descriptions-item>
          <el-descriptions-item label="回款金额">{{ moneyText(detail.paidAmount) }}</el-descriptions-item>
          <el-descriptions-item label="待收金额">{{ moneyText(detail.unpaidAmount) }}</el-descriptions-item>
          <el-descriptions-item label="创建人">{{ detail.createdBy || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ displayDateTime(detail.createdTime) }}</el-descriptions-item>
          <el-descriptions-item label="修改人">{{ detail.updatedBy || '-' }}</el-descriptions-item>
          <el-descriptions-item label="修改时间">{{ displayDateTime(detail.updatedTime) }}</el-descriptions-item>
          <el-descriptions-item label="备注">{{ detail.remark || '-' }}</el-descriptions-item>
        </el-descriptions>

        <h3 class="order-register-detail__section">商品明细</h3>
        <el-table :data="detail.lines" size="small" border>
          <el-table-column type="index" label="#" width="50" />
          <el-table-column prop="productCodeSnapshot" label="商品编码" min-width="120" />
          <el-table-column prop="productNameSnapshot" label="商品名称" min-width="180" />
          <el-table-column prop="specificationSnapshot" label="规格" min-width="120" />
          <el-table-column prop="unitCode" label="单位" width="70" />
          <el-table-column label="数量" width="90" align="right">
            <template #default="{ row }">{{ numberText(row.quantity) }}</template>
          </el-table-column>
          <el-table-column label="单价" width="110" align="right">
            <template #default="{ row }">{{ moneyText(row.unitPrice) }}</template>
          </el-table-column>
          <el-table-column label="明细金额" width="120" align="right">
            <template #default="{ row }">{{ moneyText(row.lineAmount) }}</template>
          </el-table-column>
        </el-table>

        <h3 class="order-register-detail__section">回款记录</h3>
        <el-table
          v-loading="paymentsLoading"
          :data="payments"
          size="small"
          border
          empty-text="暂无回款记录"
        >
          <el-table-column prop="paymentNo" label="回款单号" min-width="150" />
          <el-table-column label="回款金额" width="120" align="right">
            <template #default="{ row }">{{ moneyText(row.paidAmount) }}</template>
          </el-table-column>
          <el-table-column label="回款时间" width="180">
            <template #default="{ row }">{{ displayDateTime(row.paymentTime) }}</template>
          </el-table-column>
          <el-table-column prop="collectorNameSnapshot" label="收款人" min-width="100" />
        </el-table>
      </template>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { displayDateTime } from '@/utils/business-date'
import { moneyText, numberText, orderPaymentStatusLabel, orderStatusLabel, sourceSystemLabel } from '@/utils/order-register-status'
import { getSalesOrder, getSalesPayments, type SalesOrderDetail, type SalesPaymentSummary } from '@/api/core/order-sales'

const props = defineProps<{
  modelValue: boolean
  orderId: string | number | null
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const loading = ref(false)
const loadError = ref('')
const detail = ref<SalesOrderDetail | null>(null)
const payments = ref<SalesPaymentSummary[]>([])
const paymentsLoading = ref(false)

function errorMessage(reason: unknown, fallback: string) {
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String((reason as { message?: unknown }).message || fallback)
  }
  return fallback
}

function regionLabel(code: string | null, displayName: string | null) {
  return displayName?.trim() || code || '-'
}

watch(
  () => [props.modelValue, props.orderId] as const,
  async ([visible, orderId]) => {
    if (!visible || orderId === null) return
    loading.value = true
    loadError.value = ''
    detail.value = null
    payments.value = []
    try {
      const order = await getSalesOrder(orderId)
      detail.value = order
      paymentsLoading.value = true
      try {
        const page = await getSalesPayments({
          begin: 0,
          step: 200,
          salesOrderNo: order.orderNo,
        })
        payments.value = page.items
      } catch (reason) {
        loadError.value = errorMessage(reason, '回款记录加载失败，可到收款列表按订单号查询')
      } finally {
        paymentsLoading.value = false
      }
    } catch (reason) {
      loadError.value = errorMessage(reason, '订单详情加载失败，请稍后重试')
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.order-register-detail {
  min-height: 160px;
}
.order-register-detail__alert {
  margin-bottom: 12px;
}
.order-register-detail__section {
  margin: 20px 0 10px;
  font-size: 15px;
  font-weight: 600;
}
.order-no-text {
  color: var(--el-color-primary);
}
</style>
