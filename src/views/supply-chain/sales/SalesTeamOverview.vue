<template>
  <section class="finance-report">
    <header>
      <SupplyPageTitle>{{ performance ? '绩效达成' : '销售总览' }}</SupplyPageTitle>
    </header>
    <div class="team-filters">
      <el-date-picker
        v-model="month"
        type="month"
        value-format="YYYY-MM"
        :clearable="false"
        aria-label="业绩月份"
      /><el-input
        v-model="term"
        clearable
        placeholder="员工或城市"
        aria-label="员工或城市"
      /><el-button :loading="busy" @click="load">刷新</el-button>
    </div>
    <el-alert v-if="error" type="error" :title="error" :closable="false" />
    <el-alert
      v-if="assessmentUnavailable"
      type="warning"
      title="HR 核算数据暂时无法读取，订单业绩仍可查看。"
      :closable="false"
    />
    <el-skeleton v-if="busy" :rows="5" animated />
    <template v-if="data">
      <div class="stat-grid">
        <article v-for="[label, value] in cards" :key="label">
          <span>{{ label }}</span
          ><strong>{{ value }}</strong>
        </article>
      </div>
      <section class="finance-panel">
        <header>
          <h2>{{ performance ? '人员月度达成' : '团队订单业绩' }}</h2>
          <small>{{ performance ? '回款考核取 HR 核算记录。' : '订单金额按下单月统计。' }}</small>
        </header>
        <el-table :data="people" empty-text="该范围无销售人员">
          <el-table-column label="员工" min-width="110"
            ><template #default="{ row }"
              ><el-button link type="primary" @click="drill(row.code)">{{
                row.name || row.code
              }}</el-button></template
            ></el-table-column
          >
          <el-table-column prop="city" label="城市" min-width="90" /><el-table-column
            label="订单金额"
            min-width="118"
            align="right"
            ><template #default="{ row }">{{ money(row.sales) }}</template></el-table-column
          >
          <el-table-column label="销售目标" min-width="110" align="right"
            ><template #default="{ row }">{{ money(row.goal) }}</template></el-table-column
          >
          <el-table-column label="目标差额" min-width="110" align="right"
            ><template #default="{ row }">{{
              money(row.goal == null ? null : row.goal - row.sales)
            }}</template></el-table-column
          >
          <el-table-column label="销售达成率" min-width="105" align="right"
            ><template #default="{ row }">{{
              row.goal > 0 ? ((row.sales / row.goal) * 100).toFixed(1) + '%' : '—'
            }}</template></el-table-column
          >
          <template v-if="performance"
            ><el-table-column label="整单结清业绩" min-width="130"
              ><template #default="{ row }">{{ money(row.hr?.settled) }}</template></el-table-column
            ><el-table-column label="回款考核目标" min-width="126"
              ><template #default="{ row }">{{ money(row.hr?.target) }}</template></el-table-column
            >
            <el-table-column label="有效拜访 / 缺访" min-width="122"
              ><template #default="{ row }"
                >{{ row.hr?.visits ?? '—' }} / {{ row.hr?.missingVisits ?? '—' }}</template
              ></el-table-column
            ><el-table-column label="核定进度" min-width="100"
              ><template #default="{ row }">{{
                assessmentUnavailable ? '暂不可读' : stages[row.hr?.status] || '暂无核算记录'
              }}</template></el-table-column
            ></template
          >
        </el-table>
      </section>
      <el-drawer
        v-model="open"
        :title="selectedName + ' · ' + month"
        size="min(760px,96vw)"
        destroy-on-close
      >
        <el-alert v-if="detailError" type="error" :title="detailError" /><el-skeleton
          v-if="loadingDetail"
          :rows="4"
          animated
        />
        <template v-if="detail"
          ><el-tabs
            ><el-tab-pane label="客户"
              ><el-table :data="detail.customers"
                ><el-table-column prop="name" label="客户" /><el-table-column
                  label="订单金额"
                  align="right"
                  ><template #default="{ row }">{{ money(row.sales) }}</template></el-table-column
                ></el-table
              ></el-tab-pane
            >
            <el-tab-pane label="商品"
              ><el-table :data="detail.products"
                ><el-table-column prop="product" label="商品" /><el-table-column
                  prop="quantity"
                  label="数量"
                /><el-table-column label="订单金额" align="right"
                  ><template #default="{ row }">{{ money(row.sales) }}</template></el-table-column
                ></el-table
              ></el-tab-pane
            ></el-tabs
          >
          <router-link
            v-if="canCash"
            :to="{
              path: '/supply-chain/bi/receivables',
              query: { ownerStaffCode: selected, month },
            }"
            >查看该员工回款与应收</router-link
          ></template
        >
      </el-drawer>
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useNavigationStore } from '@/stores/navigation'
import SupplyPageTitle from '@/components/supply/SupplyPageTitle.vue'
import { businessDateRange, businessMonth, businessMonthRange } from '@/utils/business-date'
import { getSalesDashboardAnalysis, type SalesAnalysis } from '@/api/core/bi-sales-dashboard'
import { apiClient } from '@/api/core/client'
import { personalGoal } from '../bi/sales-dashboard-model'
interface HR {
  employee: string
  status: string
  settled: number | null
  target: number | null
  visits: number | null
  missingVisits: number | null
}
const route = useRoute(),
  nav = useNavigationStore(),
  performance = computed(() => route.meta.routeKey === 'supply.sales.performance')
