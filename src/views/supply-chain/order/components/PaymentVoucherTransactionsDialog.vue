<template>
  <el-dialog v-model="visible" title="逐张凭证交易单号" width="900px" append-to-body>
    <p>收款编号：{{ payment?.paymentNo }}　回款金额：{{ moneyText(payment?.paidAmount) }}</p>
    <p>以下金额来自付款凭证，不重复计入回款。空白单号表示尚无可确认的单号。</p>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table v-loading="loading" :data="rows" max-height="530">
      <el-table-column label="付款凭证" width="115"><template #default="{ row }">
        <el-image v-if="row.url" :src="row.url" :preview-src-list="[row.url]" preview-teleported fit="contain" style="width: 72px; height: 90px" />
        <span v-else>图片暂不可用</span>
      </template></el-table-column>
      <el-table-column label="凭证金额" width="120"><template #default="{ row }">{{ row.voucherAmount == null ? '未识别' : moneyText(row.voucherAmount) }}</template></el-table-column>
      <el-table-column label="交易单号" min-width="280"><template #default="{ row }">
        <el-button v-if="row.transactionNo" link type="primary" @click="check(row.transactionNo)">{{ row.transactionNo }}</el-button>
        <span v-else>—</span>
      </template></el-table-column>
      <el-table-column prop="evidenceNote" label="核查说明" min-width="240" />
    </el-table>
    <PaymentTransactionCheckDialog v-model="checkVisible" :transaction-no="selectedTransaction" />
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getPaymentVoucherTransactions, type PaymentVoucherTransaction, type OrderRegisterPaymentItem } from '@/api/core/order-register'
import { moneyText } from '@/utils/order-register-status'
import PaymentTransactionCheckDialog from './PaymentTransactionCheckDialog.vue'
const props = defineProps<{ modelValue: boolean; payment: OrderRegisterPaymentItem | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const visible = computed({ get: () => props.modelValue, set: value => emit('update:modelValue', value) })
const rows = ref<PaymentVoucherTransaction[]>([]), error = ref('')
const loading = ref(false), checkVisible = ref(false), selectedTransaction = ref('')
let requestId = 0
function check(value: string) { selectedTransaction.value = value; checkVisible.value = true }
watch([() => props.modelValue, () => props.payment?.id], async ([open]) => {
  const id = ++requestId
  rows.value = []; error.value = ''; loading.value = false
  if (!open || !props.payment) return
  loading.value = true
  try {
    const result = await getPaymentVoucherTransactions(props.payment.id)
    if (id !== requestId) return
    const byKey = new Map(result.map(x => [x.voucherKey, x]))
    const attachments = props.payment.attachmentViews || []
    rows.value = (props.payment.attachments || []).map(key => byKey.get(key) || {
      voucherKey: key, voucherAmount: null, transactionNo: null, evidenceNote: '尚未完成逐图核查',
      url: attachments.find(x => x.objectKey === key)?.url || null,
    })
  } catch (reason) { if (id === requestId) error.value = reason instanceof Error ? reason.message : '加载失败，请重试' }
  finally { if (id === requestId) loading.value = false }
})
</script>
