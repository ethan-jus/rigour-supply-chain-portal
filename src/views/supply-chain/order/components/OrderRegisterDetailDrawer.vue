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
        <div class="order-register-detail__amounts">
          <div class="amount-card">
            <span>订货金额</span>
            <strong>{{ moneyText(detail.originalAmount) }}</strong>
          </div>
          <div class="amount-card">
            <span>订单金额</span>
            <strong>{{ moneyText(detail.payableAmount) }}</strong>
          </div>
          <div class="amount-card">
            <span>回款金额</span>
            <strong>{{ moneyText(detail.paidAmount) }}</strong>
          </div>
          <div class="amount-card">
            <span>待收金额</span>
            <strong>{{ moneyText(detail.unpaidAmount) }}</strong>
          </div>
        </div>

        <el-tabs v-model="activeTab">
          <el-tab-pane label="概览" name="overview">
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="订单号">
                <strong class="order-no-text">{{ detail.orderNo }}</strong>
              </el-descriptions-item>
              <el-descriptions-item label="客户">
                {{ detail.customerNameSnapshot || '客户待补齐' }}
              </el-descriptions-item>
              <el-descriptions-item label="客户编码">{{
                detail.customerCodeSnapshot || '-'
              }}</el-descriptions-item>
              <el-descriptions-item label="归属地区">
                {{ regionLabel(detail.regionCode, detail.regionName) }}
              </el-descriptions-item>
              <el-descriptions-item label="业务员">
                {{ detail.ownerEmployeeNameSnapshot || detail.ownerEmployeeCode || '-' }}
                <el-button v-if="can('order:attribution:read')" link type="primary" @click="attributionVisible = true">
                  <SupplyActionLabel code="order:attribution:read" fallback="归属更正" />
                </el-button>
              </el-descriptions-item>
              <el-descriptions-item label="下单时间">{{
                displayDateTime(detail.orderDate)
              }}</el-descriptions-item>
              <el-descriptions-item label="发货时间">{{
                displayDateTime(detail.shipmentTime)
              }}</el-descriptions-item>
              <el-descriptions-item label="订单状态">{{
                orderStatusLabel(detail.orderStatusCode)
              }}</el-descriptions-item>
              <el-descriptions-item label="收款状态">
                {{
                  orderPaymentStatusLabel(
                    detail.payableAmount != null && Number(detail.payableAmount) === 0
                      ? 'NOT_REQUIRED'
                      : detail.paymentStatusCode,
                  )
                }}
              </el-descriptions-item>
              <el-descriptions-item label="备注">{{ detail.remark || '-' }}</el-descriptions-item>
            </el-descriptions>
          </el-tab-pane>

          <el-tab-pane label="商品明细" name="lines">
            <el-table :data="detail.lines" size="small" border>
              <el-table-column type="index" label="#" width="50" />
              <el-table-column prop="productCodeSnapshot" label="商品编码" min-width="120" />
              <el-table-column prop="productNameSnapshot" label="商品名称" min-width="180" />
              <el-table-column prop="specificationSnapshot" label="规格" min-width="110" />
              <el-table-column prop="skuCodeSnapshot" label="SKU/型号" min-width="120" />
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
              <el-table-column label="商品关联" width="100">
                <template #default="{ row }">
                  <el-tag
                    v-if="!row.productId || !row.productVariantId"
                    type="warning"
                    effect="plain"
                    size="small"
                  >
                    {{ row.productId ? '未关联规格' : '未关联商品' }}
                  </el-tag>
                  <span v-else>-</span>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane v-if="can('order:read')" label="合同账期" name="terms" lazy>
            <ReceivablePlanTab v-if="detail && activeTab==='terms' && can('order:read')" :id="detail.id" :amount="detail.payableAmount"/>
          </el-tab-pane>
          <el-tab-pane v-if="can('order:register-payments:read')" label="回款记录" name="payments">
            <el-table
              v-loading="paymentsLoading"
              :data="payments"
              size="small"
              border
              empty-text="暂无回款记录"
            >
              <!-- @vue-generic {OrderRegisterPaymentItem} -->
              <el-table-column label="回款单号" min-width="170">
                <template #default="{ row }">
                  <el-link type="primary" underline="never" @click.stop="openPayment(row)">
                    {{ row.paymentNo }}
                  </el-link>
                </template>
              </el-table-column>
              <el-table-column label="回款金额" width="110" align="right">
                <template #default="{ row }">{{ moneyText(row.paidAmount) }}</template>
              </el-table-column>
              <el-table-column label="回款状态" width="100">
                <template #default="{ row }">
                  <el-tag
                    :type="paymentRecordStatusTag(row.paymentStatusCode)"
                    effect="plain"
                    size="small"
                  >
                    {{ paymentRecordStatusLabel(row.paymentStatusCode) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="回款时间" width="160">
                <template #default="{ row }">{{ displayDateTime(row.paymentTime) }}</template>
              </el-table-column>
              <el-table-column prop="transactionNo" label="交易单号" min-width="150">
                <template #default="{ row }">{{ row.transactionNo || '-' }}</template>
              </el-table-column>
              <el-table-column label="凭证" width="90" align="center">
                <template #default="{ row }">
                  <span v-if="row.attachments && row.attachments.length"
                    >共 {{ row.attachments.length }} 张</span
                  >
                  <span v-else>-</span>
                </template>
              </el-table-column>
              <el-table-column label="财务确认" min-width="150">
                <template #default="{ row }">
                  {{ paymentConfirmationLabel(row.paymentStatusCode) }}
                  <span v-if="row.paymentStatusCode === 'CHECKED' && row.checkedBy">
                    · {{ row.checkedBy }} · {{ displayDateTime(row.checkedAt) }}</span
                  >
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="发票" name="invoice">
            <OrderInvoicePanel v-if="detail" :order-no="detail.orderNo" />
          </el-tab-pane>

          <el-tab-pane v-if="can('order:logistics-cost:read')" label="物流发货" name="logistics">
            <SalesLogisticsPanel
              v-if="activeTab === 'logistics'"
              :order-id="detail.id"
              @changed="emit('logistics-changed')"
            />
          </el-tab-pane>
          <el-tab-pane label="来源与审计" name="audit">
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="来源系统">
                {{ sourceSystemLabel(detail.sourceSystemCode) }}
              </el-descriptions-item>
              <el-descriptions-item label="来源单号">{{
                detail.sourceOrderNo || '-'
              }}</el-descriptions-item>
              <el-descriptions-item label="创建人">{{
                detail.sourceCreatorName || detail.createdBy || '-'
              }}</el-descriptions-item>
              <el-descriptions-item label="下单时间">{{
                displayDateTime(detail.orderDate)
              }}</el-descriptions-item>
              <el-descriptions-item label="修改人">{{
                detail.updatedBy || '-'
              }}</el-descriptions-item>
              <el-descriptions-item label="修改时间">{{
                displayDateTime(detail.updatedTime)
              }}</el-descriptions-item>
            </el-descriptions>
            <el-alert
              v-if="lifecycleError"
              :title="lifecycleError"
              type="warning"
              :closable="false"
            />
            <el-table
              v-if="lifecycleEvents.length"
              :data="lifecycleEvents"
              size="small"
              style="margin-top: 16px"
            >
              <el-table-column label="状态" width="90"
                ><template #default="{ row }">{{
                  orderStatusLabel(row.status)
                }}</template></el-table-column
              >
              <el-table-column label="来源操作人" width="120"
                ><template #default="{ row }">{{
                  row.operatorName || '来源未提供'
                }}</template></el-table-column
              >
              <el-table-column label="来源操作时间" width="175"
                ><template #default="{ row }">{{
                  row.operatedAt ? displayDateTime(row.operatedAt) : '来源未提供'
                }}</template></el-table-column
              >
              <el-table-column label="系统发现时间" width="175"
                ><template #default="{ row }">{{
                  displayDateTime(row.detectedAt)
                }}</template></el-table-column
              >
              <el-table-column prop="reason" label="核对依据" min-width="220" />
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </template>
    </div>

    <PaymentDetailDrawer v-model="paymentDetailVisible" :payment="selectedPayment" />
    <OrderAttributionReviewDialog
      v-if="modelValue && attributionVisible && detail && String(detail.id) === String(orderId) && can('order:attribution:read')"
      :key="detail.id"
      v-model="attributionVisible"
      :order-id="detail.id"
      @applied="refreshAttribution"
    />
  </el-drawer>
