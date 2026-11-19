<template>
  <section class="finance-report">
    <header>
      <SupplyPageTitle>{{ risk ? '风险处置' : '客户跟进' }}</SupplyPageTitle>
    </header>
    <section class="finance-panel">
      <header>
        <h2>{{ risk ? '待处置对象' : '待跟进客户' }}</h2>
        <router-link
          v-if="risk && fieldwork"
          :to="{ path: '/supply-chain/sales', query: { pendingOnly: '1' } }"
          >核查外勤疑点</router-link
        >
        <el-button text :loading="busy" @click="load">刷新</el-button>
      </header>
      <el-alert v-if="error" type="error" :title="error" />
      <el-table
        v-if="!error"
        v-loading="busy"
        :data="candidates"
        :empty-text="risk ? '暂无逾期、近期到期或账期待核的订单' : '该范围暂无待跟进客户'"
      >
        <el-table-column
          prop="object"
          :label="risk ? '订单' : '客户'"
          min-width="125"
        /><el-table-column prop="reason" :label="risk ? '待办原因' : '跟进依据'" min-width="150" />
        <el-table-column prop="owner" label="负责人" min-width="100" />
        <el-table-column v-if="write" label="操作" width="100"
          ><template #default="{ row }"
            ><el-button link type="primary" @click="start(row.seed)">发起跟进</el-button></template
          ></el-table-column
        >
      </el-table>
      <CompactPagination
        v-if="risk && total > 25"
        :current-page="page"
        :page-size="25"
        :page-sizes="[25]"
        :total="total"
        @current-change="turn"
      />
    </section>
    <section class="finance-panel">
      <h2>跟进记录</h2>
      <BiOperationsWorkbench :key="kind" :kind="kind" :action-seed="seed" />
    </section>
  </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useNavigationStore } from '@/stores/navigation'
import { useAuthStore } from '@/stores/auth'
import { businessPeriodRange, businessDateRange } from '@/utils/business-date'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import CompactPagination from '@/components/supply/CompactPagination.vue'
import BiOperationsWorkbench from '../bi/components/BiOperationsWorkbench.vue'
import { getReceivables } from '@/api/core/receivables'
import { getSupplyDashboardOverview } from '@/api/core/bi'
import type { BiActionSeed } from '@/api/core/bi-operations'
const route = useRoute(),
  auth = useAuthStore(),
  nav = useNavigationStore()
const risk = computed(() => route.meta.routeKey === 'supply.sales.risk-cases'),
  kind = computed(() => (risk.value ? 'COLLECTION' : 'CUSTOMER'))
const fieldwork = computed(() => nav.hasPath('SUPPLY_CHAIN', '/supply-chain/sales')),
  write = computed(() => auth.hasPermission('analytics:operations:write'))
const candidates = ref<
    { object: string; reason: string; owner: string | null; seed: BiActionSeed }[]
  >([]),
  seed = ref<BiActionSeed | null>(null),
  busy = ref(false),
  error = ref(''),
  page = ref(1),
  total = ref(0)
let run = 0
async function load() {
  const token = ++run
  busy.value = true
  error.value = ''
  candidates.value = []
  seed.value = null
  try {
    const [from, asOf] = businessPeriodRange('month')
    if (risk.value) {
      const report = await getReceivables({
        from,
        asOf,
        aging: 'ACTIONABLE',
        page: page.value,
        size: 25,
      })
      if (token !== run) return
      total.value = report.balanceCount
      candidates.value = report.balances.map((r) => ({
        object: r.orderNo,
        reason:
          (r.dueDate ? '合同到期 ' + r.dueDate : '到期日待核') +
          ' · 未收 ' +
          r.remaining.toLocaleString() +
          ' 元',
        owner: r.owner,
        seed: {
          kind: 'COLLECTION',
          businessRef: 'order-id:' + r.orderId,
          businessLabel: r.orderNo,
          cityCode: r.regionCode,
          employeeCode: r.employeeCode,
          assignee: r.employeeCode,
        },
      }))
    } else {
      const report = await getSupplyDashboardOverview(businessDateRange(from, asOf))
      if (token !== run) return
      candidates.value = report.customerChurnRiskRanking.map((r) => ({
        object: r.customerName || r.customerCode,
        reason: r.inactiveDays + ' 天未下单 · ' + r.segmentName,
        owner: r.ownerStaffName,
        seed: {
          kind: 'CUSTOMER',
          businessRef: 'customer-code:' + r.customerCode,
          businessLabel: r.customerName || r.customerCode,
          cityCode: r.regionCode,
          employeeCode: r.ownerStaffCode,
          assignee: r.ownerStaffCode,
        },
      }))
    }
  } catch (e) {
    if (token === run) error.value = e instanceof Error ? e.message : '对象列表读取失败'
  } finally {
    if (token === run) busy.value = false
  }
}
function start(value: BiActionSeed) {
  seed.value = { ...value }
}
function turn(v: number) {
  page.value = v
  void load()
}
watch(
  kind,
  () => {
    page.value = 1
    void load()
  },
  { immediate: true },
)
onBeforeUnmount(() => run++)
</script>
<style scoped lang="scss" src="../bi/finance-report.scss"></style>
