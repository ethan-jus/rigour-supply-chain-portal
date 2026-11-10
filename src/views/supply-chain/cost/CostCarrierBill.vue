<template>
  <section v-if="source || error" class="carrier-bill">
    <h3>货拉拉账单</h3>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <template v-if="source">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="货拉拉订单号">{{ source.order.orderNo }}</el-descriptions-item>
        <el-descriptions-item label="下单员工">{{
          source.order.facts?.sourceEmployeeName || source.order.raw['下单人(员工)'] || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="平台账单（元）">{{
          money(source.order.facts?.billAmount ?? source.order.paidAmount)
        }}</el-descriptions-item>
        <el-descriptions-item label="已核对净费用（元）">{{
          money(verifiedSourceAmount(source))
        }}</el-descriptions-item>
        <el-descriptions-item label="平台已付（元）">{{
          money(currentSource(source).paidAmount)
        }}</el-descriptions-item>
        <el-descriptions-item label="平台未付（元）">{{
          money(currentSource(source).facts?.unpaidAmount)
        }}</el-descriptions-item>
        <el-descriptions-item v-if="source.sourceDifference" label="最新平台账单（元）">{{
          money(currentSource(source).facts?.billAmount)
        }}</el-descriptions-item>
        <el-descriptions-item v-if="source.verification" label="核对说明" :span="2">{{
          source.verification.reason
        }}</el-descriptions-item>
      </el-descriptions>
      <el-alert
        v-if="source.sourceDifference"
        title="平台账单已变更，需撤销确认后核对来源差异"
        type="warning"
        :closable="false"
      />
      <h4 v-if="source.order.facts?.stops.length">货拉拉实际收发货节点</h4>
      <el-table v-if="source.order.facts?.stops.length" :data="source.order.facts.stops" border>
        <el-table-column label="节点" width="100"
          ><template #default="scope">{{
            scope.$index === 0 ? '发货方' : `收货方${scope.$index}`
          }}</template></el-table-column
        >
        <el-table-column prop="name" label="名称" min-width="180" /><el-table-column
          prop="contactName"
          label="联系人"
          width="110"
        /><el-table-column prop="contactPhone" label="联系电话" width="150" /><el-table-column
          prop="address"
          label="实际地址"
          min-width="240"
        />
      </el-table>
      <el-table v-if="source.order.facts?.fees.length" :data="source.order.facts.fees" border>
        <el-table-column prop="name" label="平台费用项目" />
        <el-table-column label="金额（元）" align="right"
          ><template #default="{ row }">{{ money(row.amount) }}</template></el-table-column
        >
      </el-table>
    </template>
  </section>
</template>
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { apiClient } from '@/api/core/client'
import { errorMessage } from '@/api/core/error'
import { costMoney } from './cost-dictionaries'
import { currentSource, verifiedSourceAmount, type Amount, type ImportRow } from './huolala-source'
const props = defineProps<{ costId: string }>()
const source = ref<ImportRow | null>(null),
  error = ref('')
let request = 0
const money = (v: Amount | undefined) => (v == null ? '-' : costMoney(Number(v)))
watch(
  () => props.costId,
  async (id) => {
    const current = ++request
    source.value = null
    error.value = ''
    try {
      const result = await apiClient.get<ImportRow | null>(
        `/orders/logistics-costs/imports/by-cost/${encodeURIComponent(id)}`,
        { stayOnUnauthorized: true },
      )
      if (current === request) source.value = result
    } catch (e) {
      if (current === request) error.value = errorMessage(e, '货拉拉账单加载失败')
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  ++request
})
</script>
<style scoped>
h3 {
  margin: 0 0 16px;
}
.el-alert,
.el-table {
  margin-top: 16px;
}
</style>
