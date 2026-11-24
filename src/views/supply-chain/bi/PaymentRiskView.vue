<template>
  <el-radio-group v-model="productView" aria-label="风险分析维度" class="risk-dimension">
    <el-radio-button :value="true">商品账龄</el-radio-button>
    <el-radio-button :value="false">合同到期</el-radio-button>
  </el-radio-group>
  <el-alert v-if="filterError" type="error">{{ filterError }} <el-button link @click="scope.load">重试</el-button></el-alert>
  <p v-else-if="!directory" role="status">正在读取部门范围…</p>
  <ReceivablesView v-else-if="!productView" />
  <PaymentRiskBoard v-else
    :data="data"
    :loading="loading"
    :error="error"
    :initial-range="range"
    :initial-region="
      scope.department.value || undefined
    "
    @load="load"
  />
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getPaymentRisk, type PaymentRiskData } from '@/api/core/payment-risk'
import PaymentRiskBoard from './components/PaymentRiskBoard.vue'

import ReceivablesView from './ReceivablesView.vue'
import { provideDashboardFilters } from './department-filters'
const scope = provideDashboardFilters()
const { options: directory, error: filterError } = scope
const productView = ref(true)
const route = useRoute()
const data = ref<PaymentRiskData | null>(null)
const loading = ref(false)
const error = ref('')
const currentMonth = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
}).format(new Date())
const range = ref<[string, string]>([`${currentMonth.slice(0, 4)}-01`, currentMonth])
let request = 0
async function load(months: [string, string], cacheBypass = false) {
  const version = ++request
  range.value = months
  loading.value = true
  error.value = ''
  data.value = null
  try {
    const [year, month] = months[1].split('-').map(Number)
    const end = new Date(Date.UTC(year!, month!, 1) - 8 * 3600000 - 1).toISOString()
    const result = await getPaymentRisk({
      from: new Date(`${months[0]}-01T00:00:00+08:00`).toISOString(),
      to: end,
      regionCode: scope.department.value || undefined,
      customerRegionCode: scope.customerRegion.value || undefined,
      ownerStaffCode:
        typeof route.query.ownerStaffCode === 'string' ? route.query.ownerStaffCode : undefined,
    }, cacheBypass)
    if (version === request) data.value = result
  } catch (cause) {
    if (version === request)
      error.value = cause instanceof Error ? cause.message : '回款风险数据读取失败'
  } finally {
    if (version === request) loading.value = false
  }
}
watch(
  () => [productView.value, directory.value, scope.department.value, scope.customerRegion.value, route.query.ownerStaffCode],
  () => { if (productView.value && directory.value) void load(range.value) },
  { immediate: true },
)
</script>
<style scoped>.risk-dimension { margin-bottom: 12px }</style>
