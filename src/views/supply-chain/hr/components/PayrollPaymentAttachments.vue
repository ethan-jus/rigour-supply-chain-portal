<template>
  <div class="payment-attachments">
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-button v-for="file in payment.attachments || []" :key="file.id" link type="primary"
      :loading="opening === file.id" @click="preview(file)">{{ file.fileName }}</el-button>
    <span v-if="!payment.attachments?.length" class="empty-receipt">-</span>
    <el-button v-if="canUpload" link type="primary" :loading="uploading" @click="input?.click()">上传凭证</el-button>
    <input ref="input" type="file" accept="image/png,image/jpeg,application/pdf" class="file-input"
      aria-label="选择发放凭证" :disabled="uploading" @change="upload" />
    <CostFilePreview v-model="visible" :url="url" :name="name" :type="type" />
  </div>
</template>
<script setup lang="ts">
import { onActivated, onBeforeUnmount, onDeactivated, ref, watch } from 'vue'
import type { PayrollPayment, PayrollPaymentAttachment, PayrollRecord } from '@/api/core/payroll'
import { getPayrollDetail } from '@/api/core/payroll'
import { payrollPaymentAttachmentContent, uploadPayrollPaymentAttachment } from '@/api/core/payroll-payment-attachments'
import { errorMessage } from '@/api/core/error'
import CostFilePreview from '../../cost/CostFilePreview.vue'
import { appendCostAttachmentFiles } from '../../cost/cost-attachment-draft'

const props = defineProps<{ payroll: PayrollRecord; payment: PayrollPayment; canUpload: boolean }>()
const emit = defineEmits<{ updated: [value: PayrollRecord] }>()
const input = ref<HTMLInputElement>(), uploading = ref(false), opening = ref(''), error = ref('')
const visible = ref(false), url = ref(''), name = ref(''), type = ref('')
let active = true, generation = 0
const current = (request: number) => active && request === generation
function reset() {
  generation++
  visible.value = false
  opening.value = ''
  uploading.value = false
  error.value = ''
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = ''
}
watch(() => [props.payroll.id, props.payment.id], reset)
onDeactivated(() => { active = false; reset() })
onActivated(() => { active = true })
onBeforeUnmount(() => { active = false; reset() })
async function upload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file || uploading.value || !props.canUpload) return
  uploading.value = true
  error.value = ''
  const request = generation, payrollId = props.payroll.id, paymentId = props.payment.id,
    revision = props.payroll.revision
  try {
    const [draft] = await appendCostAttachmentFiles([], [file], props.payment.attachments?.length || 0)
    if (!draft || !current(request)) return
    await uploadPayrollPaymentAttachment(payrollId, paymentId, revision, draft.file)
    if (!current(request)) return
    const fresh = await getPayrollDetail(payrollId)
    if (current(request)) emit('updated', fresh)
  } catch (e) {
    if (current(request)) error.value = errorMessage(e, '凭证未保存成功，请刷新核对后重试')
  } finally {
    if (current(request)) uploading.value = false
  }
}
async function preview(file: PayrollPaymentAttachment) {
  if (opening.value) return
  opening.value = file.id
  error.value = ''
  const request = generation, payrollId = props.payroll.id, paymentId = props.payment.id
  try {
    const blob = await payrollPaymentAttachmentContent(payrollId, paymentId, file.id)
    if (!current(request)) return
    if (url.value) URL.revokeObjectURL(url.value)
    url.value = URL.createObjectURL(new Blob([blob], { type: file.contentType }))
    name.value = file.fileName
    type.value = file.contentType
    visible.value = true
  } catch (e) {
    if (current(request)) error.value = errorMessage(e, '凭证读取失败，请重试')
  } finally {
    if (current(request)) opening.value = ''
  }
}
</script>
<style scoped>
.payment-attachments { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
.empty-receipt { color: var(--el-text-color-secondary); }
.file-input { display: none; }
</style>