const canCash = computed(() => nav.hasPath('SUPPLY_CHAIN', '/supply-chain/bi/receivables'))
const month = ref(businessMonth(new Date())),
  term = ref(''),
  data = ref<SalesAnalysis>(),
  assess = ref<HR[]>([]),
  busy = ref(false),
  error = ref('')
const assessmentUnavailable = ref(false)
const selected = ref(''),
  open = ref(false),
  detail = ref<SalesAnalysis>(),
  loadingDetail = ref(false),
  detailError = ref('')
const selectedName = computed(
  () => data.value?.people.find((p) => p.code === selected.value)?.name || selected.value,
)
const range = () => businessDateRange(...businessMonthRange(month.value))
const money = (n: number | null | undefined) =>
  n == null
    ? '—'
    : n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const stages: Record<string, string> = {
  READY: '待确认',
  REVIEW: '待核定',
  CONFIRMED: '已确认',
  PAID: '已确认',
}
let sequence = 0,
  detailSeq = 0
async function load() {
  const token = ++sequence
  ++detailSeq
  data.value = undefined
  open.value = false
  error.value = ''
  assess.value = []
  assessmentUnavailable.value = false
  busy.value = true
  try {
    const [sales, hr] = await Promise.allSettled([
      getSalesDashboardAnalysis(range()),
      performance.value
        ? apiClient.get<HR[], HR[]>('/hr/payroll/sales-performance', {
            params: { month: month.value },
            errorFeedback: 'inline',
          })
        : Promise.resolve<HR[]>([]),
    ])
    if (sequence !== token) return
    if (sales.status === 'rejected') throw sales.reason
    data.value = sales.value
    if (hr.status === 'fulfilled') assess.value = hr.value
    else assessmentUnavailable.value = true
  } catch (e) {
    if (sequence === token) error.value = e instanceof Error ? e.message : '销售数据读取失败'
  } finally {
    if (sequence === token) busy.value = false
  }
}
async function drill(code: string) {
  const token = ++detailSeq
  selected.value = code
  open.value = true
  detail.value = undefined
  detailError.value = ''
  loadingDetail.value = true
  try {
    const result = await getSalesDashboardAnalysis({ ...range(), ownerStaffCode: code })
    if (token === detailSeq) detail.value = result
  } catch (e) {
    if (token === detailSeq) detailError.value = e instanceof Error ? e.message : '明细读取失败'
  } finally {
    if (token === detailSeq) loadingDetail.value = false
  }
}
watch([month, performance], load, { immediate: true })
onBeforeUnmount(() => {
  sequence++
  detailSeq++
})
const people = computed(() => {
  const h = new Map(assess.value.map((r) => [r.employee, r]))
  return (data.value?.people || [])
    .filter((p) => [p.name, p.code, p.city].some((v) => v?.includes(term.value.trim())))
    .map((p) => ({
      ...p,
      goal: personalGoal(data.value, p.code, 'SALES_AMOUNT', Number(month.value.slice(5))).value,
      hr: h.get(p.code),
    }))
})
const cards = computed<[string, string | number][]>(() => {
  const rows = people.value,
    sales = rows.reduce((n, p) => n + p.sales, 0),
    goal =
      rows.length && rows.every((p) => p.goal != null)
        ? rows.reduce((n, p) => n + p.goal!, 0)
        : null
  return [
    ['订单金额（元）', money(sales)],
    ['销售目标（元）', money(goal)],
    ['目标差额（元）', money(goal == null ? null : goal - sales)],
    ['团队人数', rows.length],
  ]
})
</script>
<style scoped lang="scss" src="../bi/finance-report.scss"></style>
<style scoped>
.team-filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.team-filters .el-input {
  width: 200px;
}
</style>
