<template>
  <div v-loading="loading" class="order-invoice-panel">
    <el-alert
      v-if="loadError"
      class="order-invoice-panel__alert"
      type="warning"
      :closable="false"
      :title="loadError"
    />

    <template v-if="!invoice || invoice.statusCode === 'REVOKED'">
      <el-empty
        :description="
          invoice?.statusCode === 'REVOKED'
            ? `上次申请已撤回（${invoice.appliedBy || '—'} ${displayDateTime(invoice.appliedAt)}），可重新申请开票`
            : '该订单尚未申请开票'
        "
      >
        <el-button v-if="canWrite" type="primary" @click="openApply">申请开票</el-button>
        <span v-else class="order-invoice-panel__hint">需要「申请与登记发票」权限才能申请</span>
      </el-empty>
    </template>

    <template v-else>
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item label="开票状态">
          <el-tag :type="orderInvoiceStatusTag(invoice.statusCode)" effect="plain" size="small">
            {{ invoice.statusName }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="发票类型">{{ invoice.invoiceTypeName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="抬头类型">{{ invoice.titleTypeName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="发票抬头">{{ invoice.title || '-' }}</el-descriptions-item>
        <el-descriptions-item label="税号">{{ invoice.taxNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="开票金额">{{ moneyText(invoice.amount) }}</el-descriptions-item>
        <template v-if="invoice.invoiceType === 'SPECIAL'">
          <el-descriptions-item label="开户行">{{ invoice.bankName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="银行账号">{{ invoice.bankAccount || '-' }}</el-descriptions-item>
          <el-descriptions-item label="注册电话">{{ invoice.registerPhone || '-' }}</el-descriptions-item>
          <el-descriptions-item label="注册地址" :span="2">{{ invoice.registerAddress || '-' }}</el-descriptions-item>
        </template>
        <el-descriptions-item label="收票邮箱">{{ invoice.email || '-' }}</el-descriptions-item>
        <el-descriptions-item label="申请人">
          {{ invoice.appliedBy || '-' }} {{ displayDateTime(invoice.appliedAt) }}
        </el-descriptions-item>
        <template v-if="invoice.statusCode === 'INVOICED'">
          <el-descriptions-item label="发票号码">{{ invoice.invoiceNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="开票日期">{{ displayDate(invoice.invoicedAt) }}</el-descriptions-item>
          <el-descriptions-item label="开票人">
            {{ invoice.invoicedBy || '-' }} {{ displayDateTime(invoice.updatedAt) }}
          </el-descriptions-item>
        </template>
        <el-descriptions-item v-if="invoice.remark" label="备注" :span="3">
          {{ invoice.remark }}
        </el-descriptions-item>
      </el-descriptions>

      <div class="order-invoice-panel__section">发票附件</div>
      <FundAttachmentThumbnails
        :attachments="invoice.attachments"
        size="large"
        empty-text="尚未上传发票附件"
      />

      <div v-if="invoice.statusCode === 'PENDING' && canWrite" class="order-invoice-panel__actions">
        <el-upload
          :show-file-list="false"
          :http-request="uploadFile"
          :accept="'.jpg,.jpeg,.png,.pdf'"
          multiple
        >
          <el-button :loading="uploading">上传附件</el-button>
        </el-upload>
        <el-button
          type="primary"
          :disabled="invoice.attachments.length === 0"
          :loading="completing"
          @click="openComplete"
        >
          完成开票
        </el-button>
        <el-button :loading="withdrawLoading" @click="withdraw">撤回申请</el-button>
        <el-button link type="primary" @click="openApply">修改开票资料</el-button>
        <span class="order-invoice-panel__hint">
          上传发票附件后才能完成开票；最多 {{ MAX_ATTACHMENTS }} 个，单个不超过 10MB
        </span>
      </div>
      <div
        v-else-if="invoice.statusCode === 'PENDING'"
        class="order-invoice-panel__hint order-invoice-panel__hint--block"
      >
        需要「申请与登记发票」权限才能上传附件或完成开票
      </div>
    </template>

    <OrderInvoiceApplyDialog
      v-model="applyVisible"
      :order-no="orderNo"
      :invoice="invoice"
      @applied="onApplied"
    />

    <el-dialog v-model="completeVisible" title="完成开票" width="460px" :close-on-click-modal="false">
      <el-form ref="completeFormRef" :model="completeForm" :rules="completeRules" label-width="90px">
        <el-form-item label="发票号码" prop="invoiceNo">
          <el-input v-model="completeForm.invoiceNo" maxlength="64" placeholder="发票上的号码" />
        </el-form-item>
        <el-form-item label="开票日期" prop="invoicedAt">
          <el-date-picker
            v-model="completeForm.invoicedAt"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择开票日期"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="completeVisible = false">取消</el-button>
        <el-button type="primary" :loading="completing" @click="submitComplete">确认完成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import FundAttachmentThumbnails from '@/components/supply/FundAttachmentThumbnails.vue'
import OrderInvoiceApplyDialog from './OrderInvoiceApplyDialog.vue'
import { displayDateTime } from '@/utils/business-date'
import { moneyText } from '@/utils/order-register-status'
import { orderInvoiceStatusTag } from '@/utils/order-invoice-status'
import {
  completeOrderInvoice,
  getOrderInvoice,
  uploadOrderInvoiceAttachments,
  withdrawOrderInvoice,
  type OrderInvoiceView,
} from '@/api/core/order-register'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'

const MAX_ATTACHMENTS = 5

const props = defineProps<{ orderNo: string }>()

const { can } = useSupplyPermissions()
const canWrite = computed(() => can('order:invoice:write'))

const loading = ref(false)
const loadError = ref('')
const invoice = ref<OrderInvoiceView | null>(null)

const applyVisible = ref(false)

const completeVisible = ref(false)
const completing = ref(false)
const withdrawLoading = ref(false)
const uploading = ref(false)
const completeFormRef = ref<FormInstance>()
const completeForm = reactive({ invoiceNo: '', invoicedAt: '' })

const requiredRule = (message: string) => [{ required: true, message, trigger: 'blur' }]

const completeRules: FormRules = {
  invoiceNo: requiredRule('请填写发票号码'),
  invoicedAt: requiredRule('请选择开票日期'),
}

function errorMessage(reason: unknown, fallback: string) {
  if (reason && typeof reason === 'object' && 'message' in reason) {
    return String((reason as { message?: unknown }).message || fallback)
  }
  return fallback
}

function displayDate(value: string | null) {
  if (!value) return '-'
  return displayDateTime(value).slice(0, 10)
}

async function loadInvoice() {
  if (!props.orderNo) return
  loading.value = true
  loadError.value = ''
  try {
    invoice.value = await getOrderInvoice(props.orderNo)
  } catch (reason) {
    loadError.value = errorMessage(reason, '开票状态加载失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

function openApply() {
  applyVisible.value = true
}

function onApplied(view: OrderInvoiceView) {
  invoice.value = view
}

async function uploadFile(options: { file: File }) {
  const current = invoice.value
  if (!current) return
  uploading.value = true
  try {
    invoice.value = await uploadOrderInvoiceAttachments(current.id, [options.file])
    ElMessage.success('发票附件已上传')
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '发票附件上传失败，请稍后重试'))
  } finally {
    uploading.value = false
  }
}

function openComplete() {
  completeForm.invoiceNo = ''
  completeForm.invoicedAt = new Date().toISOString().slice(0, 10)
  completeVisible.value = true
}

async function submitComplete() {
  const form = completeFormRef.value
  const current = invoice.value
  if (!form || !current) return
  const valid = await form.validate().catch(() => false)
  if (!valid) return
  completing.value = true
  try {
    invoice.value = await completeOrderInvoice(current.id, {
      invoiceNo: completeForm.invoiceNo.trim(),
      invoicedAt: new Date(`${completeForm.invoicedAt}T00:00:00+08:00`).toISOString(),
    })
    completeVisible.value = false
    ElMessage.success('已完成开票')
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '完成开票失败，请稍后重试'))
  } finally {
    completing.value = false
  }
}

async function withdraw() {
  const current = invoice.value
  if (!current) return
  try {
    await ElMessageBox.confirm('撤回后需要重新申请开票，确认撤回？', '撤回开票申请', {
      type: 'warning',
      confirmButtonText: '撤回',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  withdrawLoading.value = true
  try {
    invoice.value = await withdrawOrderInvoice(current.id)
    ElMessage.success('开票申请已撤回')
  } catch (reason) {
    ElMessage.error(errorMessage(reason, '撤回失败，请稍后重试'))
  } finally {
    withdrawLoading.value = false
  }
}

watch(() => props.orderNo, loadInvoice, { immediate: true })
</script>

<style scoped>
.order-invoice-panel {
  min-height: 140px;
}
.order-invoice-panel__alert {
  margin-bottom: 12px;
}
.order-invoice-panel__section {
  margin: 16px 0 8px;
  font-weight: 600;
}
.order-invoice-panel__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  flex-wrap: wrap;
}
.order-invoice-panel__hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.order-invoice-panel__hint--block {
  display: block;
  margin-top: 10px;
}
</style>
