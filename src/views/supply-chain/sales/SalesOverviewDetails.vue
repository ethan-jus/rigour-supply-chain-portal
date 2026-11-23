<template>
  <div :aria-busy="busy">
    <div v-if="error" class="overview-empty" role="alert">
      {{ error }}
      <button class="overview-link" type="button" @click="load">重试</button>
    </div>
    <div v-else class="overview-table">
      <table>
        <thead>
          <tr v-if="kind === 'PRODUCTS'">
            <th scope="col">商品</th>
            <th scope="col">来源订单</th>
            <th scope="col">业绩归属</th>
            <th scope="col" class="amount">商品行额</th>
          </tr>
          <tr v-else-if="kind === 'APPLICATIONS'">
            <th scope="col">核销日</th>
            <th scope="col">资金流水</th>
            <th scope="col">归属订单</th>
            <th scope="col">员工</th>
            <th scope="col" class="amount">分配额</th>
          </tr>
          <tr v-else>
            <th scope="col">来源订单</th>
            <th scope="col">客户</th>
            <th scope="col">下单日</th>
            <th scope="col" class="amount">本期下单</th>
            <th scope="col" class="amount">本期核销</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <template v-if="kind === 'PRODUCTS'"
              ><td>{{ row.name || '—' }}</td></template
            >
            <template v-else-if="kind === 'APPLICATIONS'">
              <td>{{ row.date }}</td>
              <td>{{ row.name || '—' }}</td>
            </template>
            <td>
              <router-link
                v-if="canReadOrders && row.orderNo"
                class="overview-link"
                :to="{ name: 'SupplyOrderSalesOrders', query: { orderNo: row.orderNo } }"
                >{{ row.orderNo }}</router-link
              >
              <span v-else>{{ row.orderNo || '—' }}</span>
            </td>
            <template v-if="kind === 'ORDERS'">
              <td>{{ row.name || '—' }}</td>
              <td>{{ row.date }}</td>
            </template>
            <td v-else>{{ row.employee || '归属待核' }}</td>
            <td class="amount">{{ overviewMoney(row.amount) }}</td>
            <td v-if="kind === 'ORDERS'" class="amount">{{ overviewMoney(row.applied) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="!error && (busy || !rows.length)" class="overview-empty" role="status">
      {{ busy ? '正在读取' : emptyText }}
    </p>
    <ListTableFooter v-if="total > size">
      <CompactPagination
        v-model:current-page="page"
        :page-size="size"
        :page-sizes="[size]"
        :total="total"
      />
    </ListTableFooter>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import {
  getSalesOverviewDetails,
  type SalesOverviewQuery,
  type SalesOverviewDetail,
  type SalesOverviewDetailKind,
} from '@/api/core/sales-overview'
import { useAuthStore } from '@/stores/auth'
import { useNavigationStore } from '@/stores/navigation'
import CompactPagination from '@/components/supply/CompactPagination.vue'
import ListTableFooter from '@/components/supply/ListTableFooter.vue'
import { overviewMoney, overviewPageSize } from './sales-overview-model'

const props = defineProps<{ query: SalesOverviewQuery; kind: SalesOverviewDetailKind }>()
const auth = useAuthStore()
const nav = useNavigationStore()
const canReadOrders = computed(() =>
  nav.hasPath('SUPPLY_CHAIN', '/supply-chain/order/sales-orders'),
)
const emptyText = computed(
  () =>
    ({
      PRODUCTS: '本期没有订单商品行',
      APPLICATIONS: '本期没有有效核销',
      ORDERS: '本期没有相关订单',
    })[props.kind],
)

const size = overviewPageSize
const page = ref(1)
const total = ref(0)
const rows = ref<SalesOverviewDetail[]>([])
const busy = ref(true)
const error = ref('')
let active: AbortController | undefined
async function load() {
  active?.abort()
  const current = new AbortController()
  active = current
  rows.value = []
  error.value = ''
  busy.value = true
  try {
    const result = await getSalesOverviewDetails(
      { ...props.query, kind: props.kind, page: page.value, size },
      current.signal,
    )
    if (current.signal.aborted) return
    rows.value = result.items
    total.value = result.total
  } catch (e) {
    if (!current.signal.aborted) error.value = e instanceof Error ? e.message : '明细读取失败'
  } finally {
    if (!current.signal.aborted) busy.value = false
  }
}
watch(
  () => [props.query, props.kind, auth.user?.id, auth.user?.tenantId, auth.user?.permissions],
  () => {
    total.value = 0
    if (page.value === 1) void load()
    else page.value = 1
  },
  { deep: true, immediate: true },
)
watch(page, load)
onBeforeUnmount(() => active?.abort())
</script>

<style scoped lang="scss" src="./sales-overview-table.scss"></style>
