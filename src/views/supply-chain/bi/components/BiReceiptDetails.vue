<template>
  <el-dialog
    :model-value="true"
    :title="`${cityName} · ${title}`"
    width="min(1180px, 94vw)"
    :teleported="false"
    destroy-on-close
    @close="$emit('close')"
  >
    <div class="receipt-details">
      <p class="detail-period">
        {{ query.from ? businessDate(query.from) : '—' }} — {{ query.to ? businessDate(query.to) : '—' }} ·
        {{ kind === 'receipts' ? '按收款日期，含历史订单本期到账' : '按下单日期，含部分回款订单' }}
      </p>
      <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
      <el-button v-if="error" @click="load">重试</el-button>
      <template v-else>
        <div class="detail-summary">
          共 {{ data?.total ?? '—' }} {{ kind === 'receipts' ? '笔回款' : '笔订单'
          }}<b>{{ kind === 'receipts' ? '到账合计' : '待收合计' }} {{ money(data?.amount) }}</b>
        </div>
        <el-table
          v-loading="loading"
          :data="data?.items || []"
          max-height="480"
          stripe
          border
          empty-text="暂无明细"
        >
          <el-table-column
            v-if="kind === 'receipts'"
            prop="paymentNo"
            label="收款编码"
            min-width="175"
          />
          <el-table-column prop="orderNo" label="订单号" min-width="170" />
          <el-table-column prop="customerName" label="客户" min-width="180" show-overflow-tooltip />
          <el-table-column prop="regionName" label="城市" min-width="95" />
          <el-table-column prop="ownerStaffName" label="业务员" min-width="95" />
          <el-table-column :label="kind === 'receipts' ? '收款日期' : '下单日期'" min-width="180">
            <template #default="{ row }">{{ businessDateTime(row.occurredAt) }}</template>
          </el-table-column>
          <el-table-column v-if="kind === 'unpaid'" label="订单金额" min-width="125" align="right">
            <template #default="{ row }">{{ money(row.orderAmount) }}</template>
          </el-table-column>
          <el-table-column
            :label="kind === 'receipts' ? '回款金额' : '已收金额'"
            min-width="125"
            align="right"
          >
            <template #default="{ row }">{{ money(row.paidAmount) }}</template>
          </el-table-column>
          <el-table-column v-if="kind === 'unpaid'" label="待收金额" min-width="125" align="right">
            <template #default="{ row }">{{ money(row.unpaidAmount) }}</template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="page"
          :page-size="20"
          :total="data?.total || 0"
          :disabled="loading"
          layout="total, prev, pager, next"
          @current-change="load"
        />
      </template>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  getSupplyReceiptDetails,
  type SupplyDashboardQuery,
  type SupplyReceiptDetails,
} from '@/api/core/bi'
import { businessDate, businessDateTime } from '@/utils/business-date'
const props = defineProps<{
  kind: 'receipts' | 'unpaid'
  query: SupplyDashboardQuery
  cityName: string
}>()
defineEmits<{ close: [] }>()
const title = computed(() => (props.kind === 'receipts' ? '本期到账明细' : '本期订单未回款明细'))
const page = ref(1)
const data = ref<SupplyReceiptDetails | null>(null)
const loading = ref(false)
const error = ref('')
let requestId = 0
const money = (amount: number | null | undefined) =>
  amount == null
    ? '—'
    : `¥${Number(amount).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
async function load() {
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    if (!props.query.regionCode || !props.query.from || !props.query.to)
      throw new Error('城市或日期范围缺失，请刷新看板后重试')
    const result = await getSupplyReceiptDetails({
      ...props.query,
      kind: props.kind,
      begin: (page.value - 1) * 20,
      step: 20,
    })
    if (id === requestId) data.value = result
  } catch (e) {
    if (id === requestId) {
      data.value = null
      error.value = e instanceof Error ? e.message : '明细加载失败'
    }
  } finally {
    if (id === requestId) loading.value = false
  }
}
watch(
  () => [props.query, props.kind],
  () => {
    data.value = null
    page.value = 1
    void load()
  },
  { immediate: true, deep: true },
)
onBeforeUnmount(() => {
  requestId++
})
</script>

<style scoped>
.receipt-details {
  color: var(--el-text-color-primary);
}
.detail-period {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.detail-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 0 16px;
  font-size: 14px;
}
.detail-summary b {
  color: var(--el-color-primary);
  font-size: 18px;
}
.el-pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