</template>

<script setup lang="ts">
import { onMounted as onPaymentMounted } from 'vue'
import { loadOrderDictionaries, paymentConfirmationLabel } from '@/utils/order-register-status'
onPaymentMounted(() => {
  void loadOrderDictionaries()
})
import { ref, watch } from 'vue'
import { displayDateTime } from '@/utils/business-date'
import {
  moneyText,
  numberText,
  orderPaymentStatusLabel,
  orderStatusLabel,
  paymentRecordStatusLabel,
  paymentRecordStatusTag,
  sourceSystemLabel,
} from '@/utils/order-register-status'
import { orderLifecycleEvents, type SourceLifecycleEvent } from '@/api/core/order-history-sync'
import { getRegisterOrderDetail, type SalesOrderDetail } from '@/api/core/order-sales'
import { getOrderRegisterPayments, type OrderRegisterPaymentItem } from '@/api/core/order-register'
import PaymentDetailDrawer from './PaymentDetailDrawer.vue'
import ReceivablePlanTab from './ReceivablePlanTab.vue'
import OrderAttributionReviewDialog from './OrderAttributionReviewDialog.vue'
import SupplyActionLabel from '@/components/supply/SupplyActionLabel.vue'
import SalesLogisticsPanel from './SalesLogisticsPanel.vue'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import OrderInvoicePanel from './OrderInvoicePanel.vue'

