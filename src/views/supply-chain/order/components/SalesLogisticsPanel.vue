<template>
  <section v-loading="loading" class="sales-logistics" aria-label="物流发货">
    <el-alert v-if="error" :title="error" type="error" :closable="false"
      ><el-button link type="primary" @click="load">重试</el-button></el-alert
    >
    <template v-if="context">
      <div class="logistics-header">
        <div class="logistics-summary">
          <span
            >已关联
            <strong>{{
              context.transports.filter((r) => r.record.statusCode !== 'VOID').length
            }}</strong>
            笔</span
          ><span
            >本单分摊费用 <strong>{{ money(context.allocatedAmount) }}</strong> 元</span
          ><span
            >计入运输成本 <strong>{{ money(context.confirmedAmount) }}</strong> 元</span
          >
        </div>
        <el-button
          v-if="can('order:logistics-cost:write') && context.canAssociate"
          type="primary"
          @click="chooser = true"
          >选择物流</el-button
        >
      </div>
      <el-table :data="context.transports" border empty-text="暂未关联物流">
        <el-table-column prop="record.documentNo" label="费用单号" min-width="220" />
        <el-table-column label="物流公司" min-width="120"
          ><template #default="{ row }">{{
            carrier(row as TransportDetail)
          }}</template></el-table-column
        >
        <el-table-column label="快递单号" min-width="200"
          ><template #default="{ row }">{{ no(row as TransportDetail) }}</template></el-table-column
        >
        <el-table-column label="下单／发货时间" min-width="190"
          ><template #default="{ row }">{{
            transportTimeOf(row.record, row.platform, row.shipments)
          }}</template></el-table-column
        >
        <el-table-column label="收货方" min-width="180"
          ><template #default="{ row }">{{
            receiversOf(row.record, row.platform).join('、')
          }}</template></el-table-column
        >
        <el-table-column label="本单分摊费用（元）" min-width="170" align="right"
          ><template #default="{ row }">{{
            money(allocated(row as TransportDetail))
          }}</template></el-table-column
        >
        <el-table-column label="单据状态" width="110"
          ><template #default="{ row }">{{
            statusName(row.record.statusCode, row.record.businessStatusCode)
          }}</template></el-table-column
        >
        <el-table-column label="操作" width="100" fixed="right"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="view(row.record.id)"
              >查看物流</el-button
            ></template
          ></el-table-column
        >
      </el-table>
      <SalesLogisticsChooser
        v-if="chooser"
        v-model="chooser"
        :order-id="orderId"
        :context="context"
        @saved="changed"
        @view="view"
      />
    </template>
    <TransportRecordEditor
      v-if="opened"
      v-model="opened"
      :detail="detail"
      :readonly="true"
      :actions-enabled="false"
      @associate-employee="associateEmployee"
    />
  </section>
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getSalesLogistics, type SalesLogisticsContext } from '@/api/core/sales-logistics'
import { getTransport, type TransportDetail } from '@/api/core/transport-records'
import {
  money,
  transportTimeOf,
  receiversOf,
  statusName,
  frozenTransportSources,
} from '../../cost/transport-records'
import { savedTransportAllocations } from '../../cost/transport-allocation'
import { costLabel, loadCostDictionaries } from '../../cost/cost-dictionaries'
import { currentSource } from '../../cost/huolala-source'
import { errorMessage } from '@/api/core/error'
import { useSupplyPermissions } from '@/composables/useSupplyPermissions'
import TransportRecordEditor from '../../cost/TransportRecordEditor.vue'
import SalesLogisticsChooser from './SalesLogisticsChooser.vue'
const props = defineProps<{ orderId: string | number; openChooser?: boolean }>()
const emit = defineEmits<{ changed: [] }>()
const { can } = useSupplyPermissions()
const router = useRouter()
const context = ref<SalesLogisticsContext | null>(null),
  loading = ref(false),
  error = ref(''),
  chooser = ref(false)
const opened = ref(false),
  detail = ref<TransportDetail | null>(null)
const carrier = (r: TransportDetail) =>
  r.platform
    ? '货拉拉'
    : r.shipments?.[0]?.latest.carrierName ||
      costLabel('COST_CARRIER', r.record.data.ledger?.carrierCode)
const no = (r: TransportDetail) =>
  r.platform
    ? currentSource(r.platform.source).orderNo
    : r.shipments?.[0]?.latest.trackingNumbers.join('、') ||
      r.record.data.ledger?.platformOrderNo ||
      '-'
function allocated(r: TransportDetail) {
  return (
    savedTransportAllocations(r, frozenTransportSources(r.record)).find(
      (s) => s.code === context.value?.salesOrder.documentNo,
    )?.amount ?? null
  )
}
function associateEmployee() {
  opened.value = false
  const staffId = detail.value?.platform
    ? currentSource(detail.value.platform.source).facts?.sourceStaffId
    : null
  void router.push({
    path: '/supply-chain/integration/huolala',
    query: { tab: 'employees', ...(staffId ? { staffId } : {}) },
  })
}
let serial = 0
async function load() {
  const current = ++serial
  loading.value = true
  error.value = ''
  try {
    const [data] = await Promise.all([
      getSalesLogistics(props.orderId),
      loadCostDictionaries('logistics'),
    ])
    if (current === serial) {
      context.value = data
      if (props.openChooser && data.canAssociate) chooser.value = true
    }
  } catch (e) {
    if (current === serial) error.value = errorMessage(e, '物流发货加载失败')
  } finally {
    if (current === serial) loading.value = false
  }
}
async function view(id: string) {
  try {
    detail.value = await getTransport(id)
    opened.value = true
  } catch (e) {
    ElMessage.error(errorMessage(e, '运输详情加载失败'))
  }
}
async function changed() {
  emit('changed')
  await load()
  chooser.value = false
}
watch(
  () => props.orderId,
  () => {
    context.value = null
    void load()
  },
  { immediate: true },
)
</script>
<style scoped>
.logistics-header {
  display: flex;
  gap: 16px;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.logistics-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.logistics-summary strong {
  color: var(--el-color-primary);
}
</style>
