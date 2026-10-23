<template>
  <PaymentRiskBoard
    :data="data"
    :loading="loading"
    :error="error"
    :initial-range="range"
    :initial-region="
      typeof route.query.regionCode === 'string' ? route.query.regionCode : undefined
    "
    @load="load"
  />
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getPaymentRisk, type PaymentRiskData } from '@/api/core/payment-risk'
import PaymentRiskBoard from './components/PaymentRiskBoard.vue'

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
async function load(months: [string, string]) {
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
      regionCode: typeof route.query.regionCode === 'string' ? route.query.regionCode : undefined,
      ownerStaffCode:
        typeof route.query.ownerStaffCode === 'string' ? route.query.ownerStaffCode : undefined,
    })
    if (version === request) data.value = result
  } catch (cause) {
    if (version === request)
      error.value = cause instanceof Error ? cause.message : '回款风险数据读取失败'
  } finally {
    if (version === request) loading.value = false
  }
}
onMounted(() => load(range.value))
watch(
  () => [route.query.regionCode, route.query.ownerStaffCode],
  () => load(range.value),
)
</script>
