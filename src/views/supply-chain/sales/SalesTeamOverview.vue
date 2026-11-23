<template>
  <section class="finance-report">
    <header>
      <SupplyPageTitle>绩效达成</SupplyPageTitle>
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
    <template v-if="data || assess.length">
      <div class="score-tabs" role="group" aria-label="考核项目">
        <button
          v-for="(m, key) in scoreMetrics"
          :key="key"
          type="button"
          :aria-pressed="metric === key"
          @click="metric = key"
        >
          {{ m.name }}
        </button>
      </div>
      <div class="stat-grid">
        <article v-for="[label, value] in scoreCards" :key="label">
          <span>{{ label }}</span
          ><strong>{{ value }}</strong>
        </article>
      </div>
      <section class="finance-panel">
        <header>
          <h2>人员月度达成</h2>
          <small>{{ scoreMetrics[metric].basis }}</small>
        </header>
        <el-table :data="scoreRows" empty-text="该范围无销售人员">
          <el-table-column label="员工" min-width="110"
            ><template #default="{ row }"
              ><el-button link type="primary" @click="drill(row.code)">{{
                row.name || row.code
              }}</el-button></template
            ></el-table-column
          >
          <el-table-column prop="city" label="城市" min-width="90" />
          <el-table-column label="有效目标" min-width="100" align="right"
            ><template #default="{ row }">{{ scoreValue(row.target) }}</template></el-table-column
          >
          <el-table-column label="当期实际" min-width="100" align="right"
            ><template #default="{ row }">{{ scoreValue(row.actual) }}</template></el-table-column
          >
          <el-table-column label="距目标" min-width="100" align="right"
            ><template #default="{ row }">{{
              row.comparable ? scoreValue(Math.max(0, row.target - row.actual)) : '—'
            }}</template></el-table-column
          >
          <el-table-column label="达成率" min-width="105" align="right"
            ><template #default="{ row }">{{
              row.comparable ? rate(row.actual, row.target) : row.reason
            }}</template></el-table-column
          >
          <el-table-column label="核定进度" min-width="100"
            ><template #default="{ row }">{{
              assessmentUnavailable ? '暂不可读' : stages[row.hr?.status] || '暂无核算记录'
            }}</template></el-table-column
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
        </template>
        <div class="detail-links">
          <router-link
            v-if="nav.hasPath('SUPPLY_CHAIN', '/supply-chain/order/sales-orders')"
            :to="{
              path: '/supply-chain/order/sales-orders',
              query: { ownerStaffCode: selected, month },
            }"
            >查看原单</router-link
          >
          <router-link
            v-if="nav.hasPath('SUPPLY_CHAIN', '/supply-chain/sales/visits/records')"
            :to="{
              name: 'SupplySalesVisitsRecords',
              query: {
                from: businessMonthRange(month)[0],
                to: businessMonthRange(month)[1],
                employeeCode: selected,
                assessment: 'VALID',
              },
            }"
            >有效拜访</router-link
          >
          <router-link
            v-if="nav.hasPath('SUPPLY_CHAIN', '/supply-chain/hr/sales-payroll')"
            :to="{ name: 'SupplyHrSalesPayroll', query: { month, employee: selected } }"
            >核对整单结清</router-link
          >
          <router-link
            v-if="canCash"
            :to="{
              path: '/supply-chain/bi/receivables',
              query: { ownerStaffCode: selected, month },
            }"
            >查看该员工回款与应收</router-link
          >
        </div>
      </el-drawer>
    </template>
  </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
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
  expectedVisits: number | null
  employeeName: string | null
  city: string | null
  collectionExempt: boolean
  missingVisits: number | null
}
const route = useRoute(),
  nav = useNavigationStore(),
  auth = useAuthStore()
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
  () =>
    data.value?.people.find((p) => p.code === selected.value)?.name ||
    assess.value.find((p) => p.employee === selected.value)?.employeeName ||
    selected.value,
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
      apiClient.get<HR[], HR[]>('/hr/payroll/sales-performance', {
        params: { month: month.value },
        errorFeedback: 'inline',
      }),
    ])
    if (sequence !== token) return
    if (sales.status === 'fulfilled') data.value = sales.value
    else error.value = sales.reason instanceof Error ? sales.reason.message : '订单业绩暂不可读'
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
watch(
  () => [route.query?.month, route.query?.employee],
  ([linkedMonth, employee]) => {
    if (typeof linkedMonth === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(linkedMonth))
      month.value = linkedMonth
    if (typeof employee === 'string') term.value = employee
  },
  { immediate: true },
)
watch([month, () => auth.user?.id, () => auth.user?.tenantId, () => auth.user?.permissions], load, {
  immediate: true,
  deep: true,
})
onBeforeUnmount(() => {
  sequence++
  detailSeq++
})
const scoreMetrics = {
  sales: { name: '下单业绩', basis: '按下单月和归属员工汇总。' },
  settled: { name: '结清业绩', basis: '首次整单结清时，在结清月计入整单业绩。' },
  visits: { name: '有效拜访', basis: '按 HR 月度考核采用的有效到店和应访次数核对。' },
}
const metric = ref<keyof typeof scoreMetrics>('sales')
function rate(actual: number, target: number) {
  return ((actual / target) * 100).toFixed(1) + '%'
}
function scoreValue(value: number | null | undefined) {
  return value == null ? '—' : metric.value === 'visits' ? value + ' 次' : money(value)
}
const scoreRows = computed(() => {
  const business = new Map(data.value?.people.map((p) => [p.code, p]))
  const payroll = new Map(assess.value.map((p) => [p.employee, p]))
  const codes = new Set([...business.keys(), ...payroll.keys()])
  const result = [...codes].map((code) => {
    const bi = business.get(code),
      hr = payroll.get(code)
    const actual =
      metric.value === 'sales' ? bi?.sales : metric.value === 'settled' ? hr?.settled : hr?.visits
    const target =
      metric.value === 'sales'
        ? personalGoal(data.value, code, 'SALES_AMOUNT', Number(month.value.slice(5))).value
        : metric.value === 'settled'
          ? hr?.target
          : hr?.expectedVisits
    const exempt = metric.value === 'settled' && hr?.collectionExempt
    const reason = exempt
      ? '免考核'
      : metric.value !== 'sales' && !hr
        ? '核算待补'
        : target == null
          ? '未设目标'
          : target === 0
            ? '零目标'
            : actual == null
              ? '实绩待补'
              : ''
    return {
      code,
      name: bi?.name || hr?.employeeName || code,
      city: bi?.city || hr?.city || '—',
      hr,
      actual,
      target,
      comparable: !exempt && actual != null && target != null && target > 0,
      reason,
    }
  })
  return result.filter((r) => [r.name, r.code, r.city].some((v) => v.includes(term.value.trim())))
})
const scoreCards = computed(() => {
  const comparable = scoreRows.value.filter((r) => r.comparable)
  const actual = comparable.reduce((s, r) => s + r.actual!, 0)
  const target = comparable.reduce((s, r) => s + r.target!, 0)
  return [
    ['团队达成率', target > 0 ? rate(actual, target) : '—'],
    ['可比实际', scoreValue(comparable.length ? actual : null)],
    ['可比目标', scoreValue(comparable.length ? target : null)],
    ['可比人数 / 总人数', comparable.length + ' / ' + scoreRows.value.length],
  ]
})
</script>
<style scoped lang="scss" src="../bi/finance-report.scss"></style>
<style scoped>
.score-tabs {
  display: flex;
  width: fit-content;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 5px;
}
.score-tabs button {
  padding: 5px 12px;
  background: transparent;
  border: 0;
  border-radius: 3px;
  color: var(--el-text-color-regular);
  font: inherit;
  cursor: pointer;
}
.score-tabs button[aria-pressed='true'] {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}
.detail-links {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 12px;
}
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