const props = defineProps<{
  page?: 'orders' | 'lines'
  modelValue: boolean
  orderId: string | number | null
  /** 打开时默认展示的页签；列表操作列的“发票”入口直接定位到发票页签。 */
  initialTab?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; 'logistics-changed': []; 'attribution-changed': [] }>()
const { can } = useSupplyPermissions()

const loading = ref(false)
const loadError = ref('')
const detail = ref<SalesOrderDetail | null>(null)
const payments = ref<OrderRegisterPaymentItem[]>([])
const paymentsLoading = ref(false)
const lifecycleEvents = ref<SourceLifecycleEvent[]>([])
const lifecycleError = ref('')
const activeTab = ref('overview')
const paymentDetailVisible = ref(false)
const attributionVisible = ref(false)
const selectedPayment = ref<OrderRegisterPaymentItem | null>(null)

function errorMessage(reason: unknown, fallback: string) {
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String((reason as { message?: unknown }).message || fallback)
  }
  return fallback
}

function regionLabel(code: string | null, displayName: string | null) {
  return displayName?.trim() || code || '-'
}

function openPayment(payment: OrderRegisterPaymentItem) {
  selectedPayment.value = payment
  paymentDetailVisible.value = true
}

async function refreshAttribution() {
  const orderId = props.orderId
  if (orderId === null) return
  emit('attribution-changed')
  try {
    const current = await getRegisterOrderDetail(props.page ?? 'orders', orderId)
    if (props.modelValue && props.orderId === orderId) detail.value = current
  } catch (reason) {
    if (props.modelValue && props.orderId === orderId)
      loadError.value = errorMessage(reason, '归属已更新，请重新打开订单查看')
  }
}

watch(
  () => [props.modelValue, props.orderId] as const,
  async ([visible, orderId]) => {
    attributionVisible.value = false
    if (!visible || orderId === null) return
    loading.value = true
    loadError.value = ''
    detail.value = null
    payments.value = []
    lifecycleEvents.value = []
    lifecycleError.value = ''
    activeTab.value = props.initialTab || 'overview'
    try {
      const order = await getRegisterOrderDetail(props.page ?? 'orders', orderId)
      detail.value = order
      try {
        if (can('order:read')) lifecycleEvents.value = await orderLifecycleEvents(orderId)
      } catch {
        lifecycleError.value = '状态留痕加载失败，请稍后重试'
      }
      if (!can('order:register-payments:read')) return
      paymentsLoading.value = true
      try {
        const page = await getOrderRegisterPayments({
          begin: 0,
          step: 200,
          orderNo: order.orderNo,
        })
        payments.value = page.items
      } catch (reason) {
        loadError.value = errorMessage(reason, '回款记录加载失败，可到订单回款按订单号查询')
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
.order-register-detail__amounts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}
.amount-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}
.amount-card span {
  color: var(--el-text-color-secondary);
  font-size: var(--app-font-size-base);
}
.amount-card strong {
  color: var(--el-text-color-primary);
  font-size: 16px;
}
.order-no-text {
  color: var(--el-color-primary);
}
</style>
