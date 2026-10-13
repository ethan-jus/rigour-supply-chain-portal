<template>
  <el-dialog v-model="visible" title="交易单号查重" width="1100px" append-to-body>
    <p>按完整交易单号查询权限范围内的全部月份，包含逐张凭证及历史回款，不受列表筛选条件影响。</p>
    <el-input v-model="query" maxlength="128" clearable placeholder="输入完整交易单号" @input="invalidate" @keyup.enter="search">
      <template #append><el-button :loading="loading" @click="search">查重</el-button></template>
    </el-input>
    <el-alert v-if="error" :title="error" type="error" :closable="false" class="result" />
    <template v-if="searched && !error">
      <el-alert class="result" :closable="false" :type="paymentCount > 1 ? 'warning' : 'info'"
        :title="paymentCount ? `该单号关联 ${paymentCount} 条回款。合并付款可能关联多个订单，请结合金额和凭证核实。` : '当前可见的已登记交易单号中未找到匹配；尚未识别或未录入的凭证不在查重范围内。'" />
      <el-table :data="matches" max-height="440">
        <el-table-column prop="paymentNo" label="收款编号" min-width="210" />
        <el-table-column prop="orderNo" label="订单号" min-width="175" />
        <el-table-column prop="customerName" label="客户" min-width="180" />
        <el-table-column prop="salesperson" label="业务员" min-width="90" />
        <el-table-column label="回款金额" min-width="115"><template #default="{ row }">{{ moneyText(row.paidAmount) }}</template></el-table-column>
        <el-table-column label="凭证金额" min-width="115"><template #default="{ row }">{{ row.voucherAmount == null ? '未登记' : moneyText(row.voucherAmount) }}</template></el-table-column>
        <el-table-column label="系统回款日期" min-width="175"><template #default="{ row }">{{ displayDateTime(row.paymentTime) }}</template></el-table-column>
        <el-table-column label="状态" min-width="95"><template #default="{ row }">{{ row.deleted ? '已删除' : paymentRecordStatusLabel(row.paymentStatusCode) }}</template></el-table-column>
        <el-table-column prop="evidenceNote" label="凭证说明" min-width="220" />
      </el-table>
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { checkPaymentTransaction, type PaymentTransactionMatch } from '@/api/core/order-register'
import { moneyText, paymentRecordStatusLabel } from '@/utils/order-register-status'
import { displayDateTime } from '@/utils/business-date'
const props = defineProps<{ modelValue: boolean; transactionNo?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const visible = computed({ get: () => props.modelValue, set: value => emit('update:modelValue', value) })
const query = ref(''), error = ref('')
const loading = ref(false), searched = ref(false)
const matches = ref<PaymentTransactionMatch[]>([])
const paymentCount = computed(() => new Set(matches.value.map(x => x.paymentId)).size)
let requestId = 0
function invalidate() { requestId++; loading.value = false; searched.value = false; error.value = ''; matches.value = [] }
watch(() => props.modelValue, open => {
  invalidate()
  if (open) { query.value = props.transactionNo || ''; if (query.value) void search() }
})
async function search() {
  const value = query.value.trim()
  invalidate()
  if (!value) { error.value = '请输入完整交易单号'; return }
  const id = ++requestId
  loading.value = true
  try {
    const result = await checkPaymentTransaction(value)
    if (id !== requestId) return
    matches.value = result; searched.value = true
  } catch (reason) {
    if (id === requestId) error.value = reason instanceof Error ? reason.message : '查重失败，请重试'
  } finally { if (id === requestId) loading.value = false }
}
</script>
<style scoped>.result { margin: 14px 0; }</style>
